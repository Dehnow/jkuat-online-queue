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
}

type StoredTicket = {
  id: number
  queueNumber: number
  serviceType: string
  createdAt: string
  referenceNumber: string
  status?: string
  servedAt?: string
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
  const queryClient = useQueryClient()

  useEffect(() => {
    const storedId = sessionStorage.getItem('studentId')
    if (storedId) {
      setStudentIdHeader(storedId)
      const history = localStorage.getItem(`ticketHistory_${storedId}`)
      setTicketHistory(history ? JSON.parse(history) : [])
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
            history.push(storedTicket)
            localStorage.setItem(historyKey, JSON.stringify(history))
            setTicketHistory(history)
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
          setTicketHistory(data ? JSON.parse(data) : [])
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
      history.push(storedTicket)
      localStorage.setItem(historyKey, JSON.stringify(history))
      setTicketHistory(history)
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
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/queue-bg.jpeg" className="w-12 h-12 rounded-full shadow-md"/>
            <div>
              <h1 className="text-2xl font-bold text-green-600">JKUAT Online Queue</h1>
              <p className="text-xs text-gray-500">Smart Queue Management System</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-800">{studentIdHeader || 'Student'}</p>
              <p className="text-xs text-gray-500">Active: {activeTicketCount}/3</p>
            </div>
            <button onClick={manualRefresh} disabled={isRefreshing} className="p-2 hover:bg-gray-100 rounded-lg transition">
              <svg className={`w-5 h-5 text-green-600 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
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
                            <span className="text-xs text-gray-600">Active (Serving + Waiting)</span>
                            <span className="text-lg font-bold text-gray-800">{s.activeCount}</span>
                          </div>
                          <div className="h-1" />
                        
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
                  {(dbHistoryData.tickets?.length ?? 0) + ticketHistory.length} tickets
                </span>
              </div>

              {isLoadingHistory && ticketHistory.length === 0 ? (
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
                  {[
                    ...(dbHistoryData.tickets || []),
                    ...ticketHistory.filter(t => !dbHistoryData.tickets.some((dt: QueueEntry) => dt.id === t.id))
                  ]
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .map(t => {
                      const statusInfo = getStatusBadge(t.status || 'waiting')
                      const StatusIcon = statusInfo.icon
                      return (
                        <div key={t.id} className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-200 hover:shadow-md transition group">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <div className="text-3xl font-black" style={{color: getServiceColor(t.serviceType)}}>
                                  #{t.queueNumber}
                                </div>
                                <div className="flex-1">
                                  <p className="font-semibold text-gray-800">{getServiceName(t.serviceType)}</p>
                                  <p className="text-xs text-gray-500 flex items-center gap-1">
                                    <StatusIcon className="w-3 h-3" />
                                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${statusInfo.color}`}>
                                      {statusInfo.label}
                                    </span>
                                  </p>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 mt-2">
                                <p>Ref: <span className="font-mono text-gray-700">{(t as StoredTicket).referenceNumber || getReferenceNumber(t.id)}</span></p>
                                <p>{formatDate(t.createdAt)}</p>
                              </div>
                            </div>
                            <button 
                              onClick={() => printTicket(t as StoredTicket)} 
                              className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-xs font-semibold transition shadow-md opacity-0 group-hover:opacity-100"
                            >
                              Print
                            </button>
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
    </div>
  )
}

export default StudentDashboard