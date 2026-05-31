# Golden Ticket Eligibility System - Implementation Summary

## Overview
Implemented a new golden ticket logic system where:
- Each student can only upgrade their **most recent ticket** to a golden ticket
- Golden ticket opportunity **disappears** after creating a new ticket
- The golden ticket opportunity becomes available for the new ticket
- Enhanced golden ticket reference numbers with more details

## Changes Made

### 1. Database Schema Update (`db/schema.ts`)
**New Column:** `canUpgradeToGolden: boolean`
- Default: `true`
- Tracks whether a specific ticket is eligible for golden ticket upgrade
- Only the most recent ticket per student has this set to `true`

**Generated Migration:** `drizzle/0002_curved_pestilence.sql`
```sql
ALTER TABLE "queue_entries" ADD COLUMN "can_upgrade_to_golden" boolean DEFAULT true NOT NULL;
```

### 2. Queue Creation Endpoint (`api-server.js` - POST /api/queue)
**Logic Changes:**
```javascript
// When creating a new ticket:
1. Disable golden upgrade on ALL previous tickets by this student
2. Set the new ticket's canUpgradeToGolden = true
3. Return goldenTicketEligible flag in response
```

**Response Update:**
```json
{
  ...newEntry,
  "goldenTicketEligible": true,
  "message": "You can upgrade this ticket to a Golden Ticket for priority access!"
}
```

### 3. Enhanced Golden Ticket Reference Format (`src/routes/api/queue/golden-ticket.ts`)
**Old Format:** `GT-REG-1717891234567-ABC123`

**New Format:** `GT-REG-20260531-1530-0001-1234-ABC`

**Breakdown:**
- `GT` - Golden Ticket prefix
- `REG` - Service code (REG/FIN/ICT)
- `20260531` - Date (YYYYMMDD)
- `1530` - Time (HHMM)
- `0001` - Queue ID (padded)
- `1234` - Last 4 chars of Student ID
- `ABC` - Random suffix

**Additional Details in Response:**
```json
{
  "goldenTicketRef": "GT-REG-20260531-1530-0001-1234-ABC",
  "studentId": "12345678",
  "serviceType": "registrar",
  "expiresAt": "<10 minutes from creation>"
}
```

### 4. Golden Ticket Route Update (`src/routes/api/queue/golden-ticket.ts`)
**Added Eligibility Check:**
- Validates `canUpgradeToGolden` before allowing upgrade
- Returns clear error if ticket is not the most recent
- Prevents double-upgrades to golden tickets

### 5. M-Pesa Payment Endpoint (`src/routes/api/queue/$id/mpesa-pay.ts`)
**Added Validation:**
- Checks `canUpgradeToGolden` flag before processing payment
- Returns 403 Forbidden if ticket is not eligible
- Prevents payment attempts on ineligible tickets

### 6. Queue Status Endpoint (`src/routes/api/queue/-$id.ts`)
**Enhanced Response:**
```json
{
  ...existing_fields,
  "canUpgradeToGolden": true/false,
  "goldenTicketEligible": true/false
}
```

## Business Logic Flow

```
SCENARIO 1: First Ticket
┌──────────────────────────────────────┐
│ Student creates first ticket         │
│ → canUpgradeToGolden = true          │
│ → Can upgrade to golden ticket ✓     │
└──────────────────────────────────────┘

SCENARIO 2: Second Ticket (while first still waiting)
┌──────────────────────────────────────┐
│ First ticket                         │
│ → canUpgradeToGolden = false ✗       │
│ → Cannot upgrade anymore             │
├──────────────────────────────────────┤
│ Second ticket (NEW - MOST RECENT)    │
│ → canUpgradeToGolden = true          │
│ → Can upgrade to golden ticket ✓     │
└──────────────────────────────────────┘

SCENARIO 3: Upgrade Second Ticket
┌──────────────────────────────────────┐
│ First ticket                         │
│ → canUpgradeToGolden = false ✗       │
├──────────────────────────────────────┤
│ Second ticket (Golden Ticket)        │
│ → isGolden = true                    │
│ → canUpgradeToGolden = true          │
│ → Paid via M-Pesa ✓                  │
└──────────────────────────────────────┘
```

## API Behavior Changes

### POST /api/queue (Create Ticket)
**New Response Field:**
```json
{
  ...ticket_data,
  "goldenTicketEligible": true,
  "message": "You can upgrade this ticket to a Golden Ticket for priority access!"
}
```

### GET /api/queue/:id (Get Ticket Details)
**New Response Fields:**
```json
{
  ...existing_fields,
  "canUpgradeToGolden": boolean,
  "goldenTicketEligible": boolean
}
```

### POST /api/queue/:id/mark-golden (Mark as Golden)
**Error Case - Not Eligible:**
```json
{
  "error": "This ticket cannot be upgraded to golden",
  "message": "Golden ticket opportunity is only available for your most recent ticket...",
  "details": {
    "currentStatus": "waiting",
    "isAlreadyGolden": false,
    "eligibleForUpgrade": false
  }
}
```

### POST /api/queue/:id/mpesa-pay (Initiate Payment)
**Error Case - Not Eligible:**
```json
{
  "error": "Not eligible for upgrade",
  "message": "Golden ticket opportunity is only available for your most recent ticket...",
  "details": {
    "currentStatus": "waiting",
    "isAlreadyGolden": false,
    "eligibleForUpgrade": false
  }
}
```

## Files Modified
1. `db/schema.ts` - Added `canUpgradeToGolden` column
2. `drizzle/0002_curved_pestilence.sql` - Migration (auto-generated)
3. `api-server.js` - Updated queue creation logic
4. `src/routes/api/queue/golden-ticket.ts` - Enhanced reference format and eligibility check
5. `src/routes/api/queue/$id/mpesa-pay.ts` - Added eligibility validation
6. `src/routes/api/queue/-$id.ts` - Added eligibility fields to response

## Deployment Steps
1. Run database migration: `npx drizzle-kit migrate`
2. Restart application server
3. Test golden ticket flow with multiple tickets

## Testing Recommendations
1. **Test 1:** Create first ticket → Verify `goldenTicketEligible: true`
2. **Test 2:** Create second ticket → Verify first ticket now has `canUpgradeToGolden: false`
3. **Test 3:** Try to upgrade first ticket → Should fail with 403 error
4. **Test 4:** Try to upgrade second ticket → Should succeed
5. **Test 5:** Verify new golden ticket reference format includes all details
