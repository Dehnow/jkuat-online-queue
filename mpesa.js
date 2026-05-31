// mpesa.js — Drop-in M-Pesa Daraja STK Push module for your Express api-server.js
// =================================================================================
// Usage in api-server.js:
//
//   import { registerMpesaRoutes } from './mpesa.js'
//   registerMpesaRoutes(app, { db, tickets }) // pass your drizzle db + tickets table
//
// Required env vars (you already have these on Render):
//   MPESA_ENVIRONMENT      = sandbox | production
//   MPESA_CONSUMER_KEY     = ...
//   MPESA_CONSUMER_SECRET  = ...
//   MPESA_PASSKEY          = ...
//   MPESA_SHORTCODE        = 174379 (sandbox) or your paybill/till (prod)
//   MPESA_CALLBACK_URL     = https://jkuat-online-queue.onrender.com/api/mpesa/callback
//
// Notes / why the prompt was not reaching the phone:
//   1. Sandbox base URL is https://sandbox.safaricom.co.ke (NOT api.safaricom.co.ke)
//   2. Phone MUST be 2547XXXXXXXX or 2541XXXXXXXX — strip leading "+" and "0"
//   3. Password = Base64(Shortcode + Passkey + Timestamp). Timestamp = YYYYMMDDHHmmss in EAT
//   4. CallbackURL MUST be HTTPS and publicly reachable (localhost will NOT trigger prompt)
//   5. In sandbox, only the test MSISDN 254708374149 reliably receives the STK push
//   6. TransactionType for paybill 174379 = "CustomerPayBillOnline"

const GOLDEN_PRICE = 50 // KES — change to match your business rule

// ---------- helpers ----------
function getConfig() {
  const env = (process.env.MPESA_ENVIRONMENT || 'sandbox').toLowerCase()
  const baseUrl = env === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke'
  return {
    env,
    baseUrl,
    consumerKey:    process.env.MPESA_CONSUMER_KEY    || process.env.CONSUMER_KEY,
    consumerSecret: process.env.MPESA_CONSUMER_SECRET || process.env.CONSUMER_SECRET,
    passkey:        process.env.MPESA_PASSKEY        || process.env.PASSKEY,
    shortcode:      process.env.MPESA_SHORTCODE      || process.env.SHORTCODE || '174379',
    callbackUrl:    process.env.MPESA_CALLBACK_URL,
  }
}

function normalizePhone(raw) {
  if (!raw) return null
  let p = String(raw).replace(/\s+/g, '').replace(/^\+/, '')
  if (p.startsWith('0')) p = '254' + p.slice(1)
  if (p.startsWith('7') || p.startsWith('1')) p = '254' + p
  if (!/^254(7|1)\d{8}$/.test(p)) return null
  return p
}

function timestampEAT() {
  // EAT = UTC+3. Format: YYYYMMDDHHmmss
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

async function getAccessToken() {
  const cfg = getConfig()
  if (!cfg.consumerKey || !cfg.consumerSecret) {
    throw new Error('Missing MPESA_CONSUMER_KEY / MPESA_CONSUMER_SECRET')
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
    TransactionType: 'CustomerPayBillOnline', // use 'CustomerBuyGoodsOnline' for Till
    Amount: Number(amount),
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

// ---------- in-memory status store (swap for DB column if you persist it) ----------
// status: 'pending' | 'success' | 'failed'
const txByTicket = new Map()       // ticketId -> { status, checkoutRequestId, phone, amount, resultDesc }
const ticketByCheckout = new Map() // CheckoutRequestID -> ticketId

// ---------- routes ----------
export function registerMpesaRoutes(app, deps = {}) {
  const { db, tickets } = deps // optional: drizzle handles

  // 1) Initiate STK push
  app.post('/api/queue/:ticketId/mpesa-pay', async (req, res) => {
    const ticketId = Number(req.params.ticketId)
    const { phoneNumber } = req.body || {}
    if (!ticketId) return res.status(400).json({ error: 'Invalid ticket id' })

    const existing = txByTicket.get(ticketId)
    if (existing && existing.status === 'success') {
      return res.status(429).json({ error: 'Ticket already upgraded' })
    }

    try {
      const r = await initiateStkPush({
        phone: phoneNumber,
        amount: GOLDEN_PRICE,
        accountRef: `T${ticketId}`,
        description: 'Golden',
      })

      txByTicket.set(ticketId, {
        status: 'pending',
        checkoutRequestId: r.checkoutRequestId,
        phone: r.phone,
        amount: GOLDEN_PRICE,
        resultDesc: null,
      })
      ticketByCheckout.set(r.checkoutRequestId, ticketId)

      return res.json({
        mpesaStatus: 'pending',
        checkoutRequestId: r.checkoutRequestId,
        message: r.customerMessage,
      })
    } catch (err) {
      console.error('[mpesa-pay]', err)
      return res.status(500).json({ error: 'STK push failed', message: err.message })
    }
  })

  // 2) Poll status
  app.get('/api/queue/:ticketId/mpesa-status', (req, res) => {
    const ticketId = Number(req.params.ticketId)
    const tx = txByTicket.get(ticketId)
    if (!tx) return res.json({ mpesaStatus: 'unknown' })
    return res.json({
      mpesaStatus: tx.status,
      resultDesc: tx.resultDesc,
    })
  })

  // 3) Daraja callback — MUST be reachable at MPESA_CALLBACK_URL
  app.post('/api/mpesa/callback', async (req, res) => {
    try {
      const stk = req.body?.Body?.stkCallback
      if (!stk) {
        console.warn('[mpesa/callback] unexpected payload', JSON.stringify(req.body))
        return res.json({ ResultCode: 0, ResultDesc: 'Accepted' })
      }
      const { CheckoutRequestID, ResultCode, ResultDesc } = stk
      const ticketId = ticketByCheckout.get(CheckoutRequestID)
      console.log('[mpesa/callback]', { CheckoutRequestID, ResultCode, ResultDesc, ticketId })

      if (ticketId) {
        const tx = txByTicket.get(ticketId) || {}
        tx.status = ResultCode === 0 ? 'success' : 'failed'
        tx.resultDesc = ResultDesc
        txByTicket.set(ticketId, tx)

        // OPTIONAL: persist to your DB
        if (db && tickets && ResultCode === 0) {
          try {
            const { eq } = await import('drizzle-orm')
            await db.update(tickets)
              .set({ isGolden: true })           // adjust to your schema
              .where(eq(tickets.id, ticketId))
          } catch (e) {
            console.error('[mpesa/callback] db update failed', e)
          }
        }
      }
      return res.json({ ResultCode: 0, ResultDesc: 'Accepted' })
    } catch (err) {
      console.error('[mpesa/callback] error', err)
      return res.json({ ResultCode: 0, ResultDesc: 'Accepted' }) // always 200 to Daraja
    }
  })

  console.log(`[mpesa] routes registered (env=${getConfig().env}, shortcode=${getConfig().shortcode})`)
}
