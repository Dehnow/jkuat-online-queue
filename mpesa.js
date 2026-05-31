// mpesa.js — Drop-in M-Pesa Daraja STK Push module for your Express api-server.js
// =================================================================================
// This module provides helper functions for M-Pesa STK Push integration.
// Use initiateStkPush() to trigger STK prompts from your existing routes.

const GOLDEN_PRICE = 50 // KES

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
    TransactionType: 'CustomerPayBillOnline',
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

export function getGoldenPrice() {
  return GOLDEN_PRICE
}

export function getMpesaConfig() {
  return getConfig()
}
