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

  // GET /api/queue/:id/mpesa-status - Check M-Pesa payment status
  app.get('/api/queue/:id/mpesa-status', async (req, res) => {
    try {
      if (!db) return res.status(503).json({ error: 'Database not ready' })
      
      const { id } = req.params
      const entry = await db
        .select({
          id: queueEntries.id,
          isGolden: queueEntries.isGolden,
          mpesaStatus: queueEntries.mpesaStatus,
          mpesaTransactionId: queueEntries.mpesaTransactionId,
          mpesaPaidAt: queueEntries.mpesaPaidAt,
          goldenTicketRef: queueEntries.goldenTicketRef,
          status: queueEntries.status,
        })
        .from(queueEntries)
        .where(eq(queueEntries.id, Number(id)))
        .limit(1)
        .then(rows => rows[0] || null)

      if (!entry) {
        return res.status(404).json({ error: 'Queue entry not found' })
      }

      res.json(entry)
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

        await db
          .update(queueEntries)
          .set({
            goldenTicketRef,
            mpesaTransactionId: result.checkoutRequestId,
            mpesaStatus: 'pending',
          })
          .where(eq(queueEntries.id, Number(id)))

        console.log(`✅ STK Push initiated for ${goldenTicketRef}`)

        return res.status(200).json({
          success: true,
          checkoutRequestId: result.checkoutRequestId,
          responseCode: '0',
          message: result.customerMessage || 'STK push initiated - Check your phone for M-Pesa prompt.',
          mpesaStatus: 'pending',
          goldenTicketRef,
        })
      } catch (error) {
        console.error('[mpesa-pay]', error.message)
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
      console.log('📞 M-Pesa Callback received')

      const stkCallback = callbackBody?.Body?.stkCallback || {}
      const { ResultCode, CheckoutRequestID, CallbackMetadata } = stkCallback
      const ResultDesc = stkCallback.ResultDesc || 'Unknown result'

      if (!CheckoutRequestID) {
        console.warn('⚠️ No CheckoutRequestID in callback')
        return res.status(200).json({ success: false })
      }

      // Extract metadata
      let transactionDetails = {}
      if (CallbackMetadata?.Item) {
        CallbackMetadata.Item.forEach(item => {
          transactionDetails[item.Name] = item.Value
        })
      }

      // Find queue entry by checkout request ID
      let queueEntryId = null
      const entries = await db
        .select()
        .from(queueEntries)
        .where(eq(queueEntries.mpesaTransactionId, CheckoutRequestID))
        .limit(1)
        .then(rows => rows[0] || null)
      
      if (entries) {
        queueEntryId = entries.id
      }

      if (!queueEntryId) {
        console.warn(`⚠️ Could not find queue entry for checkout: ${CheckoutRequestID}`)
        return res.status(200).json({ success: false })
      }

      // Handle payment result
      if (ResultCode === 0) {
        const receiptNumber = transactionDetails['MpesaReceiptNumber'] || 'UNKNOWN'
        
        const entry = await db
          .select()
          .from(queueEntries)
          .where(eq(queueEntries.id, queueEntryId))
          .limit(1)
          .then(rows => rows[0])

        if (entry && !entry.isGolden) {
          // Mark as golden
          await db
            .update(queueEntries)
            .set({
              isGolden: true,
              mpesaTransactionId: receiptNumber,
              mpesaStatus: 'success',
              mpesaPaidAt: new Date(),
            })
            .where(eq(queueEntries.id, queueEntryId))

          console.log(`✅ Golden ticket activated: ${entry.goldenTicketRef} (Receipt: ${receiptNumber})`)
        }
      } else {
        // Payment failed
        await db
          .update(queueEntries)
          .set({
            mpesaStatus: 'failed',
          })
          .where(eq(queueEntries.id, queueEntryId))

        console.log(`❌ M-Pesa payment failed: ${ResultDesc}`)
      }

      return res.status(200).json({ success: true })
    } catch (error) {
      console.error('Error processing M-Pesa callback:', error)
      return res.status(200).json({ success: false })
    }
  })

  console.log(`[mpesa] routes registered (env=${getConfig().env}, shortcode=${getConfig().shortcode})`)
}
