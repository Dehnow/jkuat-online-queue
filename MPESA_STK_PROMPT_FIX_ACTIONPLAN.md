# 🚨 FIX: M-PESA STK PROMPT NOT REACHING PHONE

## What Just Happened
Enhanced error logging was added to show exactly what M-Pesa is returning. Now you can see the actual error code and message.

## 🔴 Most Likely Culprit: SANDBOX MODE

By default, the system is in **SANDBOX MODE**. In sandbox mode:
- ❌ No real STK prompts are sent to phones
- ✅ Payment initiation returns success
- ✅ System works correctly but offline

### Quick Fix for Production Testing

**Step 1: Open Render Dashboard**
Visit: https://dashboard.render.com/web/srv-d86dsqh9rddc73bvpg60/env

**Step 2: Add These Environment Variables**

```
MPESA_SANDBOX = false
CONSUMER_KEY = [your_actual_key_from_Daraja]
CONSUMER_SECRET = [your_actual_secret_from_Daraja]
PASSKEY = [your_actual_passkey_from_M-Pesa_Online]
SHORTCODE = [your_actual_till_number_from_M-Pesa_Online]
```

**Step 3: Get Your Real Credentials**

Go to: https://developer.safaricom.co.ke/dashboard/myapps

1. Find your app
2. Click on it
3. Copy "Consumer Key" and "Consumer Secret"
4. Save to Render as `CONSUMER_KEY` and `CONSUMER_SECRET`

Then go to: https://www.safaricom.co.ke/ → M-Pesa Online

1. Find your "Passkey" (for STK Push)
2. Find your "Till Number" (Shortcode)
3. Save to Render as `PASSKEY` and `SHORTCODE`

**Step 4: Redeploy**
- Go to Render dashboard
- Click "Manual Deploy" or wait for auto-deploy
- Watch the logs: Should now show `"INFO M-Pesa Mode: PRODUCTION 🚀 (real M-Pesa)"`

**Step 5: Test**
- Try STK push again
- Phone should get real M-Pesa prompt

---

## 📊 How to Check Current Status

### In Your Render Logs, Look For:

**You'll See SANDBOX Mode If**:
```
INFO M-Pesa Mode: SANDBOX 🧪 (simulated payments)
✅ SANDBOX: STK Push initiated for GT-REG-20260530-001
```

**You'll See PRODUCTION Mode If**:
```
INFO M-Pesa Mode: PRODUCTION 🚀 (real M-Pesa)
✅ STK Push initiated (PRODUCTION): GT-REG-20260530-001
   CheckoutRequestID: 8c8a1f8c-e8af-11eb-ba7b-0242ac120002
```

### If There's an Error:
```
❌ STK Push FAILED
   Response Code: 01
   Error Message: Invalid credentials - check CONSUMER_KEY and CONSUMER_SECRET
   Phone: 254712345678
   Shortcode: 174379
   Full Response: {...}
```

---

## 🔧 Common Error Codes & Fixes

| Code | Problem | Fix |
|------|---------|-----|
| **01** | Invalid credentials | Update CONSUMER_KEY & CONSUMER_SECRET in Render |
| **08** | M-Pesa system error | Try again later |
| **14** | Invalid phone number | Use format: +254712345678 or 0712345678 |
| **20** | Invalid passkey | Update PASSKEY in Render |
| **25** | Invalid till/shortcode | Update SHORTCODE in Render |
| (none) | Using sandbox | Set MPESA_SANDBOX=false |

---

## ✅ Verification Checklist

- [ ] Logged into Render dashboard
- [ ] Viewed Environment variables section
- [ ] Have Consumer Key from Daraja
- [ ] Have Consumer Secret from Daraja
- [ ] Have Passkey from M-Pesa Online
- [ ] Have Till Number (Shortcode) from M-Pesa Online
- [ ] Added/updated all 5 environment variables
- [ ] Triggered redeploy
- [ ] Waited for "Build succeeded" message
- [ ] Checked logs for "PRODUCTION 🚀" or error details
- [ ] Tested STK push with real phone number
- [ ] Checked Render logs for the detailed error message

---

## 🚀 Next Steps

### Option 1: Quick Test (If You Have Real Credentials)
1. Add environment variables to Render
2. Redeploy
3. Test again immediately
4. Check logs for exact error

### Option 2: Verify in Development First
```bash
# Locally, set:
MPESA_SANDBOX=false
CONSUMER_KEY=your_key
CONSUMER_SECRET=your_secret
PASSKEY=your_passkey
SHORTCODE=your_till_number

# Then run:
npm run dev

# Test locally, check console for errors
```

### Option 3: Get Real Credentials
If you don't have production M-Pesa credentials yet:
1. Contact your M-Pesa account manager
2. Request Daraja API credentials
3. Request till number and passkey
4. Once received, update Render environment and redeploy

---

## 📋 Error Response Format

After your redeploy, when you test, you'll now see detailed errors like:

```json
{
  "error": "STK Push failed",
  "message": "Payment initiation failed: Invalid credentials - check CONSUMER_KEY and CONSUMER_SECRET",
  "responseCode": "01",
  "details": {
    "error_description": "The client_id or client_secret has not been encoded correctly"
  },
  "suggestions": [
    "Invalid Consumer Key or Consumer Secret",
    "Check CONSUMER_KEY and CONSUMER_SECRET in Render environment variables",
    "Verify credentials in Daraja Dashboard"
  ]
}
```

This will tell you EXACTLY what's wrong.

---

## 🆘 If You're Still Stuck

1. **Check the error code** - Use the table above
2. **Verify credentials** - Double-check each one in Daraja and M-Pesa Online
3. **Check callback URL** - Should be: `https://jkuat-online-queue.onrender.com/api/queue/mpesa-callback`
4. **Verify till number** - Make sure you're using the production till, not sandbox
5. **Test in sandbox first** - Leave `MPESA_SANDBOX=false` unset to test without real credentials

---

## 📍 Current Code Changes
- ✅ Enhanced error logging in `api-server.js`
- ✅ Enhanced error logging in `src/routes/api/queue/$id/mpesa-pay.ts`
- ✅ Added error code suggestions in error response
- ✅ Detailed M-Pesa response logging
- ✅ All changes committed and pushed

---

**Status**: 🟢 READY FOR DEPLOYMENT  
**Build**: ✅ Passes (2514 modules)  
**Error Logging**: ✅ Enhanced  
**Next**: Deploy to Render and test with real credentials

---

## Quick Links
- [Render Dashboard](https://dashboard.render.com/web/srv-d86dsqh9rddc73bvpg60/env)
- [Daraja Portal](https://developer.safaricom.co.ke/dashboard/myapps)
- [M-Pesa Online](https://www.safaricom.co.ke/)
- [STK Push Not Reaching Diagnostic](./MPESA_STK_NOT_REACHING_DIAGNOSTIC.md)
