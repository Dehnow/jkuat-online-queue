// mpesa.js — Complete M-Pesa Daraja STK Push module
// ===================================================
// Handles all M-Pesa integration: OAuth, STK Push, callbacks, diagnostics

import { eq, and, sql } from 'drizzle-orm'

const GOLDEN_PRICE = 200 // KES

// ---------- Configuration Helpers ----------
function getConfig() {
  const env = (process.env.MPESA_ENVIRONMENT || 'sandbox').toLowerCase()
  const baseUrl = env === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke'
  
  // Strip whitespace and quotes from env vars (common issue on hosting platforms)
  const stripValue = (val) => {
    if (!val) return null
    return String(val).trim().replace(/^["']|["']$/g, '')
  }
  
  return {
    env,
    baseUrl,
    consumerKey:    stripValue(process.env.MPESA_CONSUMER_KEY || process.env.CONSUMER_KEY),
    consumerSecret: stripValue(process.env.MPESA_CONSUMER_SECRET || process.env.CONSUMER_SECRET),
    passkey:        stripValue(process.env.MPESA_PASSKEY || process.env.PASSKEY),
    shortcode:      stripValue(process.env.MPESA_SHORTCODE || process.env.SHORTCODE) || '174379',
    callbackUrl:    stripValue(process.env.MPESA_CALLBACK_URL),
  }
}

// ---------- Phone Normalization ----------
function normalizePhone(raw) {
  if (!raw) return null
  let p = String(raw).replace(/\s+/g, '').replace(/^\+/, '')
  if (p.startsWith('0')) p = '254' + p.slice(1)
  if (p.startsWith('7') || p.startsWith('1')) p = '254' + p
  if (!/^254(7|1)\d{8}$/.test(p)) return null
  return p
}

// ---------- Timestamp in East Africa Time ----------
function timestampEAT() {
  const d = new Date(Date.now() + 3 * 60 * 60 * 1000)
  const pad = n => String(n).padStart(2, '0')
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds())
  )
}

// ---------- OAuth Token Acquisition ----------
async function getAccessToken() {
  const cfg = getConfig()
  if (!cfg.consumerKey || !cfg.consumerSecret) {
    throw new Error('Missing MPESA_CONSUMER_KEY or MPESA_CONSUMER_SECRET')
  }
  const auth = Buffer.from(`${cfg.consumerKey}:${cfg.consumerSecret}`).toString('base64')
  const res = await fetch(
    `${cfg.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${auth}` } }
  )
  const text = await res.text()
  if (!res.ok) throw new Error(`OAuth failed ${res.status}: ${text}`)
  const json = JSON.parse(text)
  if (!json.access_token) throw new Error(`No access_token in response: ${text}`)
  return json.access_token
}

// ---------- STK Push Initiation ----------
export async function initiateStkPush({ phone, amount, accountRef, description }) {
  const cfg = getConfig()
  const phoneNorm = normalizePhone(phone)
  if (!phoneNorm) throw new Error('Invalid phone number. Use 2547XXXXXXXX')
  if (!cfg.callbackUrl || !/^https:\/\//i.test(cfg.callbackUrl)) {
    throw new Error('MPESA_CALLBACK_URL must be a public HTTPS URL')
  }

  const token = await getAccessToken()
  const timestamp = timestampEAT()
  const password = Buffer
    .from(`${cfg.shortcode}${cfg.passkey}${timestamp}`)
    .toString('base64')

  const body = {
    BusinessShortCode: Number(cfg.shortcode),
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: Number(amount || GOLDEN_PRICE),
    PartyA: Number(phoneNorm),
    PartyB: Number(cfg.shortcode),
    PhoneNumber: Number(phoneNorm),
    CallBackURL: cfg.callbackUrl,
    AccountReference: String(accountRef).slice(0, 12),
    TransactionDesc: String(description || 'Payment').slice(0, 13),
  }

  const res = await fetch(`${cfg.baseUrl}/mpesa/stkpush/v1/processrequest`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { throw new Error(`Bad STK response: ${text}`) }
  if (!res.ok || json.ResponseCode !== '0') {
    throw new Error(`STK push rejected: ${json.errorMessage || json.ResponseDescription || text}`)
  }
  return {
    merchantRequestId: json.MerchantRequestID,
    checkoutRequestId: json.CheckoutRequestID,
    customerMessage: json.CustomerMessage,
    phone: phoneNorm,
  }
}

export function getGoldenPrice() {
  return GOLDEN_PRICE
}

export function getMpesaConfig() {
  return getConfig()
}

// ---------- Route Registration ----------
export function registerMpesaRoutes(app, deps = {}) {
  const { db, tickets: queueEntries } = deps
  
  if (!db || !queueEntries) {
    console.warn('[mpesa] Warning: db or queueEntries not provided')
  }

  // GET /api/mpesa/diagnose - Configuration diagnostics
  app.get('/api/mpesa/diagnose', async (req, res) => {
    try {
      const cfg = getConfig()
      const hasAllRequiredVars = cfg.consumerKey && cfg.consumerSecret && cfg.passkey && cfg.shortcode && cfg.callbackUrl
      
      let oauthTest = 'skipped'
      if (cfg.consumerKey && cfg.consumerSecret) {
        try {
          await getAccessToken()
          oauthTest = 'passed'
        } catch (err) {
          oauthTest = `failed: ${err.message}`
        }
      }

      return res.json({
        status: hasAllRequiredVars ? 'ok' : 'error',
        environment: cfg.env,
        shortcode: cfg.shortcode,
        consumerKeyPresent: !!cfg.consumerKey,
        consumerSecretPresent: !!cfg.consumerSecret,
        passkeyPresent: !!cfg.passkey,
        callbackUrl: cfg.callbackUrl,
        oauthTest,
        message: hasAllRequiredVars ? 'All configurations look correct.' : 'Missing required configuration variables',
        baseUrl: cfg.baseUrl,
      })
    } catch (err) {
      return res.status(500).json({ error: 'Diagnostics error', message: err.message })
    }
  })

  // GET /api/mpesa/pending - Monitor pending STK push payments
  app.get('/api/mpesa/pending', async (req, res) => {
    try {
      if (!db) return res.status(503).json({ error: 'Database not ready' })
      
      // Fetch all pending payment attempts
      const pendingPayments = await db
        .select({
          id: queueEntries.id,
          queueNumber: queueEntries.queueNumber,
          serviceType: queueEntries.serviceType,
          goldenTicketRef: queueEntries.goldenTicketRef,
          mpesaStatus: queueEntries.mpesaStatus,
          mpesaTransactionId: queueEntries.mpesaTransactionId,
          createdAt: queueEntries.createdAt,
          mpesaPaidAt: queueEntries.mpesaPaidAt,
        })
        .from(queueEntries)
        .where(
          and(
            sql`${queueEntries.mpesaStatus} IS NOT NULL`,
            sql`${queueEntries.mpesaTransactionId} IS NOT NULL`
          )
        )

      const summary = {
        pending: pendingPayments.filter(p => p.mpesaStatus === 'pending').length,
        successful: pendingPayments.filter(p => p.mpesaStatus === 'success').length,
        failed: pendingPayments.filter(p => p.mpesaStatus === 'failed').length,
        total: pendingPayments.length,
        payments: pendingPayments.map(p => ({
          id: p.id,
          queue: `#${p.queueNumber}`,
          ref: p.goldenTicketRef,
          status: p.mpesaStatus,
          checkoutId: p.mpesaTransactionId?.substring(0, 8) + '...', // Abbreviated for display
          initiated: p.createdAt ? new Date(p.createdAt).toLocaleTimeString() : 'N/A',
          completed: p.mpesaPaidAt ? new Date(p.mpesaPaidAt).toLocaleTimeString() : 'N/A',
        }))
      }

      console.log(`📊 Payment Monitoring: ${summary.pending} pending, ${summary.successful} successful, ${summary.failed} failed`)

      return res.json(summary)
    } catch (error) {
      console.error('Error fetching pending payments:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  })

  // GET /api/queue/:id/mpesa-status - Check M-Pesa payment status
  app.get('/api/queue/:id/mpesa-status', async (req, res) => {
    try {
      if (!db) return res.status(503).json({ error: 'Database not ready' })
      
      const { id } = req.params
      const entry = await db
        .select({
          id: queueEntries.id,
          queueNumber: queueEntries.queueNumber,
          isGolden: queueEntries.isGolden,
          goldenTicketRef: queueEntries.goldenTicketRef,
          mpesaStatus: queueEntries.mpesaStatus,
          mpesaTransactionId: queueEntries.mpesaTransactionId,
          mpesaPaidAt: queueEntries.mpesaPaidAt,
          status: queueEntries.status,
        })
        .from(queueEntries)
        .where(eq(queueEntries.id, Number(id)))
        .limit(1)
        .then(rows => rows[0] || null)

      if (!entry) {
        return res.status(404).json({ error: 'Queue entry not found' })
      }

      // Log status check for debugging
      if (entry.mpesaStatus) {
        console.log(`📊 Status check: Queue #${entry.queueNumber}, Golden=${entry.isGolden}, MpesaStatus=${entry.mpesaStatus}`)
      }

      res.json({
        id: entry.id,
        queueNumber: entry.queueNumber,
        isGolden: entry.isGolden,
        goldenTicketRef: entry.goldenTicketRef,
        mpesaStatus: entry.mpesaStatus,  // 'pending', 'success', or 'failed'
        mpesaPaidAt: entry.mpesaPaidAt,
        status: entry.status,
        // Additional feedback for frontend
        feedback: {
          isPending: entry.mpesaStatus === 'pending',
          isSuccessful: entry.isGolden && entry.mpesaStatus === 'success',
          isFailed: entry.mpesaStatus === 'failed',
          message: entry.isGolden 
            ? '✅ Golden ticket activated! You now have priority status.' 
            : entry.mpesaStatus === 'failed'
            ? '❌ Payment was cancelled or failed.'
            : '⏳ Waiting for M-Pesa response...'
        }
      })
    } catch (error) {
      console.error('Error checking M-Pesa status:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  // POST /api/queue/:id/mpesa-pay - Initiate M-Pesa STK Push
  app.post('/api/queue/:id/mpesa-pay', async (req, res) => {
    try {
      if (!db) return res.status(503).json({ error: 'Database not ready' })
      
      const { id } = req.params
      const { phoneNumber } = req.body

      const phoneNorm = normalizePhone(phoneNumber)
      if (!phoneNorm) {
        return res.status(400).json({ error: 'Invalid phone number. Use format: 2547XXXXXXXX' })
      }

      const entry = await db
        .select()
        .from(queueEntries)
        .where(eq(queueEntries.id, Number(id)))
        .limit(1)
        .then(rows => rows[0] || null)

      if (!entry) {
        return res.status(404).json({ error: 'Queue entry not found' })
      }

      if (entry.isGolden) {
        return res.status(429).json({ 
          error: 'Already upgraded',
          message: `This ticket is already a Golden Ticket (${entry.goldenTicketRef}).`
        })
      }

      if (entry.status === 'served' || entry.status === 'cancelled') {
        return res.status(400).json({ 
          error: 'Cannot upgrade',
          message: `Cannot upgrade a ${entry.status} queue entry`
        })
      }

      // Generate golden ticket reference
      const date = new Date().toISOString().split('T')[0].replace(/-/g, '')
      const sequence = await db
        .select({ count: sql`cast(count(*) as integer)` })
        .from(queueEntries)
        .where(and(
          eq(queueEntries.serviceType, entry.serviceType),
          eq(queueEntries.isGolden, true),
          sql`DATE(${queueEntries.createdAt}) = CURRENT_DATE`
        ))
        .then(rows => (rows[0]?.count ?? 0) + 1)

      const goldenTicketRef = `GT-${entry.serviceType.toUpperCase().substring(0, 3)}-${date}-${String(sequence).padStart(3, '0')}`

      try {
        const result = await initiateStkPush({
          phone: phoneNorm,
          amount: GOLDEN_PRICE,
          accountRef: goldenTicketRef,
          description: 'Golden Ticket',
        })

        // Store the checkoutRequestId for later callback matching
        await db
          .update(queueEntries)
          .set({
            goldenTicketRef,
            mpesaTransactionId: result.checkoutRequestId,  // CheckoutRequestID from Safaricom
            mpesaStatus: 'pending',  // Waiting for STK response
          })
          .where(eq(queueEntries.id, Number(id)))

        console.log(`✅ STK Push initiated for ${goldenTicketRef}`)
        console.log(`   CheckoutRequestID: ${result.checkoutRequestId}`)
        console.log(`   Phone: ${phoneNorm}, Amount: KES ${GOLDEN_PRICE}`)
        console.log(`   Queue ${id} now awaiting user PIN entry...`)

        return res.status(200).json({
          success: true,
          checkoutRequestId: result.checkoutRequestId,
          responseCode: '0',
          message: result.customerMessage || 'STK push initiated - Check your phone for M-Pesa prompt.',
          mpesaStatus: 'pending',
          goldenTicketRef,
        })
      } catch (error) {
        console.error(`❌ [STK-Pay] Failed to initiate STK push for queue ${id}:`, error.message)
        return res.status(500).json({ 
          error: 'STK push failed', 
          message: error.message 
        })
      }
    } catch (error) {
      console.error('Error initiating M-Pesa payment:', error)
      return res.status(500).json({ error: 'Internal server error', details: error.message })
    }
  })

  // POST /api/mpesa/callback - Handle M-Pesa callback from Safaricom
  app.post('/api/mpesa/callback', async (req, res) => {
    try {
      if (!db) {
        console.error('🚨 Database not ready for callback')
        return res.status(200).json({ success: false })
      }

      const callbackBody = req.body
      console.log('📞 M-Pesa Callback received from Safaricom')

      const stkCallback = callbackBody?.Body?.stkCallback || {}
      const { ResultCode, CheckoutRequestID, CallbackMetadata } = stkCallback
      const ResultDesc = stkCallback.ResultDesc || 'Unknown result'

      if (!CheckoutRequestID) {
        console.warn('⚠️ No CheckoutRequestID in callback - cannot process')
        return res.status(200).json({ success: false })
      }

      console.log(`🔍 Lookup: CheckoutRequestID = ${CheckoutRequestID}, ResultCode = ${ResultCode}`)

      // Extract metadata (transaction details, receipt number, etc.)
      let transactionDetails = {}
      if (CallbackMetadata?.Item && Array.isArray(CallbackMetadata.Item)) {
        CallbackMetadata.Item.forEach(item => {
          transactionDetails[item.Name] = item.Value
        })
      }

      const receiptNumber = transactionDetails['MpesaReceiptNumber'] || null
      const amount = transactionDetails['Amount'] || null
      const phone = transactionDetails['PhoneNumber'] || null

      // Find queue entry by checkout request ID (keep it as-is for linking)
      const entry = await db
        .select()
        .from(queueEntries)
        .where(eq(queueEntries.mpesaTransactionId, CheckoutRequestID))
        .limit(1)
        .then(rows => rows[0] || null)

      if (!entry) {
        console.warn(`⚠️ Queue entry NOT FOUND for CheckoutRequestID: ${CheckoutRequestID}`)
        // Still return 200 to acknowledge receipt from Safaricom
        return res.status(200).json({ success: false })
      }

      console.log(`📋 Found queue entry: ID=${entry.id}, GoldenRef=${entry.goldenTicketRef}, Status=${entry.mpesaStatus}`)

      // Handle payment result based on ResultCode
      if (ResultCode === 0 || ResultCode === '0') {
        // SUCCESS: ResultCode 0 = User entered PIN successfully
        console.log(`✅ M-Pesa payment SUCCESS for queue ${entry.id}`)
        console.log(`   Receipt: ${receiptNumber}, Amount: KES ${amount}, Phone: ${phone}`)

        // Prevent duplicate processing - check if already marked as success
        if (entry.mpesaStatus === 'success' && entry.isGolden) {
          console.log(`   ℹ️  Already processed as golden ticket - ignoring duplicate callback`)
          return res.status(200).json({ success: true })
        }

        // Mark ticket as golden (upgrade successful)
        await db
          .update(queueEntries)
          .set({
            isGolden: true,
            mpesaStatus: 'success',
            mpesaPaidAt: new Date(),
            // Keep CheckoutRequestID in mpesaTransactionId for reference
            // Optionally could add a receipt_number field in future
          })
          .where(eq(queueEntries.id, entry.id))

        console.log(`🎉 Golden ticket ACTIVATED: ${entry.goldenTicketRef}`)
        console.log(`   Queue #${entry.queueNumber} now has priority status`)

      } else if (ResultCode === 1 || ResultCode === '1') {
        // USER CANCELLED: ResultCode 1 = User cancelled the prompt
        console.log(`⛔ M-Pesa prompt CANCELLED by user for queue ${entry.id}`)
        
        await db
          .update(queueEntries)
          .set({
            mpesaStatus: 'failed',
          })
          .where(eq(queueEntries.id, entry.id))

        console.log(`   Status updated to 'failed' - user did not complete payment`)

      } else {
        // OTHER FAILURE: Generic failure code
        console.log(`❌ M-Pesa payment FAILED with ResultCode=${ResultCode}: ${ResultDesc}`)
        
        await db
          .update(queueEntries)
          .set({
            mpesaStatus: 'failed',
          })
          .where(eq(queueEntries.id, entry.id))

        console.log(`   Queue entry ${entry.id} payment status set to failed`)
      }

      // Always return 200 OK to Safaricom (required by their API)
      return res.status(200).json({ success: true })

    } catch (error) {
      console.error('❌ Error processing M-Pesa callback:', error.message)
      console.error('   Stack:', error.stack)
      // Still return 200 to acknowledge receipt
      return res.status(200).json({ success: false })
    }
  })

  console.log(`[mpesa] routes registered (env=${getConfig().env}, shortcode=${getConfig().shortcode})`)
}
