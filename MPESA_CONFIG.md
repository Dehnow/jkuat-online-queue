# M-PESA Configuration Guide

## Sandbox Credentials (For Testing)

These are pre-configured for testing purposes:

```env
MPESA_SANDBOX=true
MPESA_CONSUMER_KEY=<your_sandbox_consumer_key>
MPESA_CONSUMER_SECRET=<your_sandbox_consumer_secret>
MPESA_SHORTCODE=174379
MPESA_PASSKEY=bfb279f9ba9b9d1380007480bbe7f27425e1aa6d4ede3891ec337007a74ff42
MPESA_CALLBACK_URL=https://your-domain.local/api/queue/mpesa-callback
```

### Sandbox Details
- **Business Short Code**: 174379
- **Passkey**: `bfb279f9ba9b9d1380007480bbe7f27425e1aa6d4ede3891ec337007a74ff42`
- **Test Phone Number**: Any number in format 254XXXXXXXXX
- **Base URL**: https://sandbox.safaricom.co.ke
- **Default Amount**: 1 KES (for testing)

### Getting Sandbox Consumer Key & Secret

1. Go to [Daraja API Console](https://developer.safaricom.co.ke)
2. Login or create account
3. Create new app
4. Get Consumer Key and Consumer Secret
5. Add to your `.env` file

## Production Credentials (Live)

```env
NODE_ENV=production
MPESA_SANDBOX=false
MPESA_CONSUMER_KEY=<your_production_consumer_key>
MPESA_CONSUMER_SECRET=<your_production_consumer_secret>
MPESA_SHORTCODE=<your_production_shortcode>
MPESA_PASSKEY=<your_production_passkey>
MPESA_CALLBACK_URL=https://your-production-domain.com/api/queue/mpesa-callback
```

### Production Details
- **Business Short Code**: Your registered shortcode (e.g., 174379 or custom)
- **Passkey**: Provided by Safaricom (50+ characters)
- **Base URL**: https://api.safaricom.co.ke
- **Live Phone Numbers**: Real Kenya mobile numbers (254XXXXXXXXX)

### Getting Production Credentials

1. Register at [Safaricom Daraja Portal](https://www.safaricom.co.ke/business/enterprise/daraja)
2. Complete business verification
3. Request production credentials
4. Safaricom will provide Consumer Key, Secret, and Passkey
5. Add to your production `.env` file

## M-PESA Payment Request Format

The system sends requests in this format:

```json
{
  "BusinessShortCode": "174379",
  "Password": "<base64-encoded-shortcode+passkey+timestamp>",
  "Timestamp": "20260530165627",
  "TransactionType": "CustomerPayBillOnline",
  "Amount": 50,
  "PartyA": "254712345678",
  "PartyB": "174379",
  "PhoneNumber": "254712345678",
  "CallBackURL": "https://your-domain.com/api/queue/mpesa-callback",
  "AccountReference": "GT-REG-1234567890-ABC123",
  "TransactionDesc": "Golden Ticket Payment - Ref: GT-REG-1234567890-ABC123"
}
```

## M-PESA Response (CheckoutRequestID)

When M-PESA accepts the request, you get:

```json
{
  "MerchantRequestID": "29115-34620561-1",
  "CheckoutRequestID": "ws_CO_260520211133524545",
  "ResponseCode": "0",
  "ResponseDescription": "Success. Request accepted for processing",
  "CustomerMessage": "Success. Request accepted for processing"
}
```

The `CheckoutRequestID` (`ws_CO_260520211133524545`) is used to:
- Track the payment status
- Link with the callback response
- Verify payment completion

## Testing the Payment Flow

### Step 1: Activate Golden Ticket
```bash
curl -X POST http://localhost:3000/api/queue/golden-ticket \
  -H "Content-Type: application/json" \
  -d '{"queueId": 1, "action": "mark-golden"}'
```

Response:
```json
{
  "success": true,
  "goldenTicketData": {
    "goldenTicketRef": "GT-REG-1234567890-ABC123",
    "amount": 50
  }
}
```

### Step 2: Initiate M-PESA Payment
```bash
curl -X POST http://localhost:3000/api/queue/mpesa \
  -H "Content-Type: application/json" \
  -d '{
    "action": "initiate-payment",
    "queueId": 1,
    "phoneNumber": "254712345678",
    "amount": 50,
    "goldenRef": "GT-REG-1234567890-ABC123"
  }'
```

Response:
```json
{
  "success": true,
  "message": "Payment prompt sent to your phone",
  "checkoutRequestId": "ws_CO_260520211133524545",
  "environment": "sandbox"
}
```

### Step 3: Complete M-PESA Payment (on phone)
- User receives M-PESA prompt
- Enters M-PESA PIN
- Payment completes

### Step 4: Callback Received
M-PESA calls your callback URL with payment status:

```json
{
  "Body": {
    "stkCallback": {
      "MerchantRequestID": "29115-34620561-1",
      "CheckoutRequestID": "ws_CO_260520211133524545",
      "ResultCode": 0,
      "ResultDesc": "The service request has been processed successfully.",
      "CallbackMetadata": {
        "Item": [
          {"Name": "Amount", "Value": 50},
          {"Name": "MpesaReceiptNumber", "Value": "LK451H35OP"},
          {"Name": "TransactionDate", "Value": 20260530165627},
          {"Name": "PhoneNumber", "Value": 254712345678},
          {"Name": "AccountReference", "Value": "GT-REG-1234567890-ABC123"}
        ]
      }
    }
  }
}
```

## Troubleshooting

### "Invalid Consumer Key/Secret"
- Verify credentials in `.env`
- Ensure no extra spaces
- Check Consumer Key and Secret match (don't mix them up)

### "Invalid timestamp"
- Timestamp format must be: YYYYMMDDHHmmss
- System auto-generates, shouldn't be an issue
- Check server time sync

### "Invalid shortcode"
- For sandbox: must be 174379
- For production: use your registered shortcode
- Verify in M-PESA account settings

### "Invalid password/signature"
- Password is base64(shortcode+passkey+timestamp)
- Ensure passkey is exact (no extra spaces)
- Check timestamp format

### "Phone number validation failed"
- Phone must start with 254 (Kenya country code)
- Format: 254XXXXXXXXX (12 digits total)
- No special characters

### "Service not available"
- Check if M-PESA service is active on your account
- Verify callback URL is accessible
- Check firewall/CORS settings

## Environment File Template

```env
# M-PESA Configuration
NODE_ENV=development
MPESA_SANDBOX=true
MPESA_CONSUMER_KEY=your_consumer_key_here
MPESA_CONSUMER_SECRET=your_consumer_secret_here
MPESA_SHORTCODE=174379
MPESA_PASSKEY=bfb279f9ba9b9d1380007480bbe7f27425e1aa6d4ede3891ec337007a74ff42
MPESA_CALLBACK_URL=http://localhost:3000/api/queue/mpesa-callback

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/jkuat_queue

# API Port
PORT=3000
```

## API Documentation References

- [Safaricom Daraja API Docs](https://developer.safaricom.co.ke/docs)
- [M-PESA STK Push API](https://developer.safaricom.co.ke/documentation#lipa-na-m-pesa-online)
- [M-PESA Callback Response Format](https://developer.safaricom.co.ke/documentation#lipa-na-m-pesa-online-callback)

---

**Last Updated**: May 30, 2026
**Status**: Ready for Integration
