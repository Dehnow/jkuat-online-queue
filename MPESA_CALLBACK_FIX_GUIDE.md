# 🔥 M-PESA CALLBACK & STK INITIALIZATION FIXES

## Analysis of Your Current Implementation

### ✅ WORKING CORRECTLY

1. **Auto-Detection**: Correctly detects sandbox vs production mode
2. **Phone Number Formatting**: Properly converts to 254XXXXXXXXX format
3. **Password Generation**: Correctly generates base64(shortcode + passkey + timestamp)
4. **Retry Logic**: Implements exponential backoff for token and STK push
5. **Callback Handler**: Properly receives and parses M-Pesa callback
6. **Idempotency**: Prevents double-processing of same transaction
7. **Status Management**: Correctly sets `mpesaStatus: 'pending'` → `'success'` or `'failed'`

---

## 🔴 CRITICAL ISSUES FOUND & FIXED

### ISSUE #1: Callback URL Not Verified as Reachable
**Severity**: 🔴 CRITICAL  
**Impact**: STK prompts appear to work, but payments don't complete

**Problem**:
```typescript
// Your current code:
const MPESA_CALLBACK_URL = process.env.CALLBACK_URL || 
  process.env.MPESA_CALLBACK_URL || 
  'https://jkuat-online-queue.onrender.com/api/queue/mpesa-callback'
```

**Issue**: 
- No verification that callback URL is reachable
- If URL is wrong, M-Pesa can't return payment results
- System has no way to know if callback is failing

**Fix**:
```typescript
// Add validation function
async function verifyCallbackUrl() {
  try {
    const testResponse = await fetch(MPESA_CALLBACK_URL, {
      method: 'OPTIONS',  // Just check if endpoint exists
      timeout: 5000,
    })
    
    if (testResponse.status === 404) {
      console.error(`❌ CALLBACK URL UNREACHABLE: ${MPESA_CALLBACK_URL}`)
      console.error('   STK Push will fail! M-Pesa cannot reach your callback endpoint.')
      throw new Error('Callback URL not reachable')
    }
    
    console.log(`✅ Callback URL verified: ${MPESA_CALLBACK_URL}`)
  } catch (error) {
    console.error(`⚠️  WARNING: Could not verify callback URL: ${error}`)
    // Continue anyway, but warn
  }
}

// Call on startup
verifyCallbackUrl()
```

---

### ISSUE #2: Callback Must Always Return 200 OK
**Severity**: 🔴 CRITICAL  
**Impact**: M-Pesa won't retry if callback returns error status

**Problem**:
```typescript
// Your current code returns 404 if entry not found
if (!entry) {
  return json({
    success: false,
    message: 'Queue entry not found',
  }, { status: 404 })  // ❌ WRONG! This breaks callback flow
}
```

**Issue**: 
- M-Pesa sends callback expecting 200 OK
- If you return 404/500, M-Pesa doesn't retry
- Payment gets stuck in limbo

**Fix**:
```typescript
// ALWAYS return 200 OK - let M-Pesa complete its request
if (!entry) {
  console.error(`❌ Queue entry not found: ${goldenTicketRef}`)
  // Log the error but still return 200 OK
  return json({
    success: true,  // ✅ Always true for M-Pesa
    message: 'Callback received and queued for processing',
    // Internal note - don't send to M-Pesa
    _note: 'Queue entry not found - may retry',
  }, { status: 200 })  // ✅ ALWAYS 200 OK
}
```

---

### ISSUE #3: AccountReference May Not Match Exactly
**Severity**: 🟡 HIGH  
**Impact**: Callback can't find queue entry

**Problem**:
```typescript
// Your code looks for exact goldenTicketRef match
const entry = await db.query.queueEntries.findFirst({
  where: eq(queueEntries.goldenTicketRef, goldenTicketRef),
})
```

**Issue**:
- If goldenTicketRef not in callback metadata, lookup fails
- Different M-Pesa implementations may send different field names
- Empty string vs null causes lookup to fail

**Fix**:
```typescript
// Try multiple lookup strategies
let entry = null

// Strategy 1: Try by goldenTicketRef
if (goldenTicketRef) {
  entry = await db.query.queueEntries.findFirst({
    where: eq(queueEntries.goldenTicketRef, goldenTicketRef),
  })
}

// Strategy 2: Try by CheckoutRequestID
if (!entry && CheckoutRequestID) {
  entry = await db.query.queueEntries.findFirst({
    where: eq(queueEntries.mpesaTransactionId, CheckoutRequestID),
  })
}

// Strategy 3: Try by MpesaReceiptNumber
if (!entry && mpesaTransactionId && mpesaTransactionId !== CheckoutRequestID) {
  entry = await db.query.queueEntries.findFirst({
    where: eq(queueEntries.mpesaTransactionId, mpesaTransactionId),
  })
}

if (!entry) {
  console.warn(`⚠️  No entry found. Trying by any pending transaction...`)
  // Last resort: find ANY pending transaction for this phone number
  entry = await db.query.queueEntries.findFirst({
    where: and(
      eq(queueEntries.mpesaStatus, 'pending'),
      // Would need phone number in metadata
    ),
  })
}
```

---

### ISSUE #4: Missing mpesaPaidAt Field in Schema
**Severity**: 🟡 MEDIUM  
**Impact**: Can't track payment completion time

**Problem**:
```typescript
// Your callback tries to set mpesaPaidAt
mpesaPaidAt: new Date(),  // ❌ May not be in schema
```

**Fix**: Verify schema has this field:
```typescript
// db/schema.ts should have:
mpesaPaidAt: timestamp('mpesa_paid_at'),  // Add if missing
```

---

### ISSUE #5: CallbackURL May Not Be HTTPS
**Severity**: 🔴 CRITICAL  
**Impact**: M-Pesa rejects callback URL

**Problem**:
```typescript
const MPESA_CALLBACK_URL = process.env.CALLBACK_URL || 
  'http://localhost:3000/...'  // ❌ HTTP not allowed
```

**M-Pesa Requirement**: 
- Callback URL MUST be HTTPS
- Callback URL MUST be publicly accessible
- Callback URL MUST be a valid domain

**Fix**:
```typescript
// Validate callback URL
if (MPESA_CALLBACK_URL.startsWith('http://')) {
  console.error('❌ CALLBACK URL MUST BE HTTPS!')
  console.error('   Current: ' + MPESA_CALLBACK_URL)
  console.error('   M-Pesa will reject this URL!')
}

// Use environment-specific URLs
const MPESA_CALLBACK_URL = process.env.CALLBACK_URL || 
  (process.env.NODE_ENV === 'production'
    ? 'https://jkuat-online-queue.onrender.com/api/queue/mpesa-callback'
    : 'https://webhook.site/your-unique-id')  // Use ngrok or webhook.site for testing
```

---

### ISSUE #6: ResultCode Type Handling
**Severity**: 🟡 MEDIUM  
**Impact**: May incorrectly handle payment status

**Problem**:
```typescript
// M-Pesa may send ResultCode as string or number
const resultCodeNum = Number(ResultCode)
if (resultCodeNum === 0) { ... }
```

**Fix** (already in your code): ✅ Correct

---

### ISSUE #7: Callback Metadata Structure Varies
**Severity**: 🟡 MEDIUM  
**Impact**: May fail to extract payment details

**Problem**:
```typescript
// Your code assumes specific structure
if (CallbackMetadata?.Item) {
  const items = Array.isArray(CallbackMetadata.Item) 
    ? CallbackMetadata.Item 
    : [CallbackMetadata.Item]
```

**Better approach**:
```typescript
// Defensive parsing
function extractCallbackMetadata(metadata: any) {
  const result = {
    accountReference: '',
    amount: 0,
    mpesaReceiptNumber: '',
    phoneNumber: '',
  }
  
  try {
    if (!metadata?.Item) return result
    
    const items = Array.isArray(metadata.Item) 
      ? metadata.Item 
      : [metadata.Item]
    
    items.forEach((item: any) => {
      const name = String(item?.Name || '').toLowerCase()
      const value = item?.Value
      
      if (name.includes('account') || name.includes('reference')) {
        result.accountReference = String(value || '')
      }
      if (name.includes('amount')) {
        result.amount = Number(value || 0)
      }
      if (name.includes('receipt') || name.includes('transactionid')) {
        result.mpesaReceiptNumber = String(value || '')
      }
      if (name.includes('phone') || name.includes('msisdn')) {
        result.phoneNumber = String(value || '')
      }
    })
  } catch (error) {
    console.warn('Error parsing callback metadata:', error)
  }
  
  return result
}

const metadata = extractCallbackMetadata(CallbackMetadata)
```

---

## 🔧 COMPREHENSIVE FIX - CODE CHANGES

### File: `src/routes/api/queue/mpesa-callback.ts`

Replace the entire file with this improved version:

```typescript
import { json } from '@tanstack/start'
import { db } from '../../../db/index'
import { queueEntries } from '../../../db/schema'
import { eq } from 'drizzle-orm'

// Helper: Extract callback metadata safely
function extractCallbackMetadata(metadata: any) {
  const result = {
    accountReference: '',
    amount: 0,
    mpesaReceiptNumber: '',
    phoneNumber: '',
  }
  
  try {
    if (!metadata?.Item) return result
    const items = Array.isArray(metadata.Item) ? metadata.Item : [metadata.Item]
    
    items.forEach((item: any) => {
      const name = String(item?.Name || '').toLowerCase()
      const value = item?.Value
      
      if (name.includes('account') || name.includes('reference')) {
        result.accountReference = String(value || '')
      }
      if (name.includes('amount')) {
        result.amount = Number(value || 0)
      }
      if (name.includes('receipt') || name.includes('transactionid')) {
        result.mpesaReceiptNumber = String(value || '')
      }
      if (name.includes('phone')) {
        result.phoneNumber = String(value || '')
      }
    })
  } catch (error) {
    console.warn('⚠️  Error parsing callback metadata:', error)
  }
  
  return result
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const result = body.Body?.stkCallback || {}

    const {
      MerchantRequestID,
      CheckoutRequestID,
      ResultCode,
      ResultDesc,
      CallbackMetadata,
    } = result

    console.log('🔔 M-Pesa Callback Received')
    console.log(`   CheckoutRequestID: ${CheckoutRequestID}`)
    console.log(`   ResultCode: ${ResultCode}`)
    console.log(`   ResultDesc: ${ResultDesc}`)

    // Normalize ResultCode
    const resultCodeNum = Number(ResultCode)

    // Extract metadata safely
    const metadata = extractCallbackMetadata(CallbackMetadata)
    const goldenTicketRef = metadata.accountReference
    const mpesaAmount = metadata.amount
    const mpesaTransactionId = metadata.mpesaReceiptNumber || CheckoutRequestID

    console.log(`   GoldenTicketRef: ${goldenTicketRef}`)
    console.log(`   Amount: ${mpesaAmount}`)
    console.log(`   ReceiptNumber: ${mpesaTransactionId}`)

    // STRATEGY: Try multiple lookup methods
    let entry = null

    // Method 1: By golden ticket ref
    if (goldenTicketRef) {
      entry = await db.query.queueEntries.findFirst({
        where: eq(queueEntries.goldenTicketRef, goldenTicketRef),
      })
      if (entry) console.log(`✅ Found entry by goldenTicketRef: ${goldenTicketRef}`)
    }

    // Method 2: By CheckoutRequestID
    if (!entry && CheckoutRequestID) {
      entry = await db.query.queueEntries.findFirst({
        where: eq(queueEntries.mpesaTransactionId, CheckoutRequestID),
      })
      if (entry) console.log(`✅ Found entry by CheckoutRequestID: ${CheckoutRequestID}`)
    }

    // Method 3: By MpesaReceiptNumber
    if (!entry && mpesaTransactionId && mpesaTransactionId !== CheckoutRequestID) {
      entry = await db.query.queueEntries.findFirst({
        where: eq(queueEntries.mpesaTransactionId, mpesaTransactionId),
      })
      if (entry) console.log(`✅ Found entry by ReceiptNumber: ${mpesaTransactionId}`)
    }

    if (!entry) {
      console.warn(`⚠️  No queue entry found`)
      console.warn(`   Searched: goldenTicketRef="${goldenTicketRef}", CheckoutID="${CheckoutRequestID}", Receipt="${mpesaTransactionId}"`)
      console.warn(`   Will not be able to update database, but returning 200 OK to M-Pesa`)
      
      // ✅ ALWAYS return 200 OK - M-Pesa must complete its request
      return json({
        success: true,
        message: 'Callback received',
      }, { status: 200 })
    }

    console.log(`✅ Queue entry found: ID=${entry.id}, Status=${entry.mpesaStatus}`)

    // CRITICAL: Prevent double-processing
    if (entry.mpesaStatus === 'success' || entry.mpesaStatus === 'failed') {
      console.warn(`⚠️  Transaction already processed with status: ${entry.mpesaStatus}`)
      return json({
        success: true,
        message: 'Callback already processed',
      }, { status: 200 })
    }

    // Handle payment result
    if (resultCodeNum === 0) {
      // ✅ PAYMENT SUCCESSFUL
      console.log(`✅ Payment successful for queue ${entry.id}`)

      const updateResult = await db.update(queueEntries)
        .set({
          isGolden: true,  // 🔥 CRITICAL: Mark as golden ticket
          mpesaStatus: 'success',
          mpesaTransactionId: mpesaTransactionId,
          mpesaPaidAt: new Date(),
        })
        .where(eq(queueEntries.id, entry.id))

      console.log(`✅ Database updated: Queue ${entry.id} is now a GOLDEN TICKET`)
      console.log(`   Reference: ${goldenTicketRef}`)
      console.log(`   Amount: KES ${mpesaAmount}`)
      console.log(`   Receipt: ${mpesaTransactionId}`)

      // ✅ ALWAYS return 200 OK
      return json({
        success: true,
        message: 'Payment processed successfully',
        queueId: entry.id,
        goldenTicketRef: goldenTicketRef,
      }, { status: 200 })
    } else if (resultCodeNum === 1 || resultCodeNum === 2) {
      // ❌ USER CANCELLED or INCOMPLETE
      console.log(`⚠️  Payment cancelled/incomplete for queue ${entry.id}: ${ResultDesc}`)

      await db.update(queueEntries)
        .set({
          mpesaStatus: 'failed',
          mpesaTransactionId: mpesaTransactionId,
        })
        .where(eq(queueEntries.id, entry.id))

      // ✅ ALWAYS return 200 OK
      return json({
        success: true,
        message: 'Callback received',
      }, { status: 200 })
    } else {
      // ❌ OTHER ERROR
      console.error(`❌ Payment failed for queue ${entry.id}: ResultCode=${resultCodeNum}`)

      await db.update(queueEntries)
        .set({
          mpesaStatus: 'failed',
          mpesaTransactionId: mpesaTransactionId,
        })
        .where(eq(queueEntries.id, entry.id))

      // ✅ ALWAYS return 200 OK
      return json({
        success: true,
        message: 'Callback received',
      }, { status: 200 })
    }
  } catch (error) {
    console.error('❌ M-PESA callback error:', error)
    
    // ✅ ALWAYS return 200 OK even on error
    // This prevents M-Pesa from retrying forever
    return json({
      success: true,
      message: 'Callback received',
    }, { status: 200 })
  }
}
```

---

## ✅ VERIFICATION CHECKLIST

Before deploying:

- [ ] Callback endpoint returns 200 OK in all cases
- [ ] Callback URL is HTTPS (not HTTP)
- [ ] Callback URL is publicly accessible from internet
- [ ] Callback handler uses multiple lookup strategies
- [ ] Database schema has all required fields
- [ ] mpesaPaidAt field exists in schema
- [ ] Auto-detection correctly identifies production mode
- [ ] Phone number formatting handles all formats
- [ ] Password calculation is correct
- [ ] Retry logic has exponential backoff
- [ ] STK push sets mpesaStatus to 'pending'
- [ ] Golden ticket only set on successful callback (ResultCode 0)
- [ ] Idempotency prevents duplicate processing

---

## 🚀 DEPLOYMENT STEPS

1. **Update callback handler** with the fixed code above
2. **Verify callback URL** is reachable:
   ```bash
   curl -X POST https://jkuat-online-queue.onrender.com/api/queue/mpesa-callback \
     -H "Content-Type: application/json" \
     -d '{"test":"callback"}'
   ```
3. **Deploy to Render** via GitHub push
4. **Set environment variables** in Render dashboard with real M-Pesa credentials
5. **Test STK push** with real phone number
6. **Monitor logs** for callback reception and database updates

---

**Key Takeaway**: 
- Always return 200 OK from callback (M-Pesa won't retry otherwise)
- Try multiple lookup strategies (references may vary)
- Use HTTPS for callback URL (M-Pesa requirement)
- Set golden ticket flag only on successful callback

