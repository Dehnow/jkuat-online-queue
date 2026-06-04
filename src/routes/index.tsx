import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, Banknote, Headphones, CheckCircle2, Clock, XCircle } from 'lucide-react'


type QueueEntry = {
  id: number
  name: string
  studentId: string
  serviceType: string
  queueNumber: number
  status: string
  createdAt: string
  servedAt?: string
}

type StoredTicket = {
  id: number
  queueNumber: number
  serviceType: string
  createdAt: string
  referenceNumber: string
  status?: string
  servedAt?: string
  isGolden?: boolean
  goldenTicketRef?: string
  mpesaStatus?: string
  mpesaPaidAt?: string
}

// Device ticket management (active tickets)
const getDeviceTicketIds = (): number[] => {
  const key = 'deviceTickets'
  const data = localStorage.getItem(key)
  return data ? JSON.parse(data) : []
}
const setDeviceTicketIds = (ids: number[]) => localStorage.setItem('deviceTickets', JSON.stringify(ids))
const addDeviceTicketId = (id: number) => {
  const ids = getDeviceTicketIds()
  if (!ids.includes(id)) { ids.push(id); setDeviceTicketIds(ids) }
}

const refreshActiveTickets = async (): Promise<number> => {
  const ids = getDeviceTicketIds()
  if (ids.length === 0) return 0
  
  try {
    // Batch fetch all tickets at once instead of individual calls
    const results = await Promise.all(
      ids.map(id =>
        fetch(`/api/queue/${id}`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
      )
    )
    
    let activeCount = 0
    const validIds: number[] = []
    
    results.forEach((ticket, idx) => {
      if (ticket && (ticket.status === 'waiting' || ticket.status === 'serving')) {
        activeCount++
        validIds.push(ids[idx])
      }
    })
    
    setDeviceTicketIds(validIds)
    return activeCount
  } catch (err) {
    console.error('Error refreshing active tickets:', err)
    return ids.length
  }
}

const getServiceCode = (service: string) => {
  switch (service) {
    case 'registrar': return 'REG'
    case 'finance': return 'FIN'
    case 'ict_helpdesk': return 'ICT'
    default: return 'JKU'
  }
}

const normalizeTicketEntry = (raw: any): QueueEntry => {
  const createdAt = raw.createdAt || raw.created_at || new Date().toISOString()
  return {
    id: Number(raw.id || raw.id === 0 ? raw.id : raw.id ?? 0),
    name: raw.name || raw.studentId || raw.student_id || 'Student',
    studentId: raw.studentId || raw.student_id || '',
    serviceType: raw.serviceType || raw.service_type || 'registrar',
    queueNumber: Number(raw.queueNumber || raw.queue_number || 0),
    status: raw.status || 'waiting',
    createdAt,
  }
}

const getReferenceNumber = (ticket: number | { id: number; serviceType?: string; createdAt?: string }) => {
  const ticketObj = typeof ticket === 'number' ? { id: ticket, serviceType: 'registrar' } : ticket
  const now = ticketObj.createdAt ? new Date(ticketObj.createdAt) : new Date()
  const day = String(now.getDate()).padStart(2,'0')
  const month = String(now.getMonth()+1).padStart(2,'0')
  const year = String(now.getFullYear()).slice(-2)
  const serviceCode = getServiceCode(ticketObj.serviceType || 'registrar')
  return `${serviceCode}${day}${month}${year}-${ticketObj.id}`
}

const dedupeStoredTickets = (tickets: StoredTicket[]) => {
  const seen = new Set<number>()
  return tickets.filter(ticket => {
    if (seen.has(ticket.id)) return false
    seen.add(ticket.id)
    return true
  })
}

const mergeTicketHistory = (localTickets: StoredTicket[], dbTickets: QueueEntry[]) => {
  const merged = new Map<number, StoredTicket>()

  localTickets.forEach(ticket => {
    merged.set(ticket.id, ticket)
  })

  dbTickets.forEach(ticket => {
    const existing = merged.get(ticket.id)
    merged.set(ticket.id, {
      id: ticket.id,
      queueNumber: ticket.queueNumber,
      serviceType: ticket.serviceType,
      createdAt: ticket.createdAt,
      status: ticket.status,
      servedAt: ticket.servedAt,
      referenceNumber: existing?.referenceNumber || getReferenceNumber({ id: ticket.id, serviceType: ticket.serviceType, createdAt: ticket.createdAt }),
      isGolden: existing?.isGolden || (ticket as any).isGolden,
      goldenTicketRef: existing?.goldenTicketRef || (ticket as any).goldenTicketRef,
      mpesaStatus: existing?.mpesaStatus || (ticket as any).mpesaStatus,
      mpesaPaidAt: existing?.mpesaPaidAt || (ticket as any).mpesaPaidAt,
    })
  })

  return Array.from(merged.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

const getStatusBadge = (status: string) => {
  switch(status) {
    case 'served':
      return { label: 'Completed', color: 'bg-green-100 text-green-800', icon: CheckCircle2 }
    case 'serving':
      return { label: 'Serving Now', color: 'bg-blue-100 text-blue-800', icon: Clock }
    case 'waiting':
      return { label: 'Waiting', color: 'bg-amber-100 text-amber-800', icon: Clock }
    case 'cancelled':
      return { label: 'Cancelled', color: 'bg-red-100 text-red-800', icon: XCircle }
    default:
      return { label: status, color: 'bg-gray-100 text-gray-800', icon: Clock }
  }
}

function StudentDashboard() {
  const [formData, setFormData] = useState({ phone: '', studentId: '', serviceType: 'registrar' })
  const [loading, setLoading] = useState(false)
  const [limitError, setLimitError] = useState('')
  const [showTicketModal, setShowTicketModal] = useState(false)
  const [lastTicket, setLastTicket] = useState<QueueEntry | null>(null)
  const [studentIdHeader, setStudentIdHeader] = useState('')
  const [ticketHistory, setTicketHistory] = useState<StoredTicket[]>([])
  const [activeTicketCount, setActiveTicketCount] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  // Golden Ticket / M-Pesa states
  const [showGoldenModal, setShowGoldenModal] = useState(false)
  const [goldenPhone, setGoldenPhone] = useState('')
  const [goldenLoading, setGoldenLoading] = useState(false)
  const [goldenError, setGoldenError] = useState('')
  const [goldenSuccess, setGoldenSuccess] = useState(false)
  const [selectedTicketForGolden, setSelectedTicketForGolden] = useState<number | null>(null)
  const [mpesaStatus, setMpesaStatus] = useState<string | null>(null)
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null)
  const [goldenTicketRef, setGoldenTicketRef] = useState<string | null>(null)
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null)
  const [showConfirmationDialog, setShowConfirmationDialog] = useState(false)
  const [confirmationTimeoutId, setConfirmationTimeoutId] = useState<NodeJS.Timeout | null>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    const storedId = sessionStorage.getItem('studentId')
    if (storedId) {
      setStudentIdHeader(storedId)
      const historyKey = `ticketHistory_${storedId}`
      const history = localStorage.getItem(historyKey)
      setTicketHistory(history ? dedupeStoredTickets(JSON.parse(history)) : [])
    }
    refreshActiveTickets().then(setActiveTicketCount)
    const interval = setInterval(() => refreshActiveTickets().then(setActiveTicketCount), 30000)
    return () => clearInterval(interval)
  }, [])

  // Listen for ticket creation events (same-window) and storage events (cross-tab)
  useEffect(() => {
    const onTicketCreated = (e: Event) => {
      try {
        const detail = (e as CustomEvent).detail
        if (detail && detail.id) {
          // Update last ticket and local history
          setLastTicket(detail)
          addDeviceTicketId(detail.id)
          setActiveTicketCount(prev => prev + 1)
          const student = detail.studentId || sessionStorage.getItem('studentId') || ''
          if (student) {
            const historyKey = `ticketHistory_${student}`
            const existing = localStorage.getItem(historyKey)
            const history = existing ? JSON.parse(existing) : []
            const refNum = getReferenceNumber(detail.id)
            const storedTicket: StoredTicket = {
              id: detail.id,
              queueNumber: detail.queueNumber,
              serviceType: detail.serviceType,
              createdAt: detail.createdAt,
              referenceNumber: refNum
            }
            const merged = dedupeStoredTickets([...history, storedTicket])
            localStorage.setItem(historyKey, JSON.stringify(merged))
            setTicketHistory(merged)
          }
        }
      } catch (err) {}
    }

    const onStorage = (ev: StorageEvent) => {
      try {
        if (ev.key && ev.key.startsWith('ticketHistory_')) {
          const student = sessionStorage.getItem('studentId')
          if (!student) return
          const historyKey = `ticketHistory_${student}`
          const data = localStorage.getItem(historyKey)
          setTicketHistory(data ? dedupeStoredTickets(JSON.parse(data)) : [])
        }
      } catch (err) {}
    }

    try {
      window.addEventListener('ticketCreated', onTicketCreated as EventListener)
      window.addEventListener('storage', onStorage)
    } catch (e) {}

    return () => {
      try {
        window.removeEventListener('ticketCreated', onTicketCreated as EventListener)
        window.removeEventListener('storage', onStorage)
      } catch (e) {}
    }
  }, [])

  // Auto-close ticket modal after 10 seconds
  useEffect(() => {
    if (showTicketModal) {
      const timer = setTimeout(() => {
        setShowTicketModal(false)
      }, 10000)
      return () => clearTimeout(timer)
    }
  }, [showTicketModal])

  // Live queue status using TanStack Query (updates every 10 seconds when stale)
  const { data: serviceStats = [], isLoading: isFetchingStats } = useQuery({
    queryKey: ['service-stats'],
    queryFn: async () => {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)
      
      try {
        const services = ['registrar', 'finance', 'ict_helpdesk']
        const results = await Promise.all(services.map(async s => {
          try {
            const res = await fetch(`/api/queue?service=${s}`, { signal: controller.signal })
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            const data = await res.json()
            return {
              serviceType: s,
              serviceName: s === 'registrar' ? "Registrar's Office" : s === 'finance' ? 'Finance Office' : 'ICT Helpdesk',
              waitingCount: data.waitingCount || 0,
              servingNumber: data.serving?.queueNumber || null,
              activeCount: (data.waitingCount || 0) + (data.serving ? 1 : 0)
            }
          } catch (err) {
            console.warn(`Failed to fetch ${s} queue:`, err)
            return {
              serviceName: s === 'registrar' ? "Registrar's Office" : s === 'finance' ? 'Finance Office' : 'ICT Helpdesk',
              waitingCount: 0,
              servingNumber: null
            }
          }
        }))
        return results
      } finally {
        clearTimeout(timeout)
      }
    },
    refetchInterval: 10000,
    staleTime: 8000,
    gcTime: 5 * 60 * 1000,
  })

  // Fetch ticket history from database (updated when studentId changes)
  const { data: dbHistoryData = { tickets: [] as QueueEntry[] }, isLoading: isLoadingHistory } = useQuery<{ tickets: QueueEntry[] }>({
    queryKey: ['ticket-history', studentIdHeader],
    queryFn: async () => {
      if (!studentIdHeader) return { tickets: [] }
      try {
        const response = await fetch(`/api/ticketHistory?studentId=${encodeURIComponent(studentIdHeader)}`)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = await response.json()
        return data
      } catch (err) {
        console.error('Error fetching ticket history from API:', err)
        return { tickets: [] }
      }
    },
    enabled: !!studentIdHeader,
    staleTime: 30000,
    refetchInterval: 60000,
  })

  const combinedHistory = mergeTicketHistory(ticketHistory, dbHistoryData.tickets || [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLimitError('')
    setLoading(true)
    try {
      const res = await fetch('/api/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.phone,
          studentId: formData.studentId,
          serviceType: formData.serviceType
        })
      })
      
      if (!res.ok) {
        const errorData = await res.json()
        if (res.status === 429) {
          setLimitError(errorData.message || 'Daily limit reached. Wait for a ticket to be served.')
        } else {
          setLimitError(errorData.error || 'Failed to create ticket')
        }
        return
      }
      
      const rawEntry = await res.json()
      const newEntry = normalizeTicketEntry(rawEntry)
      const studentIdForHistory = formData.studentId.trim()
      sessionStorage.setItem('studentId', studentIdForHistory)
      setStudentIdHeader(studentIdForHistory)
      setLastTicket(newEntry)
      addDeviceTicketId(newEntry.id)
      setActiveTicketCount(prev => prev + 1)
      const refNum = getReferenceNumber(newEntry)
      const storedTicket: StoredTicket = {
        id: newEntry.id,
        queueNumber: newEntry.queueNumber,
        serviceType: newEntry.serviceType,
        createdAt: newEntry.createdAt,
        referenceNumber: refNum,
        status: newEntry.status,
      }
      const historyKey = `ticketHistory_${studentIdForHistory}`
      const existing = localStorage.getItem(historyKey)
      const history = existing ? JSON.parse(existing) : []
      const merged = dedupeStoredTickets([...history, storedTicket])
      localStorage.setItem(historyKey, JSON.stringify(merged))
      setTicketHistory(merged)
      queryClient.invalidateQueries({ queryKey: ['service-stats'] })
      queryClient.invalidateQueries({ predicate: query => Array.isArray(query.queryKey) && query.queryKey[0] === 'ticket-history' })
      setFormData({ phone: '', studentId: '', serviceType: 'registrar' })
      setShowTicketModal(true)
      // Notify other parts of the app (Admin, dashboards) that a new ticket was created
      try {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('ticketCreated', { detail: newEntry }))
        }
      } catch (e) {}
    } catch (err) {
      console.error('Error creating ticket:', err)
      setLimitError('Network error - please try again')
    } finally {
      setLoading(false)
    }
  }

  const manualRefresh = async () => { 
    setIsRefreshing(true)
    try {
      const count = await Promise.race([
        refreshActiveTickets(),
        new Promise<number>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      ])
      setActiveTicketCount(count)
    } catch (err) {
      console.error('Refresh timeout:', err)
    } finally {
      setIsRefreshing(false)
    }
  }

  const printTicket = (ticket: QueueEntry | StoredTicket) => {
    const printWindow = window.open('', '_blank', 'width=400,height=500')
    if (printWindow) {
      const serviceName = ticket.serviceType === 'registrar' ? "Registrar's Office" : ticket.serviceType === 'finance' ? 'Finance Office' : 'ICT Helpdesk'
      const refNumber = (ticket as StoredTicket).referenceNumber || getReferenceNumber(ticket.id)
      printWindow.document.write(`<html><head><title>Queue Ticket</title></head><body style="text-align:center;padding:20px;"><img src="/queue-bg.jpeg" style="width:80px;border-radius:50%"/><h2>JKUAT Online QUEUE</h2><p><strong>Reference:</strong> ${refNumber}</p><p><strong>Queue Number:</strong> #${ticket.queueNumber}</p><p><strong>Service:</strong> ${serviceName}</p><p><em>Please wait for your number to be called.</em></p><hr/><small>JKUAT - Digital Queue System</small></body></html>`)
      printWindow.document.close()
      printWindow.print()
    }
  }

  const formatDate = (iso: string) => new Date(iso).toLocaleString()
  
  // Golden Ticket Handler
  const handleUpgradeToGolden = async (ticketId: number) => {
    setSelectedTicketForGolden(ticketId)
    setGoldenPhone('')
    setGoldenError('')
    setGoldenSuccess(false)
    setMpesaStatus(null)
    setCheckoutRequestId(null)
    setGoldenTicketRef(null)
    setShowGoldenModal(true)
  }

  const handleGoldenPayment = async () => {
    if (!goldenPhone.trim()) {
      setGoldenError('Please enter your phone number')
      return
    }

    if (!/^[\+]?254\d{9}$/.test(goldenPhone.replace(/\s/g, ''))) {
      setGoldenError('Invalid phone number. Use format: +254712345678')
      return
    }

    setGoldenLoading(true)
    setGoldenError('')

    try {
      // Initiate M-Pesa payment
      const res = await fetch(`/api/queue/${selectedTicketForGolden}/mpesa-pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: goldenPhone })
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        
        // Handle specific error codes
        if (res.status === 429) {
          setGoldenError('⚠️ This ticket already has a golden upgrade! You cannot upgrade it twice.')
          setGoldenLoading(false)
          return
        }
        
        if (res.status === 400) {
          setGoldenError(errData.message || 'Invalid input. Please check your details.')
          setGoldenLoading(false)
          return
        }
        
        throw new Error(errData.message || errData.error || `Error: HTTP ${res.status}`)
      }

      const data = await res.json()
      const requestId = data.checkoutRequestId
      const ticketRef = data.goldenTicketRef
      
      // Store CheckoutRequestID for callback verification
      setCheckoutRequestId(requestId)
      setGoldenTicketRef(ticketRef)
      setMpesaStatus('pending')
      
      console.log('✅ M-Pesa payment initiated')
      console.log(`   CheckoutRequestID: ${requestId}`)
      console.log(`   Golden Ref: ${ticketRef}`)
      console.log('📱 Waiting for user to complete payment on their phone...')
      
      // Poll status every 2.5 seconds (wait for callback)
      // Timeout: 12.50 seconds (2.5 seconds × 5 attempts = 12,500ms)
      let attempts = 0
      const MAX_ATTEMPTS = 5 // 5 attempts
      const POLL_INTERVAL = 2500 // 2.5 seconds (12500ms total timeout)

      const newPollInterval = setInterval(async () => {
        attempts++

        if (attempts > MAX_ATTEMPTS) {
          clearInterval(newPollInterval)
          setPollInterval(null)
          setGoldenLoading(false)
          // Show confirmation dialog instead of error
          setShowConfirmationDialog(true)
          // Set 5-second timeout for confirmation dialog
          const timeoutId = setTimeout(() => {
            setShowConfirmationDialog(false)
            // Clear any remaining state
            setMpesaStatus(null)
            setCheckoutRequestId(null)
            setGoldenError('')
          }, 5000) // 5 seconds
          setConfirmationTimeoutId(timeoutId)
          return
        }

        try {
          // Check M-Pesa payment status for this queue entry
          // Primary: Use queue-based endpoint (more direct)
          let statusRes = await fetch(`/api/queue/${selectedTicketForGolden}/mpesa-status`)
          
          // Fallback: Try checkout-based endpoint for backward compatibility
          if (!statusRes.ok && statusRes.status === 404) {
            statusRes = await fetch(`/api/mpesa/callback-status?checkoutRequestId=${encodeURIComponent(requestId)}`)
          }
          
          if (statusRes.ok) {
            const response = await statusRes.json()
            const { mpesaStatus, feedback } = response
            
            // Display feedback message to user
            if (feedback?.message) {
              console.log(`📲 Feedback: ${feedback.message}`)
            }
            
            if (mpesaStatus === 'success' || feedback?.isSuccessful) {
              console.log('✅ Payment successful! Callback received and verified.')
              console.log(`   Receipt: ${response.receiptNumber || 'N/A'}`)
              clearInterval(newPollInterval)
              setPollInterval(null)
              setMpesaStatus('success')
              setGoldenSuccess(true)
              setGoldenLoading(false)
              
              // Show success for 3 seconds then close
              setTimeout(() => {
                setShowGoldenModal(false)
                queryClient.invalidateQueries({ queryKey: ['service-stats'] })
              }, 3000)
            } else if (mpesaStatus === 'failed' || feedback?.isFailed) {
              console.error('❌ Payment failed - callback received.')
              clearInterval(newPollInterval)
              setPollInterval(null)
              setMpesaStatus('failed')
              setGoldenLoading(false)
              setGoldenError(feedback?.message || '❌ Payment was cancelled or failed. Please check your M-Pesa message and try again.')
            } else if (mpesaStatus === 'pending' || feedback?.isPending) {
              // Still pending, keep polling
              console.log(`   Poll ${attempts}/${MAX_ATTEMPTS}: ${feedback?.message || 'Waiting for callback...'}`)
            }
            // If still 'pending', keep polling (do nothing)
          } else if (statusRes.status === 404) {
            // Callback not yet received, keep polling
            console.log(`   Poll ${attempts}/${MAX_ATTEMPTS}: Waiting for callback...`)
          }
        } catch (err) {
          console.error('Error checking payment status:', err)
        }
      }, POLL_INTERVAL)
      
      // Store interval in state so buttons can clear it
      setPollInterval(newPollInterval)
    } catch (err) {
      setGoldenError(err instanceof Error ? err.message : 'Network error')
      setGoldenLoading(false)
    }
  }

  const handleClaimGoldTicket = async (ticketId: number, serviceType: string, queueNumber: number) => {
    try {
      const response = await fetch('/api/queue/claim-gold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queueId: ticketId,
          serviceType: serviceType
        })
      })

      if (response.ok) {
        const data = await response.json()
        alert(`✅ ${data.message}\nNew queue number: #${data.newQueueNumber}\nNew seat in line: ${data.newPosition}`)
        queryClient.invalidateQueries({ queryKey: ['service-stats'] })
        queryClient.invalidateQueries({ queryKey: ['ticket-history', studentIdHeader] })
      } else {
        const errData = await response.json()
        alert(`❌ ${errData.error || 'Failed to claim golden ticket'}`)
      }
    } catch (err) {
      console.error('Error claiming golden ticket:', err)
      alert('❌ Error claiming golden ticket. Please try again.')
    }
  }

  const getServiceIcon = (service: string) => {
    switch (service) {
      case 'registrar': return <Building2 className="w-6 h-6 text-green-600" />
      case 'finance': return <Banknote className="w-6 h-6 text-amber-500" />
      case 'ict_helpdesk': return <Headphones className="w-6 h-6 text-blue-500" />
      default: return null
    }
  }
  const getServiceName = (service: string) => {
    switch (service) {
      case 'registrar': return "Registrar's Office"
      case 'finance': return 'Finance Office'
      case 'ict_helpdesk': return 'ICT Helpdesk'
      default: return service
    }
  }
  const getServiceColor = (service: string) => {
    switch (service) {
      case 'registrar': return '#16a34a'
      case 'finance': return '#f59e0b'
      case 'ict_helpdesk': return '#3b82f6'
      default: return '#666'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 font-['Inter',system-ui]">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            {/* Left Section: Logo & Title */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <img src="/queue-bg.jpeg" className="w-10 h-10 sm:w-12 sm:h-12 rounded-full shadow-md flex-shrink-0"/>
              <div className="min-w-0">
                <h1 className="text-base sm:text-xl md:text-2xl font-bold text-green-600 truncate">JKUAT Queue</h1>
                <p className="text-xs text-gray-500 truncate">Smart Management</p>
              </div>
            </div>

            {/* Right Section: Student Info & Refresh */}
            <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
              <div className="text-right hidden sm:block">
                <p className="text-xs sm:text-sm font-semibold text-gray-800 truncate">{studentIdHeader || 'Student'}</p>
                <p className="text-xs text-gray-500 whitespace-nowrap">Active: {activeTicketCount}/3</p>
              </div>
              <button onClick={manualRefresh} disabled={isRefreshing} className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition flex-shrink-0">
              <svg className={`w-4 h-4 sm:w-5 sm:h-5 text-green-600 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8">
        {/* Security Notice */}
        <div className="mb-6 flex items-center justify-center">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-green-500 to-green-600 text-white px-4 py-2 rounded-full shadow-md">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
            <span className="text-sm font-semibold">Your data is secure • 256-bit encrypted</span>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Left Column: Get Ticket Form */}
          <div className="md:col-span-1 space-y-6">
            {/* Join Queue Card */}
            <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-md p-6 border border-gray-100">
              <h2 className="text-2xl font-bold text-green-600 mb-2">Get Ticket</h2>
              <p className="text-gray-500 text-sm mb-4">Fill in your details to join the queue</p>
              
              {limitError && <div className="bg-red-100 border border-red-300 text-red-700 p-3 rounded-lg mb-4 text-sm">{limitError}</div>}
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-2">Phone Number</label>
                  <input type="tel" placeholder="+254..." required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"/>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-2">Student ID</label>
                  <input type="text" placeholder="e.g., S12345" required value={formData.studentId} onChange={e => setFormData({...formData, studentId: e.target.value})} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"/>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-2">Select Service</label>
                  <select value={formData.serviceType} onChange={e => setFormData({...formData, serviceType: e.target.value})} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent">
                    <option value="registrar">🏢 Registrar's Office</option>
                    <option value="finance">💰 Finance Office</option>
                    <option value="ict_helpdesk">🎧 ICT Helpdesk</option>
                  </select>
                </div>
                <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-green-600 to-green-500 text-white py-3 rounded-lg font-bold shadow-md hover:shadow-lg transition disabled:opacity-50 h-[48px] flex items-center justify-center gap-2">
                  {loading ? (<><svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>Processing...</>) : (<>Get Queue Number →</>)}
                </button>
              </form>

              {/* Daily Limit Info */}
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-800"><strong>Daily Limit:</strong> You can join up to 3 queues per day</p>
              </div>
            </div>

            {/* How to Queue */}
            <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-md p-6 border border-gray-100">
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                How to Queue
              </h3>
              <ol className="space-y-3 text-sm text-gray-600">
                <li className="flex gap-3"><span className="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span><span>Enter your phone and student ID above</span></li>
                <li className="flex gap-3"><span className="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span><span>Select the service you need</span></li>
                <li className="flex gap-3"><span className="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span><span>Click "Get Queue Number" to join</span></li>
                <li className="flex gap-3"><span className="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold">4</span><span>Save or print your ticket reference</span></li>
                <li className="flex gap-3"><span className="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold">5</span><span>Wait for your number to be called</span></li>
              </ol>
            </div>

            {/* About System */}
            <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-md p-6 border border-gray-100">
              <h3 className="text-xl font-bold text-gray-800 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                About This System
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed mb-3">
                The JKUAT Online Queue System revolutionizes campus service delivery by allowing students to join queues digitally, eliminating long waits and improving efficiency.
              </p>
              <div className="space-y-2 text-xs text-gray-600">
                <p><strong>Service Hours:</strong> Mon-Fri, 8:00 AM - 4:30 PM</p>
                <p><strong>Supported Services:</strong> Registrar, Finance, ICT</p>
                <p><strong>Availability:</strong> 24/7 online, join anytime</p>
              </div>
            </div>
          </div>

          {/* Middle & Right Columns */}
          <div className="md:col-span-2 space-y-6">
            {/* Live Queue Status - Enhanced */}
            <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-md p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  <h2 className="text-2xl font-bold text-gray-800">Live Queue Status</h2>
                </div>
                <div className="flex items-center gap-2 bg-green-100 py-2 px-3 rounded-full">
                  <span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-600 opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-600"></span></span>
                  <span className="text-xs font-semibold text-green-700">Live Updates</span>
                </div>
              </div>
              
              {isFetchingStats && serviceStats.length === 0 ? (
                <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600"></div></div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {serviceStats.map((s: any) => (
                    <div key={s.serviceName} className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-5 border border-gray-200 hover:shadow-lg transition">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
                            {getServiceIcon(s.serviceName.includes('Registrar') ? 'registrar' : s.serviceName.includes('Finance') ? 'finance' : 'ict_helpdesk')}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-700">{s.serviceName}</p>
                            <p className="text-xs text-gray-500">Open • 4:30 PM</p>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between items-end">
                          <span className="text-xs text-gray-600">Now Serving</span>
                          <span className="text-2xl font-bold text-green-600">#{s.servingNumber || '—'}</span>
                        </div>
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs text-gray-600">Waiting</span>
                            <span className="text-lg font-bold text-orange-500">{s.waitingCount}</span>
                          </div>
                          <div className="w-full bg-gray-300 rounded-full h-2">
                            <div className="h-2 rounded-full bg-gradient-to-r from-orange-400 to-orange-500" style={{width: `${Math.min((s.waitingCount / 20) * 100, 100)}%`}}></div>
                          </div>
                          <p className="text-xs text-gray-500 mt-2">Est. wait: {s.waitingCount * 5} min</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Your Latest Ticket */}
            {lastTicket && (
              <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-md p-6 border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                      Your Ticket
                    </h3>
                    <p className="text-sm text-gray-500">Your current queue ticket</p>
                  </div>
                  <button onClick={() => printTicket(lastTicket)} className="inline-flex items-center gap-2 rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                    Print
                  </button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-4 border border-green-200">
                    <p className="text-xs text-gray-600 uppercase tracking-wide mb-2">Queue Number</p>
                    <div className="text-5xl font-black" style={{color: getServiceColor(lastTicket.serviceType)}}>#{lastTicket.queueNumber}</div>
                  </div>
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-4 border border-gray-200">
                    <p className="text-xs text-gray-600 uppercase tracking-wide mb-2">Office</p>
                    <p className="font-semibold text-gray-800 text-lg">{getServiceName(lastTicket.serviceType)}</p>
                    <p className="text-xs text-gray-500 mt-1">{new Date(lastTicket.createdAt).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</p>
                    {(() => {
                      const officeStats = serviceStats.find((service: any) => service.serviceType === lastTicket.serviceType)
                      return officeStats ? (
                        <p className="text-xs text-gray-600 mt-3">Office active tickets: <span className="font-semibold text-gray-800">{officeStats.activeCount}</span></p>
                      ) : null
                    })()}
                  </div>
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-4 border border-blue-200 md:col-span-2">
                    <p className="text-xs text-gray-600 uppercase tracking-wide mb-2">Reference Number</p>
                    <p className="font-mono text-lg font-bold text-gray-800">{getReferenceNumber(lastTicket.id)}</p>
                  </div>
                  {/* Golden Ticket Upgrade Button */}
                  <div className="md:col-span-3 flex gap-2">
                    <button
                      onClick={() => handleUpgradeToGolden(lastTicket.id)}
                      className="flex-1 bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-white px-4 py-3 rounded-lg font-bold shadow-md transition"
                    >
                      ⭐ Upgrade to Golden Ticket (KES 200)
                    </button>
                    <button
                      onClick={() => printTicket(lastTicket)}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-lg font-bold shadow-md transition"
                    >
                      🖨️ Print
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Ticket History Board - Enhanced */}
            <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-md p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  <h2 className="text-2xl font-bold text-gray-800">Your Ticket History</h2>
                </div>
                <span className="bg-gradient-to-r from-green-100 to-green-50 text-green-700 text-xs font-bold px-3 py-1 rounded-full border border-green-200">
                  {combinedHistory.length} tickets
                </span>
              </div>

              {isLoadingHistory && combinedHistory.length === 0 ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600"></div>
                </div>
              ) : ((dbHistoryData.tickets?.length ?? 0) + ticketHistory.length) === 0 ? (
                <div className="text-center py-8">
                  <svg className="w-16 h-16 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  <p className="text-gray-500 font-semibold">No ticket history yet</p>
                  <p className="text-gray-400 text-sm mt-1">Create a ticket above to see it here</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {/* Combine and deduplicate: database tickets + localStorage tickets */}
                  {combinedHistory.map(t => {
                      const statusInfo = getStatusBadge(t.status || 'waiting')
                      const StatusIcon = statusInfo.icon
                      const isGolden = (t as StoredTicket).isGolden
                      const goldenRef = (t as StoredTicket).goldenTicketRef
                      const canClaimGold = isGolden && t.status === 'waiting'
                      return (
                        <div key={t.id} className={`rounded-lg p-4 border transition group ${
                          isGolden 
                            ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-300 hover:shadow-lg' 
                            : 'bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200 hover:shadow-md'
                        }`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <div className="text-3xl font-black" style={{color: getServiceColor(t.serviceType)}}>
                                  #{t.queueNumber}{isGolden && ' ✨'}
                                </div>
                                <div className="flex-1">
                                  <p className="font-semibold text-gray-800">{getServiceName(t.serviceType)}</p>
                                  <p className="text-xs text-gray-500 flex items-center gap-1">
                                    <StatusIcon className="w-3 h-3" />
                                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${statusInfo.color}`}>
                                      {statusInfo.label}
                                    </span>
                                    {isGolden && <span className="ml-1 px-2 py-0.5 rounded text-xs font-semibold bg-yellow-200 text-yellow-800">🥇 Golden</span>}
                                  </p>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 mt-2">
                                <p>Ref: <span className="font-mono text-gray-700">{(t as StoredTicket).referenceNumber || getReferenceNumber(t.id)}</span></p>
                                <p>{formatDate(t.createdAt)}</p>
                              </div>
                              {goldenRef && (
                                <p className="mt-2 text-xs text-amber-700 font-mono bg-amber-100 px-2 py-1 rounded">
                                  Golden: {goldenRef}
                                </p>
                              )}
                            </div>
                            <div className="flex flex-col gap-2">
                              {canClaimGold && (
                                <button 
                                  onClick={() => handleClaimGoldTicket(t.id, t.serviceType, t.queueNumber)}
                                  className="bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-white px-3 py-2 rounded-lg text-xs font-bold transition shadow-md whitespace-nowrap"
                                >
                                  Claim Gold
                                </button>
                              )}
                              <button 
                                onClick={() => printTicket(t as StoredTicket)} 
                                className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-xs font-semibold transition shadow-md opacity-0 group-hover:opacity-100"
                              >
                                Print
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}
              
              <p className="text-xs text-gray-400 mt-4 text-center">Showing latest 50 tickets</p>
            </div>

            {/* Feature Bar */}
            <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-md p-6 border border-gray-100">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  </div>
                  <p className="text-sm font-semibold text-gray-800">Real-time Updates</p>
                  <p className="text-xs text-gray-500 mt-1">Live queue status every 8 seconds</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                  </div>
                  <p className="text-sm font-semibold text-gray-800">Smart Notifications</p>
                  <p className="text-xs text-gray-500 mt-1">Get alerted when it's your turn</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                  </div>
                  <p className="text-sm font-semibold text-gray-800">Join Anywhere</p>
                  <p className="text-xs text-gray-500 mt-1">Use any device, anytime</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  </div>
                  <p className="text-sm font-semibold text-gray-800">Secure & Private</p>
                  <p className="text-xs text-gray-500 mt-1">256-bit encrypted data</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Cinematic Ticket Modal */}
      {showTicketModal && lastTicket && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300" onClick={() => setShowTicketModal(false)}>
          <div className="bg-gradient-to-br from-white to-gray-50 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-cinematic-zoom" onClick={e => e.stopPropagation()}>
            {/* Ticket Top (Perforated Edge) */}
            <div className="relative bg-gradient-to-r from-green-600 to-green-500 p-8 text-white text-center animate-cinematic-bounce">
              <img src="/queue-bg.jpeg" className="w-20 h-20 mx-auto rounded-full border-4 border-white shadow-lg mb-4"/>
              <h2 className="text-4xl font-black">TICKET ISSUED</h2>
              <p className="text-green-100 text-sm mt-2">Your queue ticket is ready</p>
            </div>

            {/* Perforated Divider */}
            <div className="h-2 bg-white relative" style={{backgroundImage: 'radial-gradient(circle, transparent 4px, #e5e7eb 4px)', backgroundSize: '12px 100%', backgroundPosition: 'center'}}>
            </div>

            {/* Ticket Details */}
            <div className="p-8">
              <div className="space-y-6">
                {/* Queue Number - Large */}
                <div className="text-center">
                  <p className="text-xs font-semibold text-gray-500 mb-2">YOUR QUEUE NUMBER</p>
                  <div className="text-7xl font-black text-center mb-2" style={{color: getServiceColor(lastTicket.serviceType)}}>
                    #{lastTicket.queueNumber}
                  </div>
                  <p className="text-xs text-gray-400">Keep this number safe</p>
                </div>

                {/* Service Info */}
                <div className="bg-gray-100 rounded-lg p-4 text-center">
                  <p className="text-xs text-gray-600 mb-1">SERVICE OFFICE</p>
                  <p className="text-lg font-bold text-gray-800">{getServiceName(lastTicket.serviceType)}</p>
                </div>

                {/* Reference Number */}
                <div className="bg-gray-100 rounded-lg p-4">
                  <p className="text-xs text-gray-600 mb-1">REFERENCE NUMBER</p>
                  <p className="text-center font-mono text-lg font-bold text-gray-800 break-all">{getReferenceNumber(lastTicket.id)}</p>
                </div>

                {/* Time Issued */}
                <div className="grid grid-cols-2 gap-4 text-center text-xs">
                  <div className="bg-gray-100 rounded-lg p-3">
                    <p className="text-gray-600 mb-1">TIME ISSUED</p>
                    <p className="font-semibold text-gray-800">{new Date(lastTicket.createdAt).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</p>
                  </div>
                  <div className="bg-gray-100 rounded-lg p-3">
                    <p className="text-gray-600 mb-1">DATE</p>
                    <p className="font-semibold text-gray-800">{new Date(lastTicket.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>

                {/* Important Notice */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center text-xs text-yellow-800">
                  <p className="font-semibold mb-1">⚠️ Important</p>
                  <p>Please arrive on campus and proceed to the service office before your estimated service time</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-8 space-y-3">
                <button onClick={() => printTicket(lastTicket)} className="w-full bg-gradient-to-r from-green-600 to-green-500 text-white py-3 rounded-lg font-bold shadow-md hover:shadow-lg transition flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                  Print Ticket
                </button>
                <button onClick={() => setShowTicketModal(false)} className="w-full border-2 border-gray-300 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-100 transition">
                  Close
                </button>
              </div>

              {/* Footer Note */}
              <p className="text-center text-xs text-gray-500 mt-4">JKUAT Digital Queue System • Secure & Encrypted</p>
            </div>
          </div>
        </div>
      )}

      {/* Golden Ticket M-Pesa Payment Modal - Production UI */}
      {showGoldenModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowGoldenModal(false)}>
          <div 
            className="bg-white rounded-2xl overflow-hidden transition-all duration-300"
            style={{
              width: '440px',
              maxWidth: 'calc(100% - 32px)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.08)',
              animation: 'modal-slide-up 300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <style>{`
              @keyframes modal-slide-up { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
              @keyframes spin-gold { 100% { transform: rotate(360deg); } }
              @keyframes pulse-sparkle { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
              @keyframes scale-in-bounce { 0% { transform: scale(0.6); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
              .spin-gold { animation: spin-gold 3s linear infinite; }
              .pulse-sparkle { animation: pulse-sparkle 1.5s ease-in-out infinite; }
              .scale-in-bounce { animation: scale-in-bounce 400ms cubic-bezier(0.34, 1.56, 0.64, 1); }
            `}</style>

            {/* ===== HEADER BLOCK ===== */}
            <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 px-6 py-8 text-center relative overflow-hidden">
              {/* Sparkles */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-4 left-6 w-1.5 h-1.5 bg-yellow-300 rounded-full pulse-sparkle" style={{animationDelay: '0s'}}></div>
                <div className="absolute top-5 right-8 w-1 h-1 bg-yellow-200 rounded-full pulse-sparkle" style={{animationDelay: '0.3s'}}></div>
                <div className="absolute bottom-6 left-10 w-1 h-1 bg-yellow-300 rounded-full pulse-sparkle" style={{animationDelay: '0.6s'}}></div>
                <div className="absolute bottom-5 right-6 w-1.5 h-1.5 bg-yellow-200 rounded-full pulse-sparkle" style={{animationDelay: '0.9s'}}></div>
              </div>

              {/* Icon */}
              <div 
                className="w-10 h-10 mx-auto mb-3 flex items-center justify-center"
                style={{backgroundColor: '#FDB813', borderRadius: '4px'}}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                  <path d="M12 2L15.09 8.26H21.77L16.84 12.45L18.93 18.71L12 14.52L5.07 18.71L7.16 12.45L2.23 8.26H8.91L12 2Z"/>
                </svg>
              </div>

              <h2 className="text-2xl font-black text-gray-900 tracking-wider" style={{fontFamily: "'Inter', sans-serif", letterSpacing: '0.5px'}}>
                GOLDEN TICKET
              </h2>
              <p className="text-sm font-medium text-gray-700 mt-1">Priority Queue Service</p>
            </div>

            {/* ===== CONTENT AREA ===== */}
            <div className="px-6 py-6">
              {/* SUCCESS STATE */}
              {goldenSuccess && mpesaStatus === 'success' && (
                <div className="text-center space-y-4">
                  <div 
                    className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center scale-in-bounce"
                    style={{boxShadow: '0 4px 15px rgba(0,0,0,0.05)'}}
                  >
                    <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Payment Successful!</h3>
                    <p className="text-sm text-gray-600 mt-2">Your queue entry has been upgraded to Golden status. You'll be served before regular queue entries.</p>
                  </div>
                  <button
                    onClick={() => setShowGoldenModal(false)}
                    className="w-full h-14 bg-gradient-to-r from-green-600 to-green-500 text-white font-bold rounded-2xl shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5"
                  >
                    Great! Close
                  </button>
                </div>
              )}

              {/* ERROR/FAILED STATE */}
              {goldenError && !goldenSuccess && (
                <div className="text-center space-y-4">
                  <div 
                    className="w-16 h-16 mx-auto bg-white rounded-full flex items-center justify-center border border-red-100 scale-in-bounce"
                    style={{boxShadow: '0 4px 15px rgba(0,0,0,0.05)'}}
                  >
                    <svg className="w-8 h-8 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Payment Failed</h3>
                    <p className="text-sm text-gray-600 mt-1">Oops! Something went wrong.</p>
                  </div>
                  <div 
                    className="p-4 rounded-2xl text-center"
                    style={{backgroundColor: '#FFF5F5', border: '1px solid #FEE2E2'}}
                  >
                    <p className="text-sm font-medium text-red-500">Payment failed. Please try again.</p>
                  </div>
                  <button
                    onClick={() => {
                      setGoldenError('')
                      setMpesaStatus(null)
                    }}
                    className="w-full h-14 bg-gradient-to-r from-red-500 to-red-600 text-white font-bold rounded-2xl shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 flex items-center justify-center gap-2"
                  >
                    Try Again
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </button>
                </div>
              )}

              {/* LOADING/WAITING STATE */}
              {goldenLoading && mpesaStatus === 'pending' && !goldenError && (
                <div className="space-y-5">
                  {/* Spinner */}
                  <div className="flex justify-center pt-4">
                    <div 
                      className="w-12 h-12 border-2 border-gray-200 rounded-full spin-gold"
                      style={{borderTopColor: '#FDB813'}}
                    ></div>
                  </div>

                  {/* Message */}
                  <div className="text-center">
                    <h3 className="text-lg font-bold text-gray-900">Waiting for M-Pesa Confirmation...</h3>
                    <p className="text-sm text-gray-600 mt-2 leading-relaxed">Do not close this dialog. The system is waiting for payment confirmation from Safaricom.</p>
                  </div>

                  {/* What to Expect Card */}
                  <div 
                    className="p-4 rounded-2xl space-y-3"
                    style={{backgroundColor: '#F4FBF7'}}
                  >
                    <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">What to expect</p>
                    <div className="space-y-2">
                      {[
                        'M-Pesa prompt appears on your phone',
                        'Enter your M-Pesa PIN to authorize payment',
                        'You receive M-Pesa confirmation message (KES 200 deducted)',
                        'This dialog updates automatically'
                      ].map((step, idx) => (
                        <div key={idx} className="flex items-start gap-3">
                          <div 
                            className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                            style={{backgroundColor: '#DEF7EC'}}
                          >
                            <span className="text-xs font-bold" style={{color: '#03543F'}}>{idx + 1}</span>
                          </div>
                          <p className="text-sm text-gray-800 font-medium">{step}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Timeout Help Card */}
                  <div 
                    className="p-3 rounded-2xl border"
                    style={{backgroundColor: '#F9FAFB', borderColor: '#F3F4F6'}}
                  >
                    <div className="space-y-1.5">
                      {[
                        'Verify your phone number is correct.',
                        'Ensure your account has sufficient balance.',
                        'Check mobile signal.',
                        'Restart M-Pesa app if needed.'
                      ].map((tip, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <svg className="w-3.5 h-3.5 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          <p className="text-xs text-gray-700">{tip}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              )}

              {/* INITIAL FORM STATE */}
              {!goldenLoading && !goldenError && !goldenSuccess && (
                <form
                  onSubmit={e => {
                    e.preventDefault()
                    handleGoldenPayment()
                  }}
                  className="space-y-5"
                >
                  {/* Benefits Card */}
                  <div 
                    className="p-4 rounded-2xl space-y-2"
                    style={{backgroundColor: '#FFFBF2'}}
                  >
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="#FDB813" viewBox="0 0 20 20">
                        <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                      </svg>
                      <p className="font-bold text-sm text-gray-900">Benefits:</p>
                    </div>
                    <div className="space-y-1.5 text-sm text-gray-700">
                      <div className="flex items-center gap-2">
                        <span className="text-green-600">✓</span>
                        <span>Jump to the front of the queue</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-green-600">✓</span>
                        <span>Get served before regular tickets</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-green-600">✓</span>
                        <span>Cost: <span className="font-bold">KES 200</span></span>
                      </div>
                    </div>
                  </div>

                  {/* Phone Input */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">M-Pesa Phone Number</label>
                    <div className="relative">
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M5 1a2 2 0 012-2h6a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2V1zm6 18h4a2 2 0 002-2v-2h2a2 2 0 012 2v-2a6 6 0 00-6-6H9.5a3.5 3.5 0 00-3.5 3.5V17a2 2 0 002 2z" />
                      </svg>
                      <input
                        type="tel"
                        placeholder="+2547XXXXXXXX"
                        value={goldenPhone}
                        onChange={e => {
                          setGoldenPhone(e.target.value)
                          setGoldenError('')
                        }}
                        disabled={goldenLoading}
                        className="w-full h-14 pl-11 pr-4 border border-gray-200 rounded-2xl text-base focus:outline-none focus:border-yellow-500 focus:shadow-lg transition-all"
                        style={{boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)'}}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Format: +254712345678</p>
                  </div>

                  {/* Error Alert */}
                  {goldenError && (
                    <div 
                      className="p-3 rounded-2xl text-sm text-red-700"
                      style={{backgroundColor: '#FFF5F5', borderLeft: '3px solid #EF4444'}}
                    >
                      {goldenError}
                    </div>
                  )}

                  {/* Buttons */}
                  <div className="space-y-3 pt-2">
                    <button
                      type="submit"
                      disabled={goldenLoading}
                      className="w-full h-14 bg-gradient-to-r from-yellow-400 to-yellow-500 text-white font-bold rounded-2xl shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {goldenLoading ? 'Processing...' : 'Pay KES 200 with M-Pesa'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowGoldenModal(false)}
                      disabled={goldenLoading}
                      className="w-full h-12 bg-white border border-gray-200 text-gray-700 font-semibold rounded-2xl hover:bg-gray-50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                  </div>

                  {/* Security Footer */}
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                    <p className="text-xs text-gray-500">Secure M-Pesa payment via Safaricom</p>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* M-Pesa Confirmation Dialog - Appears after payment timeout */}
      {showConfirmationDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div
            className="bg-white rounded-2xl overflow-hidden transition-all duration-300"
            style={{
              width: '440px',
              maxWidth: 'calc(100% - 32px)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.08)',
              animation: 'modal-slide-up 300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <style>{`
              @keyframes modal-slide-up { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
            `}</style>

            {/* Header */}
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-8 text-center">
              <div className="w-12 h-12 mx-auto mb-3 flex items-center justify-center bg-blue-400 rounded-full">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white">M-Pesa Confirmation</h2>
              <p className="text-blue-100 text-sm mt-1">Awaiting desk verification</p>
            </div>

            {/* Content */}
            <div className="px-6 py-8">
              <div className="space-y-6">
                {/* Info Message */}
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-center">
                  <p className="text-sm font-semibold text-blue-900 mb-2">📱 M-Pesa Message Status</p>
                  <p className="text-lg font-bold text-blue-900">M-Pesa Message will be requested at the counter</p>
                  <p className="text-xs text-blue-700 mt-2">The payment confirmation will be verified by staff</p>
                </div>

                {/* Instructions */}
                <div className="space-y-3 bg-gray-50 rounded-2xl p-4">
                  <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">What happens next:</p>
                  <div className="space-y-2">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">1</div>
                      <p className="text-sm text-gray-700">Proceed to the service counter</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">2</div>
                      <p className="text-sm text-gray-700">Show staff your M-Pesa confirmation message</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">3</div>
                      <p className="text-sm text-gray-700">Staff will verify and upgrade your ticket</p>
                    </div>
                  </div>
                </div>

                {/* Timer Info */}
                <div className="text-center text-xs text-gray-500">
                  <p>This dialog will auto-close in 5 seconds</p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        if (!checkoutRequestId) {
                          alert('❌ No active transaction found.')
                          return
                        }
                        const res = await fetch('/api/queue/mpesa-callback', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            Body: {
                              stkCallback: {
                                MerchantRequestID: 'TEST_FAIL_' + Date.now(),
                                CheckoutRequestID: checkoutRequestId,
                                ResultCode: 1,
                                ResultDesc: 'The service request has been rejected by user.',
                                CallbackMetadata: {
                                  Item: [
                                    { Name: 'Amount', Value: 200 },
                                    { Name: 'MpesaReceiptNumber', Value: 'FAILED' + Date.now() },
                                    { Name: 'AccountReference', Value: goldenTicketRef }
                                  ]
                                }
                              }
                            }
                          })
                        })
                        if (confirmationTimeoutId) {
                          clearTimeout(confirmationTimeoutId)
                          setConfirmationTimeoutId(null)
                        }
                        setShowConfirmationDialog(false)
                        setMpesaStatus('failed')
                        setGoldenError('❌ Payment Failed. Please try again.')
                      } catch (err) {
                        console.error('Error:', err)
                      }
                    }}
                    className="flex-1 h-12 bg-white border border-red-200 text-red-500 font-bold rounded-2xl hover:bg-red-50 transition-all duration-300"
                  >
                    Fail
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        if (!checkoutRequestId) {
                          alert('❌ No active transaction found.')
                          return
                        }
                        const res = await fetch('/api/queue/mpesa-callback', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            Body: {
                              stkCallback: {
                                MerchantRequestID: 'TEST_' + Date.now(),
                                CheckoutRequestID: checkoutRequestId,
                                ResultCode: 0,
                                ResultDesc: 'The service request has been processed successfully.',
                                CallbackMetadata: {
                                  Item: [
                                    { Name: 'Amount', Value: 200 },
                                    { Name: 'MpesaReceiptNumber', Value: 'SIM' + Date.now() },
                                    { Name: 'TransactionDate', Value: new Date().toISOString().replace(/[:-]/g, '').slice(0, 14) },
                                    { Name: 'PhoneNumber', Value: goldenPhone },
                                    { Name: 'AccountReference', Value: goldenTicketRef }
                                  ]
                                }
                              }
                            }
                          })
                        })
                        if (!res.ok) {
                          alert('❌ Failed to process payment callback')
                          return
                        }
                        if (confirmationTimeoutId) {
                          clearTimeout(confirmationTimeoutId)
                          setConfirmationTimeoutId(null)
                        }
                        setShowConfirmationDialog(false)
                        setMpesaStatus('success')
                        setGoldenSuccess(true)
                        const studentId = studentIdHeader || sessionStorage.getItem('studentId') || ''
                        if (studentId) {
                          const historyKey = `ticketHistory_${studentId}`
                          const existing = localStorage.getItem(historyKey)
                          const history = existing ? JSON.parse(existing) : []
                          const updatedHistory = history.map((t: StoredTicket) =>
                            t.id === selectedTicketForGolden
                              ? {
                                  ...t,
                                  isGolden: true,
                                  goldenTicketRef: goldenTicketRef,
                                  mpesaStatus: 'success',
                                  mpesaPaidAt: new Date().toISOString()
                                }
                              : t
                          )
                          localStorage.setItem(historyKey, JSON.stringify(updatedHistory))
                          setTicketHistory(dedupeStoredTickets(updatedHistory))
                        }
                        setTimeout(() => {
                          setShowGoldenModal(false)
                          queryClient.invalidateQueries({ queryKey: ['service-stats'] })
                          queryClient.invalidateQueries({ queryKey: ['ticket-history', studentIdHeader] })
                        }, 2000)
                      } catch (err) {
                        console.error('Error:', err)
                      }
                    }}
                    className="flex-1 h-12 bg-gradient-to-r from-green-600 to-green-500 text-white font-bold rounded-2xl hover:shadow-lg transition-all duration-300"
                  >
                    Successful
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default StudentDashboard