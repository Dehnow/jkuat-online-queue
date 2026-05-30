# Golden Ticket Feature Implementation

## Overview
The Golden Ticket feature allows students to prevent their queue tickets from being cancelled when they know they'll be late or unable to make their scheduled time. In exchange for a KES 50 M-PESA payment, they receive priority placement in the queue with a protected ticket status.

## How It Works

### User Flow
1. **Activation**: Student clicks "Upgrade to Golden Ticket (KES 50)" button on their tracking page
2. **Reference Generation**: System generates a unique golden ticket reference (e.g., `GT-REG-1234567890-ABC123`)
3. **M-PESA Payment**: Student enters their phone number and initiates M-PESA STK push
4. **Payment Confirmation**: Upon successful payment, ticket is prioritized in the queue
5. **Priority Service**: Staff see golden ticket holders marked with ✨ and call them before regular queued customers

### Key Features
- **Ticket Protection**: Golden tickets won't be cancelled even if student is late
- **Priority Calling**: Golden ticket holders are called before regular queue entries
- **Unique Reference**: Each golden ticket gets a unique reference code for tracking
- **Payment Integration**: M-PESA STK push for seamless payment processing
- **Admin Visibility**: Staff can see which tickets are golden and their payment status

## Technical Architecture

### Database Schema Updates

#### New Fields in `queue_entries` Table
```sql
- is_golden (boolean, default: false)
- golden_ticket_ref (text, nullable)
- mpesa_transaction_id (text, nullable)
- mpesa_status (enum: 'pending', 'success', 'failed')
- mpesa_paid_at (timestamp, nullable)
```

#### New Enums
```sql
mpesa_status: ['pending', 'success', 'failed']
```

### API Endpoints

#### 1. Mark Ticket as Golden
**Endpoint**: `POST /api/queue/golden-ticket`

**Request**:
```json
{
  "queueId": 123,
  "action": "mark-golden"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Golden ticket activated. Proceed to payment.",
  "goldenTicketData": {
    "id": 123,
    "goldenTicketRef": "GT-REG-1234567890-ABC123",
    "queueNumber": 45,
    "originalTicket": "REG123",
    "amount": 50,
    "description": "Golden Ticket Premium - Queue #45"
  }
}
```

#### 2. Initiate M-PESA Payment
**Endpoint**: `POST /api/queue/mpesa`

**Request**:
```json
{
  "action": "initiate-payment",
  "queueId": 123,
  "phoneNumber": "254712345678",
  "amount": 50,
  "goldenRef": "GT-REG-1234567890-ABC123"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Payment prompt sent to your phone",
  "checkoutRequestId": "ws_CO_DMZ_123456"
}
```

#### 3. M-PESA Payment Callback
**Endpoint**: `POST /api/queue/mpesa-callback`

Receives M-PESA payment confirmation and updates ticket status to 'success'.

### Queue Priority Logic

When calling the next customer (`/api/admin/serve`):

1. **First Check**: Look for golden tickets with `mpesa_status = 'success'` and `status = 'waiting'`
2. **Second Check**: If no golden tickets, get regular waiting tickets by queue number
3. **Result**: Golden ticket holders are prioritized

### Frontend Components

#### Track Page (`src/routes/track.$id.tsx`)
- New "Upgrade to Golden Ticket" button
- Golden ticket activation modal
- M-PESA payment form
- Payment status display
- Shows golden ticket reference after activation

#### Admin Panel (`src/routes/admin.tsx`)
- Enhanced waiting list table with priority column
- Shows "🥇 Gold" or "⏳ Pending" status for golden tickets
- Highlights golden ticket rows in yellow

## Environment Variables

Add to your `.env`:
```
MPESA_CONSUMER_KEY=your_mpesa_consumer_key
MPESA_CONSUMER_SECRET=your_mpesa_consumer_secret
MPESA_SHORTCODE=174379
MPESA_PASSKEY=your_mpesa_passkey
MPESA_CALLBACK_URL=https://your-domain.com/api/queue/mpesa-callback
```

## Database Migration

A new migration file was generated:
```
drizzle/0001_furry_star_brand.sql
```

Run the migration to add the new columns to the `queue_entries` table:
```bash
npm run db:push
# or
npx drizzle-kit push
```

## Security Considerations

1. **M-PESA Authentication**: Uses OAuth 2.0 for secure M-PESA API access
2. **Webhook Validation**: Callback URLs should verify the source
3. **Rate Limiting**: Consider adding rate limits to prevent abuse
4. **Phone Number Validation**: Validates and normalizes phone numbers (Kenya format)
5. **Transaction Tracking**: All transactions stored with IDs for audit trail

## Cost & Revenue

- **Fee**: KES 50 per golden ticket
- **M-PESA Charges**: Standard M-PESA transaction fees apply (typically 1-2%)
- **Net Revenue**: Approximately KES 40-49 per successful golden ticket purchase

## Future Enhancements

1. **Refund Policy**: Auto-refund if service not provided within X hours
2. **Multiple Golden Tickets**: Allow students to purchase multiple golden tickets for future dates
3. **Subscription Plans**: Monthly/semester passes for frequent users
4. **Analytics**: Dashboard showing golden ticket sales and usage patterns
5. **Notifications**: SMS/Email notifications for payment confirmation
6. **Admin Controls**: Ability to manually mark tickets as golden

## Testing

### Manual Testing Checklist
- [ ] Activate golden ticket without payment
- [ ] Send M-PESA prompt to phone
- [ ] Confirm payment via M-PESA
- [ ] Verify ticket is moved to serving before others
- [ ] Check admin panel shows golden ticket with ✨
- [ ] Verify golden ticket reference is unique per ticket
- [ ] Test payment failure scenarios
- [ ] Verify cancelled golden tickets are tracked

### M-PESA Sandbox Testing
Use the M-PESA sandbox environment for testing:
- Consumer Key: `Your Sandbox Consumer Key`
- Consumer Secret: `Your Sandbox Consumer Secret`
- Sandbox Base URL: `https://sandbox.safaricom.co.ke`

## Troubleshooting

### Payment Not Showing on Phone
1. Verify phone number format (should be 254XXXXXXXXX)
2. Check M-PESA credentials in environment variables
3. Ensure callback URL is accessible and correct
4. Check M-PESA account balance and active merchant status

### Ticket Not Prioritized
1. Verify `mpesa_status` is 'success' in database
2. Check if there are older golden tickets with same service type
3. Verify `is_golden` is true for the ticket
4. Check queue ordering logic in `/api/admin/serve`

## Files Modified/Created

### Modified Files:
- `db/schema.ts` - Added golden ticket fields and enum
- `src/routes/track.$id.tsx` - Added golden ticket UI
- `src/routes/admin.tsx` - Added priority column display
- `src/routes/api/staff/queue-action.ts` - Updated priority logic
- `src/routes/api/queue/-$id.ts` - Added golden ticket fields to response
- `api-server.js` - Updated schema and serve_next logic

### New Files:
- `src/routes/api/queue/golden-ticket.ts` - Activate golden ticket endpoint
- `src/routes/api/queue/mpesa.ts` - M-PESA payment initiation
- `src/routes/api/queue/mpesa-callback.ts` - M-PESA payment callback handler

## Migration Rollback

If you need to rollback the golden ticket feature:

1. Revert the database migration
2. Remove the new columns from the schema
3. Remove/disable the new API endpoints
4. Update the frontend components to hide golden ticket options

```bash
# Generate rollback migration
npx drizzle-kit drop
```

---

**Implementation Date**: May 29, 2026
**Feature Status**: ✅ Complete
**Testing Status**: Ready for testing
