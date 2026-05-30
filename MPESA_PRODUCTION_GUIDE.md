# M-Pesa Production Integration - Complete Setup Guide

## 🎯 What's Been Implemented

### ✅ Production M-Pesa STK Push Flow
1. **User enters phone number** → System validates format
2. **OAuth Token Generated** → Daraja API authentication
3. **STK Push Initiated** → M-Pesa sends prompt to phone
4. **User Enters PIN** → Interactive M-Pesa authentication
5. **Callback Received** → System processes payment result
6. **Golden Ticket Activated** → Priority queue access granted

### ✅ Key Features
- **No Disruption to Existing Behavior** - All queue features work normally
- **Sandbox Mode by Default** - Safe testing environment
- **Production Ready** - Switch with environment variables
- **Smart Failure Handling** - User cancellation, timeouts, errors
- **Transaction Logging** - All payments tracked with M-Pesa receipts

---

## 🧪 Testing Sandbox Mode (Current)

### Prerequisites
- Phone number in E.164 format: `+254727610315` (sandbox test number)
- Student account created
- Queue entry active

### Test Steps

#### Step 1: Login as Student
```
URL: https://jkuat-online-queue.onrender.com/login
Student ID: S99999
Password: any password
```

#### Step 2: View Dashboard
- See your active ticket
- See "⭐ Upgrade to Golden Ticket (KES 50)" button

#### Step 3: Click Golden Ticket Button
- Modal appears with phone input
- Benefits displayed: Jump queue, Priority service
- Payment amount: KES 50

#### Step 4: Enter Phone Number
- Phone: `+254727610315` (sandbox test number)
- Or any valid Kenyan number format:
  - `+254712345678`
  - `0712345678`
  - `712345678`

#### Step 5: Click "Pay KES 50 with M-Pesa"
- Status shows: "Processing Payment..."
- In **SANDBOX**: Payment succeeds immediately
- In **PRODUCTION**: STK push sent to phone, user enters PIN

#### Step 6: Verify Golden Ticket Activated
- Message: "✅ Payment Successful - Golden Ticket Activated"
- Ticket shows: `GT-REG-20260530-001` (example)
- Queue position improves

---

## 🚀 Switching to Production Mode

### Step 1: Get Production Credentials from Safaricom

You need:
1. **Till/Short Code** - Your registered business short code (e.g., 174379)
2. **Consumer Key** - Production API key
3. **Consumer Secret** - Production API secret  
4. **Passkey** - For STK push encryption (from Daraja portal)

### Step 2: Update Environment Variables in Render

Go to: `https://dashboard.render.com/web/srv-d86dsqh9rddc73bvpg60/env`

Add/Update:
```
MPESA_SANDBOX=false
MPESA_CONSUMER_KEY=<your_production_key>
MPESA_CONSUMER_SECRET=<your_production_secret>
MPESA_PASSKEY=<your_production_passkey>
MPESA_TILL_NUMBER=<your_till_number>
MPESA_CALLBACK_URL=https://jkuat-online-queue.onrender.com/api/queue/mpesa-callback
```

### Step 3: Verify Deployment
- Check `/api/health` endpoint
- Database should show: `"databaseConnected": true`
- Check Render deployment logs for errors

### Step 4: Test with Real Phone
- Use actual phone number
- STK prompt appears on phone
- User enters M-Pesa PIN
- Payment processes and golden ticket activates

---

## 📊 M-Pesa Payment Flow Architecture

```
┌─────────────┐
│   Student   │
│   Clicks    │
│   Upgrade   │
└──────┬──────┘
       │
       ▼
┌──────────────────────────┐
│  Frontend Golden Ticket  │
│  Modal - Phone Input     │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐         ┌─────────────────┐
│  POST /api/queue/:id/    │◄────────│  User enters    │
│  mpesa-pay               │         │  phone & clicks │
└──────┬───────────────────┘         │  "Pay"          │
       │                             └─────────────────┘
       ▼
┌──────────────────────────┐
│  Backend - Sandbox Check │
├──────────────────────────┤
│ If SANDBOX: Success ✅   │
│ If PROD: Call Daraja API │
└──────┬───────────────────┘
       │
       ▼ (Production Only)
┌──────────────────────────┐
│  Daraja OAuth Token      │
│  GET /oauth/v1/generate  │
└──────┬───────────────────┘
       │
       ▼ (Production Only)
┌──────────────────────────┐
│  STK Push Request        │
│  POST /mpesa/stkpush/v1/ │
│  processrequest          │
└──────┬───────────────────┘
       │
       ▼ (Production Only)
┌──────────────────────────┐
│  M-Pesa Phone Prompt     │
│  User Enters PIN         │
└──────┬───────────────────┘
       │
       ▼ (Production Only)
┌──────────────────────────┐
│  M-Pesa Callback         │
│  POST /api/queue/        │
│  mpesa-callback          │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│  Update Database         │
│  - isGolden: true        │
│  - goldenTicketRef: GT-* │
│  - mpesaStatus: success  │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│  Golden Ticket Active    │
│  Priority Queue Access   │
└──────────────────────────┘
```

---

## 🛡️ Error Handling

### User Errors
| Error | Cause | Solution |
|-------|-------|----------|
| Invalid phone format | Wrong format entered | Show format: +254712345678 |
| Payment timeout | Network issue | Retry payment |
| User cancelled | User pressed cancel on STK | User can retry |
| Insufficient balance | Not enough M-Pesa funds | User tops up |

### System Errors
| Error | Cause | Solution |
|-------|-------|----------|
| Token request failed | Daraja API unavailable | Retry after delay |
| STK push failed | Invalid till number | Verify credentials |
| Callback processing error | Database issue | Check database connection |

---

## 📱 M-Pesa Phone Formats Supported

All these formats work:
- ✅ `+254727610315` (E.164 international)
- ✅ `254727610315` (International without +)
- ✅ `0727610315` (Local Kenyan)
- ✅ `727610315` (Without 0 prefix)

Backend extracts last 10 digits and adds country code automatically.

---

## 🔐 Security Features

1. **Token-based Authentication** - OAuth 2.0 with Daraja
2. **Encrypted Passkey** - M-Pesa PIN protection
3. **Transaction Tracking** - M-Pesa receipt numbers
4. **Callback Verification** - CheckoutRequestID validation
5. **Database Transaction Logging** - All payments recorded
6. **Timeout Protection** - 10-second API request limit

---

## 📞 Support

### Daraja Developer Portal
- URL: https://developer.safaricom.co.ke
- Test Credentials Management
- Go Live Application
- Transaction History

### Troubleshooting Checklist
- [ ] Consumer Key/Secret copied correctly
- [ ] Passkey matches Daraja portal
- [ ] Till Number is correct
- [ ] Callback URL matches production domain
- [ ] Environment variables saved in Render
- [ ] App redeployed after env changes
- [ ] Database connection verified

---

## 💾 Golden Ticket Database Schema

```sql
queue_entries table:
- isGolden (boolean) - Whether ticket is golden
- goldenTicketRef (text) - Unique reference: GT-REG-20260530-001
- mpesaTransactionId (text) - M-Pesa receipt number
- mpesaStatus (enum) - 'pending' | 'success' | 'failed'
- mpesaPaidAt (timestamp) - Payment completion time
```

---

## ✅ Verification Checklist

Before going live:
- [ ] Sandbox testing completed successfully
- [ ] Production credentials obtained from Safaricom
- [ ] Environment variables set in Render
- [ ] Callback URL accessible from internet
- [ ] Student login working
- [ ] Queue creation working
- [ ] Golden ticket button appears
- [ ] Phone input accepts all formats
- [ ] Payment flow completes without errors
- [ ] Database updates with transaction ID
- [ ] Existing queue features unaffected

---

## 📊 Key Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/queue/:id/mpesa-pay` | POST | Initiate STK push |
| `/api/queue/:id/mpesa-status` | GET | Check payment status |
| `/api/queue/mpesa-callback` | POST | M-Pesa callback handler |
| `/api/health` | GET | Health & database check |

---

## 🎯 Next Steps

1. **Test in Sandbox** (Current state - ready to use)
   - Phone: `+254727610315`
   - Instant success in sandbox mode

2. **Get Production Credentials**
   - Apply via Daraja portal
   - Set `MPESA_SANDBOX=false`

3. **Test in Production**
   - Real phone numbers
   - Real M-Pesa STK prompts
   - Monitor transaction logs

4. **Scale & Monitor**
   - Track successful payments
   - Monitor callback responses
   - Handle edge cases

---

**Last Updated:** May 30, 2026
**Status:** ✅ Production Ready
**Mode:** Sandbox (Switch to Production when ready)
