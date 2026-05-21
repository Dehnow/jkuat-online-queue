# Code Analysis & Issues Found

## 🔴 CRITICAL ISSUES

### 1. **Duplicate Route Definitions in api-server.js**
- **Location**: Lines 109-423 and 401-689
- **Issue**: All routes (health check, /api/queue, /api/admin/serve, /api/admin/report) are defined TWICE
- **Impact**: Creates route conflicts, memory waste, potential race conditions
- **Fix**: Remove lines 401-689 (the duplicate section)

### 2. **Inefficient Query in getQueueStatus.ts**
- **Location**: Lines 11-25
- **Issue**: Loop fetches ALL records for each service, then filters in memory
  ```typescript
  .then(rows => rows.filter(r => r.status === 'waiting' || r.status === 'serving'))
  ```
- **Impact**: Fetches unnecessary data, wastes database bandwidth
- **Fix**: Use database WHERE clause filtering instead

### 3. **Missing Error Handling in Login Queue Fetch**
- **Location**: login.tsx, lines 83-114 in useQuery queryFn
- **Issue**: Fetches from `/api/queue?service=${service.id}` but this endpoint doesn't exist
  - API has `/api/queue?service=registrar` but returns `{ waitingCount, serving }`
  - Code expects structure but catches errors silently
- **Fix**: Use correct endpoint structure or implement fallback

### 4. **Inefficient Polling Strategy**
- **Location**: login.tsx (10s) and index.tsx (8s)
- **Issue**: Two separate polling intervals for same data
- **Impact**: Excessive API calls, high server load, unnecessary data transfer
- **Fix**: Consolidate polling; use query cache deduplication

### 5. **Missing Database Constraint**
- **Location**: db/schema.ts
- **Issue**: No unique constraint on (studentId, serviceType, status) combination
- **Impact**: Students can create duplicate tickets for same service on same day
- **Fix**: Add composite unique constraint

## 🟡 MODERATE ISSUES

### 6. **Race Condition in Ticket Limit Check**
- **Location**: index.tsx, lines 121-124
- **Issue**: `activeTicketCount` is checked before query, but could be stale
  ```typescript
  if (activeTicketCount >= 3) { setLimitError(...) }
  ```
- **Impact**: Multiple rapid clicks could bypass 3-ticket limit
- **Fix**: Verify limit server-side before insertion

### 7. **Inefficient Active Ticket Refresh**
- **Location**: index.tsx, lines 37-51
- **Issue**: refreshActiveTickets loops through tickets, makes individual API calls
  ```javascript
  for (const id of ids) {
    const res = await fetch(`/api/queue/${id}`)
  }
  ```
- **Impact**: N+1 query problem, slow performance with multiple tickets
- **Fix**: Batch fetch endpoint or cache results

### 8. **Memory Leak: No Query Invalidation**
- **Location**: Both login.tsx and index.tsx
- **Issue**: TanStack Query doesn't invalidate cache on ticket creation
- **Impact**: Dashboard shows stale data after new ticket
- **Fix**: Add queryClient.invalidateQueries() on successful POST

### 9. **No Pagination on History**
- **Location**: index.tsx, lines 348-372
- **Issue**: Loads entire history into memory with only max-height scrolling
- **Impact**: Performance degrades with many tickets
- **Fix**: Paginate or virtualize history list

### 10. **Unused getQueueStatus Server Function**
- **Location**: src/routes/api/getQueueStatus.ts
- **Issue**: File created but NEVER imported or used anywhere
- **Impact**: Dead code, confusion for maintainers
- **Fix**: Either use it or remove it

## 🟢 MINOR ISSUES

### 11. **Loose Type 'any' in index.tsx**
- **Location**: Line 312
- **Issue**: `serviceStats.map((s: any) =>` - Should use proper TypeScript type
- **Fix**: Define `ServiceStat` interface

### 12. **No Loading State on Login Modal Fetch**
- **Location**: login.tsx, lines 281-300
- **Issue**: Shows spinner but modal doesn't prevent background interaction
- **Fix**: Add explicit disabled state

### 13. **Session Storage vs Local Storage Mix**
- **Location**: index.tsx and login.tsx
- **Issue**: Uses both sessionStorage and localStorage
- **Impact**: Inconsistent auth state handling
- **Fix**: Standardize on one approach

### 14. **No Timeout on Fetch Calls**
- **Location**: Multiple files
- **Issue**: fetch() calls have no timeout, could hang indefinitely
- **Fix**: Wrap with AbortController and timeout

## 📊 API EFFICIENCY ANALYSIS

### Current Call Pattern:
```
Login Page: Every 10s when modal open
  → /api/queue?service=registrar (+ 2 more for finance, ict)
  → 3 parallel calls

Dashboard: Every 8s continuously
  → /api/queue?service=registrar (+ 2 more)
  → 3 parallel calls
  
Ticket history refresh: Every 30s per active ticket
  → /api/queue/:id (N calls based on active tickets)
```

### Issues:
- ❌ Too many calls (1 call every ~2.7 seconds per page)
- ❌ No request deduplication
- ❌ No caching between calls
- ❌ Separate manual polling instead of using React Query cache

### Recommended:
- ✅ Use React Query's automatic deduplication
- ✅ Increase staleTime to 10s (from 5s)
- ✅ Consolidate queries into single endpoint
- ✅ Batch ticket refresh checks
