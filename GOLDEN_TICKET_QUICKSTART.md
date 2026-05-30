# Golden Ticket Feature - Quick Implementation Guide

## ✅ What Has Been Implemented

Your golden ticket feature is now **fully integrated** into the JKUAT Queue System! Here's what you can do with it:

### User Experience
1. **Track their ticket** → Sees "Upgrade to Golden Ticket (KES 50)" button
2. **Click the button** → Modal opens with explanation
3. **Activate golden ticket** → Gets unique reference (e.g., `GT-REG-1234567890-ABC123`)
4. **Enter phone number** → M-PESA prompt sends to their phone
5. **Complete payment** → Ticket moves to priority queue automatically

### Admin Experience  
1. **View waiting list** → Golden tickets marked with 🥇 and highlighted in yellow
2. **See status** → Shows "Gold" (paid) or "Pending" (awaiting payment)
3. **Call next** → Golden tickets (paid) are called before regular queue

### Key Ticket Modifications
- Original ticket number stays the same (e.g., #45)
- Gets unique golden reference appended
- Example: `#45✨ + GT-REG-1234567890-ABC123`

## 🚀 Deployment Steps

### 1. Run Database Migration
```bash
cd "c:\Users\user\Desktop\jkuat-queue-online 3.2 SRC"
npx drizzle-kit push
```

This adds the new golden ticket columns to your database.

### 2. Set Environment Variables

Add these to your `.env` file:
```
MPESA_CONSUMER_KEY=<your_sandbox_consumer_key>
MPESA_CONSUMER_SECRET=<your_sandbox_consumer_secret>
MPESA_SHORTCODE=174379
MPESA_PASSKEY=<your_sandbox_passkey>
MPESA_CALLBACK_URL=https://your-deployed-url.com/api/queue/mpesa-callback
```

### 3. Test in Development
```bash
npm run dev
```

Test the flow:
- Create a ticket
- Try upgrading to golden ticket
- Send M-PESA prompt (sandbox test mode)
- Check admin panel for golden ticket display

### 4. Deploy to Production
```bash
npm run build
# Deploy to your hosting (Netlify/Render/etc)
```

## 📋 Verification Checklist

- [ ] Database migration completed
- [ ] No errors after running `npx drizzle-kit push`
- [ ] Golden ticket button appears on tracking page
- [ ] Can activate golden ticket without payment
- [ ] M-PESA credentials configured
- [ ] Admin panel shows golden ticket priority column
- [ ] Golden tickets highlighted with ✨
- [ ] Regular queue still works as before

## 🔧 How the System Works

### Queue Priority Order
When staff clicks "Call Next":
1. **First**: Checks for golden tickets with PAID status (mpesa_status = 'success')
2. **Then**: Calls oldest regular waiting ticket

This ensures golden ticket holders get called before others!

### Ticket Reference Format
```
GT-[SERVICE-CODE]-[TIMESTAMP]-[RANDOM]
```
- SERVICE-CODE: REG, FIN, or ICT
- TIMESTAMP: Unix timestamp
- RANDOM: Random 6-character code

### Payment Flow
1. User clicks upgrade button
2. System generates golden reference
3. User enters phone (254XXXXXXXXX format)
4. M-PESA prompt appears on their phone
5. They enter M-PESA PIN
6. Payment confirmed → Ticket moves to priority queue

## 🆘 Troubleshooting

### Golden ticket button doesn't appear
- Check browser console for errors
- Verify database has the new columns (run migration)
- Clear browser cache and reload

### M-PESA prompt doesn't send
- Verify phone number format: must be 254XXXXXXXXX
- Check M-PESA credentials in .env
- Ensure M-PESA account is active
- Check if you're using sandbox vs production credentials

### Golden ticket not prioritized
- Verify `mpesa_status` is 'success' in database
- Check admin panel - golden ticket should show "🥇 Gold" not "⏳ Pending"
- Ensure ticket is 'waiting' status (not 'serving' or 'served')
- Refresh admin page to see updated queue

## 📊 Example Workflow

### Scenario: Student knows they'll be late
```
1. Student gets ticket #45
2. Realizes they'll be 30 minutes late
3. Clicks "Upgrade to Golden Ticket (KES 50)"
4. Receives unique reference: GT-REG-1712234567-ABC123
5. Enters phone: 0712345678
6. M-PESA prompt appears
7. Pays KES 50
8. Ticket #45 now protected - won't be cancelled if late
9. Staff will call them BEFORE other regular queue #46, #47, etc.
```

### Scenario: No golden ticket
```
1. Student gets ticket #46
2. Doesn't upgrade to golden ticket
3. If they don't show up within wait time
4. Staff can cancel their ticket (normal behavior)
5. They lose their position in queue
```

## 💰 Revenue Model

- **Cost per Golden Ticket**: KES 50
- **M-PESA Fee**: ~1-2% (deducted by M-PESA)
- **Net Revenue per Sale**: ~KES 40-49

**Example**: 50 golden tickets/day × KES 45 net = **KES 2,250/day** = **~KES 67,500/month**

## 📞 M-PESA Sandbox Testing

Get credentials from: https://developer.safaricom.co.ke

Test phone numbers (sandbox):
- 254712345678 (any number works in sandbox)

The system will show mock prompts when using sandbox credentials.

## 🔐 Security Notes

- All M-PESA transactions logged with transaction IDs
- Phone numbers validated and normalized
- Callbacks verified for authenticity
- Golden ticket references are unique per ticket

## 📚 Full Documentation

See `GOLDEN_TICKET_FEATURE.md` for detailed technical documentation including:
- Complete API reference
- Database schema details
- Security considerations
- Future enhancement ideas

---

**Status**: ✅ Ready for Deployment
**Last Updated**: May 29, 2026
**Questions?** Check the GOLDEN_TICKET_FEATURE.md file for comprehensive details.
