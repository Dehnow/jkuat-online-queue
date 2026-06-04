import { useNavigate } from '@tanstack/react-router'
import { useState, useEffect, useCallback } from 'react'
import { Building2, Banknote, Headphones, Download, ChevronDown } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import OfficeManagement from '../components/OfficeManagement'
import FeedbackSystem from '../components/FeedbackSystem'
import ServiceLogFilterBar from '../components/ServiceLogFilterBar'
type QueueEntry = {
  id: number
  name: string
  studentId: string
  serviceType: string
  queueNumber: number
  status: 'waiting' | 'serving' | 'served' | 'cancelled'
  createdAt: string
  servedAt?: string
}

type ServiceQueue = {
  serviceId: string
  serviceName: string
  waitingCount: number
  serving: QueueEntry | null
  color: string
  bgColor: string
  icon: JSX.Element
}

type WaitingListEntry = {
  id: number
  ticketNumber: string
  name: string
  office: string
  waitTime: number
  createdAt: string
  isGolden?: boolean
  mpesaStatus?: string
}

// Helper: generate ticket number (e.g., REG240518)
const getTicketNumber = (entry: QueueEntry) => {
  const serviceCode = entry.serviceType === 'registrar' ? 'REG' : entry.serviceType === 'finance' ? 'FIN' : 'ICT'
  const date = new Date(entry.createdAt)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = String(date.getFullYear()).slice(-2)
  return `${serviceCode}${day}${month}${year}`
}

const getWaitTime = (createdAt: string, now: Date = new Date()) => {
  const diff = (now.getTime() - new Date(createdAt).getTime()) / (1000 * 60)
  return Math.floor(diff)
}

// Group served entries by hour for today's chart
const getHourlyServed = (entries: QueueEntry[]) => {
  const today = new Date().toDateString()
  const hourly: Record<number, number> = {}
  for (let i = 0; i < 24; i++) hourly[i] = 0
  entries.forEach(entry => {
    if (entry.servedAt && new Date(entry.servedAt).toDateString() === today) {
      const hour = new Date(entry.servedAt).getHours()
      hourly[hour] = (hourly[hour] || 0) + 1
    }
  })
  return Object.entries(hourly).map(([hour, count]) => ({ hour: parseInt(hour), count })).sort((a, b) => a.hour - b.hour)
}

const getTodayServedEntries = (entries: QueueEntry[]) => {
  const today = new Date().toDateString()
  return entries.filter(entry => entry.servedAt && new Date(entry.servedAt).toDateString() === today)
}

// Export functions
const exportToCSV = (entries: QueueEntry[]) => {
  const headers = ['Ref No', 'Ticket Number', 'Name', 'Student ID', 'Service', 'Served At']
  const rows = entries.map(entry => {
    const serviceCode = entry.serviceType === 'registrar' ? 'REG' : entry.serviceType === 'finance' ? 'FIN' : 'ICT'
    const date = new Date(entry.createdAt)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = String(date.getFullYear()).slice(-2)
    const ticketNumber = `${serviceCode}${day}${month}${year}`
    return [
      `REF-${entry.id}`,
      `#${entry.queueNumber}`,
      entry.name,
      entry.studentId,
      entry.serviceType.replace('_', ' ').toUpperCase(),
      entry.servedAt ? new Date(entry.servedAt).toLocaleString() : '—'
    ]
  })
  
  let csv = headers.join(',') + '\n'
  rows.forEach(row => {
    csv += row.map(cell => `"${cell}"`).join(',') + '\n'
  })
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `Service-Log-${new Date().toISOString().split('T')[0]}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const exportToWord = (entries: QueueEntry[]) => {
  const timestamp = new Date().toLocaleString()
  const dateFormatted = new Date().toISOString().split('T')[0]
  
  let html = `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="UTF-8"></head><body style="font-family: Calibri, Arial, sans-serif; line-height: 1.5; margin: 1in;"><h1 style="text-align: center; color: #1a5c2a; margin-bottom: 10px;">JKUAT Queue Management Service Log</h1><p style="text-align: center; color: #666; font-size: 12px; margin-bottom: 20px;">Generated: ${timestamp}</p><p><strong>Total Entries:</strong> ${entries.length}</p><table style="width: 100%; border-collapse: collapse; margin-top: 20px;"><thead><tr style="background-color: #f0f0f0; border: 1px solid #ddd;"><th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Ref No</th><th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Ticket</th><th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Name</th><th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Student ID</th><th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Service</th><th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Served At</th></tr></thead><tbody>`
  
  entries.forEach((entry, idx) => {
    const bgColor = idx % 2 === 0 ? 'white' : '#f9f9f9'
    html += `<tr style="background-color: ${bgColor}; border: 1px solid #ddd;"><td style="border: 1px solid #ddd; padding: 8px;">REF-${entry.id}</td><td style="border: 1px solid #ddd; padding: 8px;">#${entry.queueNumber}</td><td style="border: 1px solid #ddd; padding: 8px;">${entry.name}</td><td style="border: 1px solid #ddd; padding: 8px;">${entry.studentId}</td><td style="border: 1px solid #ddd; padding: 8px;">${entry.serviceType.replace('_', ' ')}</td><td style="border: 1px solid #ddd; padding: 8px;">${entry.servedAt ? new Date(entry.servedAt).toLocaleString() : '—'}</td></tr>`
  })
  
  html += `</tbody></table><footer style="margin-top: 40px; border-top: 1px solid #ddd; padding-top: 10px; font-size: 11px; color: #999; text-align: center;">This document was generated automatically by JKUAT Queue Management System. For official use only.</footer></body></html>`
  
  const blob = new Blob([html], { type: 'application/msword;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `Service-Log-${dateFormatted}.doc`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export default function AdminPage() {
  const navigate = useNavigate()
  const [loggedIn, setLoggedIn] = useState(false)
  const [auth, setAuth] = useState('')
  const [activeTab, setActiveTab] = useState<'queue' | 'report' | 'offices' | 'feedback'>('queue')
  const [selectedOffice, setSelectedOffice] = useState<'registrar' | 'finance' | 'ict_helpdesk'>('registrar')
  const [serviceQueues, setServiceQueues] = useState<ServiceQueue[]>([])
  const [waitingList, setWaitingList] = useState<WaitingListEntry[]>([])
  const [reportData, setReportData] = useState<QueueEntry[]>([])
  const [chartData, setChartData] = useState<{ hour: number; count: number }[]>([])
  const [actionLoading, setActionLoading] = useState(false)
  const [currentDateTime, setCurrentDateTime] = useState(new Date())
  const [offices, setOffices] = useState<any[]>([])
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [reportTotal, setReportTotal] = useState(0)
  const [reportFilters, setReportFilters] = useState({
    serviceType: 'all',
    status: 'served',
    days: 0,
    search: ''
  })

  // Auth check
  useEffect(() => {
    const storedAuth = sessionStorage.getItem('adminAuth')
    if (!storedAuth) {
      console.log('[Admin] No auth token found, redirecting to login')
      navigate({ to: '/login' })
      return
    }
    console.log('[Admin] Validating auth token...')
    fetch('/api/admin/report', { headers: { Authorization: `Basic ${storedAuth}` } })
      .then(res => {
        if (res.ok) {
          console.log('[Admin] Auth validation successful')
          setAuth(storedAuth)
          setLoggedIn(true)
        } else {
          console.warn('[Admin] Auth validation failed with status:', res.status)
          sessionStorage.removeItem('adminAuth')
          navigate({ to: '/login' })
        }
      })
      .catch((err) => {
        console.error('[Admin] Auth validation error:', err)
        sessionStorage.removeItem('adminAuth')
        navigate({ to: '/login' })
      })
  }, [navigate])

  // Fetch all data (queue stats and report)
  const fetchAllData = useCallback(async () => {
    if (!auth) {
      console.warn('[Admin] No auth token available, skipping data fetch')
      return
    }
    try {
      console.log('[Admin] Fetching all queue data...')
      const services = [
        { id: 'registrar', name: "Registrar's Office", color: '#16a34a', bgColor: '#dcfce7', icon: <Building2 className="w-5 h-5" /> },
        { id: 'finance', name: 'Finance Office', color: '#f59e0b', bgColor: '#fef3c7', icon: <Banknote className="w-5 h-5" /> },
        { id: 'ict_helpdesk', name: 'ICT Helpdesk', color: '#3b82f6', bgColor: '#dbeafe', icon: <Headphones className="w-5 h-5" /> }
      ]
      const queues = await Promise.all(
        services.map(async (svc) => {
          try {
            const res = await fetch(`/api/queue?service=${svc.id}`)
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            const data = await res.json()
            console.log(`[Admin] Queue data for ${svc.id}:`, data)
            return {
              serviceId: svc.id,
              serviceName: svc.name,
              waitingCount: data.waitingCount || 0,
              serving: data.serving || null,
              color: svc.color,
              bgColor: svc.bgColor,
              icon: svc.icon,
            }
          } catch (err) {
            console.error(`[Admin] Error fetching queue for ${svc.id}:`, err)
            return {
              serviceId: svc.id,
              serviceName: svc.name,
              waitingCount: 0,
              serving: null,
              color: svc.color,
              bgColor: svc.bgColor,
              icon: svc.icon,
            }
          }
        })
      )
      setServiceQueues(queues)

      // No admin-specific currentServing state required; selected office queue serves directly from selectedQueueObj.

      // Build waiting list for selected office (mock but based on real waitingCount)
      const selectedQueueData = queues.find(q => q.serviceId === selectedOffice)
      const count = selectedQueueData?.waitingCount || 0
      const waitingEntries: WaitingListEntry[] = []
      for (let i = 1; i <= Math.min(count, 10); i++) {
        const createdAt = new Date(Date.now() - i * 60000).toISOString()
        waitingEntries.push({
          id: i,
          ticketNumber: `${selectedOffice === 'registrar' ? 'REG' : selectedOffice === 'finance' ? 'FIN' : 'ICT'}${String(i).padStart(3,'0')}`,
          name: `Student ${i}`,
          office: selectedQueueData?.serviceName || '',
          waitTime: getWaitTime(createdAt),
          createdAt,
        })
      }
      setWaitingList(waitingEntries)

      // Fetch report (served entries) for graph - with filter parameters
      try {
        const params = new URLSearchParams()
        if (reportFilters.serviceType !== 'all') params.append('serviceType', reportFilters.serviceType)
        if (reportFilters.status) params.append('status', reportFilters.status)
        if (reportFilters.days > 0) params.append('days', reportFilters.days.toString())
        if (reportFilters.search) params.append('search', reportFilters.search)

        const reportUrl = `/api/admin/report${params.toString() ? '?' + params.toString() : ''}`
        const reportRes = await fetch(reportUrl, { headers: { Authorization: `Basic ${auth}` } })
        if (!reportRes.ok) throw new Error(`Report fetch failed: ${reportRes.status}`)
        const reportJson = await reportRes.json()
        const servedEntries = Array.isArray(reportJson.entries) ? reportJson.entries : reportJson
        console.log(`[Admin] Served entries count: ${servedEntries.length}`)
        setReportData(servedEntries)
        setReportTotal(reportJson.total || servedEntries.length)
        setChartData(getHourlyServed(servedEntries))
      } catch (err) {
        console.error('[Admin] Error fetching report:', err)
        // Continue without report data rather than failing completely
      }
    } catch (err) {
      console.error('[Admin] fetchAllData error:', err)
    }
  }, [auth, selectedOffice, reportFilters])

  useEffect(() => {
    if (loggedIn) {
      fetchAllData()
      const interval = setInterval(fetchAllData, 8000)
      return () => clearInterval(interval)
    }
  }, [loggedIn, auth, selectedOffice])

  // Listen for ticket creation events from other parts of the app and refresh immediately
  useEffect(() => {
    const handler = () => {
      if (loggedIn) fetchAllData()
    }
    try {
      window.addEventListener('ticketCreated', handler as EventListener)
    } catch (e) {}
    return () => {
      try { window.removeEventListener('ticketCreated', handler as EventListener) } catch (e) {}
    }
  }, [loggedIn, fetchAllData])

  // Listen for service log updates from staff dashboard
  useEffect(() => {
    const handler = () => {
      console.log('[Admin] Service log updated event received, refreshing data...')
      if (loggedIn) fetchAllData()
    }
    try {
      window.addEventListener('serviceLogUpdated', handler as EventListener)
    } catch (e) {}
    return () => {
      try { window.removeEventListener('serviceLogUpdated', handler as EventListener) } catch (e) {}
    }
  }, [loggedIn, fetchAllData])

  // Fetch offices
  useEffect(() => {
    const fetchOffices = async () => {
      try {
        const res = await fetch('/api/admin/offices', {
          headers: { Authorization: `Basic ${auth}` }
        })
        if (res.ok) {
          const data = await res.json()
          setOffices(data.offices || [])
        }
      } catch (err) {
        console.error('[Admin] Error fetching offices:', err)
      }
    }

    if (auth) {
      fetchOffices()
      const interval = setInterval(fetchOffices, 15000)
      return () => clearInterval(interval)
    }
  }, [auth])

  useEffect(() => {
    const timer = setInterval(() => setCurrentDateTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const serveNext = async () => {
    setActionLoading(true)
    try {
      console.log(`[Admin] Serving next for service: ${selectedOffice}`)
      const res = await fetch('/api/admin/serve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
        body: JSON.stringify({ serviceType: selectedOffice, action: 'serve_next' }),
      })
      
      if (!res.ok) {
        console.error(`[Admin] Serve Next failed with status ${res.status}`)
        throw new Error(`Serve failed: ${res.status}`)
      }
      
      const data = await res.json()
      console.log(`[Admin] Serve successful:`, data)
      await fetchAllData()
      try {
        window.dispatchEvent(new Event('serviceHistoryUpdated'))
      } catch (e) {
        console.warn('[Admin] Unable to dispatch service history update event', e)
      }
    } catch (err) {
      console.error('[Admin] Serve Next error:', err)
    } finally {
      setActionLoading(false)
    }
  }

  const resetAllQueues = async () => {
    if (!window.confirm('⚠️ Are you sure you want to reset ALL queues? This will clear all queue entries and prepare the system for the next day.')) {
      return
    }
    
    setActionLoading(true)
    try {
      console.log('[Admin] Resetting all queues...')
      const res = await fetch('/api/admin/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
      })
      
      if (!res.ok) {
        console.error(`[Admin] Reset failed with status ${res.status}`)
        throw new Error(`Reset failed: ${res.status}`)
      }
      
      const data = await res.json()
      console.log('[Admin] Reset successful:', data)
      await fetchAllData()
      alert('✅ All queues have been reset successfully!')
    } catch (err) {
      console.error('[Admin] Reset error:', err)
      alert('❌ Failed to reset queues. Please try again.')
    } finally {
      setActionLoading(false)
    }
  }


  if (!loggedIn) return null

  const selectedQueueObj = serviceQueues.find(q => q.serviceId === selectedOffice)
  const selectedCount = selectedQueueObj?.waitingCount || 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 font-['Inter',system-ui] relative overflow-x-hidden">
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-green-100/30 rounded-full filter blur-3xl pointer-events-none"></div>
      <div className="absolute top-1/3 left-1/4 w-64 h-64 bg-green-200/20 rounded-full filter blur-3xl pointer-events-none"></div>

      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src="/queue-bg.jpeg" alt="JKUAT" className="w-16 h-16 rounded-full border-2 border-green-100 shadow-sm" />
            <div>
              <h1 className="text-3xl font-bold text-green-600">Admin Control Panel</h1>
              <p className="text-gray-500 text-base">JKUAT Queue Management</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center text-white text-xl font-bold">A</div>
              <span className="text-xl font-semibold text-gray-800">Admin User</span>
            </div>
            <button
              onClick={() => {
                sessionStorage.removeItem('adminAuth')
                navigate({ to: '/login' })
              }}
              className="flex items-center gap-2 border border-red-300 bg-red-50 text-red-600 px-4 py-2 rounded-xl hover:bg-red-100 transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex gap-6 mb-8 border-b pb-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('queue')}
            className={`flex items-center gap-2 text-lg font-semibold pb-2 transition-all whitespace-nowrap ${activeTab === 'queue' ? 'text-green-600 border-b-2 border-green-600' : 'text-gray-500'}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
            Queue Management
          </button>
          <button
            onClick={() => setActiveTab('report')}
            className={`flex items-center gap-2 text-lg font-semibold pb-2 transition-all whitespace-nowrap ${activeTab === 'report' ? 'text-green-600 border-b-2 border-green-600' : 'text-gray-500'}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            Service Report
          </button>
          <button
            onClick={() => setActiveTab('offices')}
            className={`flex items-center gap-2 text-lg font-semibold pb-2 transition-all whitespace-nowrap ${activeTab === 'offices' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
            Offices
          </button>
          <button
            onClick={() => setActiveTab('feedback')}
            className={`flex items-center gap-2 text-lg font-semibold pb-2 transition-all whitespace-nowrap ${activeTab === 'feedback' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-500'}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
            Feedback
          </button>
        </div>

        {activeTab === 'queue' && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div
                onClick={() => setSelectedOffice('registrar')}
                className={`bg-white/90 backdrop-blur-sm rounded-2xl shadow-md p-5 border-l-4 transition-all cursor-pointer hover:shadow-lg ${selectedOffice === 'registrar' ? 'border-green-600 ring-2 ring-green-200' : 'border-green-600'}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center"><Building2 className="w-6 h-6 text-green-600" /></div>
                    <div><p className="text-gray-600 text-sm">Registrar's Office</p><p className="text-4xl font-extrabold text-green-600">{serviceQueues.find(q => q.serviceId === 'registrar')?.waitingCount || 0}</p><p className="text-xs text-gray-400">people</p></div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate({ to: '/admin-report/registrar' })
                      }}
                      className="w-8 h-8 bg-green-100 hover:bg-green-200 rounded-full flex items-center justify-center transition"
                      title="View Report"
                    >
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                    </button>
                    <svg className="w-8 h-8 text-green-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                  </div>
                </div>
              </div>
              <div
                onClick={() => setSelectedOffice('finance')}
                className={`bg-white/90 backdrop-blur-sm rounded-2xl shadow-md p-5 border-l-4 transition-all cursor-pointer hover:shadow-lg ${selectedOffice === 'finance' ? 'border-amber-500 ring-2 ring-amber-200' : 'border-amber-500'}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center"><Banknote className="w-6 h-6 text-amber-500" /></div>
                    <div><p className="text-gray-600 text-sm">Finance Office</p><p className="text-4xl font-extrabold text-amber-500">{serviceQueues.find(q => q.serviceId === 'finance')?.waitingCount || 0}</p><p className="text-xs text-gray-400">people</p></div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate({ to: '/admin-report/finance' })
                      }}
                      className="w-8 h-8 bg-amber-100 hover:bg-amber-200 rounded-full flex items-center justify-center transition"
                      title="View Report"
                    >
                      <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                    </button>
                    <svg className="w-8 h-8 text-amber-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                  </div>
                </div>
              </div>
              <div
                onClick={() => setSelectedOffice('ict_helpdesk')}
                className={`bg-white/90 backdrop-blur-sm rounded-2xl shadow-md p-5 border-l-4 transition-all cursor-pointer hover:shadow-lg ${selectedOffice === 'ict_helpdesk' ? 'border-blue-500 ring-2 ring-blue-200' : 'border-blue-500'}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center"><Headphones className="w-6 h-6 text-blue-500" /></div>
                    <div><p className="text-gray-600 text-sm">ICT Helpdesk</p><p className="text-4xl font-extrabold text-blue-500">{serviceQueues.find(q => q.serviceId === 'ict_helpdesk')?.waitingCount || 0}</p><p className="text-xs text-gray-400">people</p></div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate({ to: '/admin-report/ict_helpdesk' })
                      }}
                      className="w-8 h-8 bg-blue-100 hover:bg-blue-200 rounded-full flex items-center justify-center transition"
                      title="View Report"
                    >
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                    </button>
                    <svg className="w-8 h-8 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" /></svg>
                  </div>
                </div>
              </div>
              <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-md p-5 flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center"><svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></div>
                  <span className="text-sm font-semibold text-green-600">● Live</span>
                </div>
                <p className="text-lg font-semibold text-gray-800">{currentDateTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                <p className="text-2xl font-bold text-gray-900">{currentDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
              </div>
            </div>

            {/* Two-column grid */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
              <div className="lg:col-span-3 space-y-8">
                {/* Removed admin currently-serving board; staff shows this board instead. */}

                {/* Waiting Queue Table */}
                <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-md p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                    <h2 className="text-xl font-bold text-gray-800">Waiting Queue – {selectedQueueObj?.serviceName}</h2>
                    <span className="bg-gray-200 text-gray-700 text-xs font-semibold px-2 py-1 rounded-full ml-2">{selectedCount}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-500">
                        <tr>
                          <th className="p-2 text-left">#</th>
                          <th className="p-2 text-left">Ticket</th>
                          <th className="p-2 text-left">Student / Client</th>
                          <th className="p-2 text-left">Office</th>
                          <th className="p-2 text-left">Wait Time</th>
                          <th className="p-2 text-center">Priority</th>
                        </tr>
                      </thead>
                      <tbody>
                        {waitingList.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-4 text-center text-gray-400">No one waiting in this queue</td>
                          </tr>
                        ) : (
                          waitingList.slice(0, 5).map((item, idx) => (
                            <tr key={item.id} className={`border-t ${item.isGolden && item.mpesaStatus === 'success' ? 'bg-yellow-50' : ''}`}>
                              <td className="p-2 text-gray-400">{idx+1}</td>
                              <td className="p-2 font-mono font-bold">
                                <span>{item.ticketNumber}</span>
                                {item.isGolden && item.mpesaStatus === 'success' && (
                                  <span className="ml-2 text-yellow-600">✨</span>
                                )}
                              </td>
                              <td className="p-2">{item.name}</td>
                              <td className="p-2">{item.office}</td>
                              <td className="p-2 flex items-center gap-1">
                                <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                {item.waitTime} mins
                              </td>
                              <td className="p-2 text-center">
                                {item.isGolden ? (
                                  <span className="inline-block px-2 py-1 rounded-full text-xs font-bold bg-yellow-200 text-yellow-900">
                                    {item.mpesaStatus === 'success' ? '🥇 Gold' : '⏳ Pending'}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 text-xs">Regular</span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="text-center mt-4">
                    <button className="text-green-600 font-semibold text-sm hover:underline">View Full Waiting List →</button>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-2 space-y-8">
                {/* Queue Statistics Graph */}
                <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-md p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2"><svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg><h3 className="text-lg font-bold text-gray-800">Persons Served Today</h3></div>
                    <button className="text-gray-400 hover:text-gray-600">⋯</button>
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs><linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#16a34a" stopOpacity={0.3}/><stop offset="95%" stopColor="#16a34a" stopOpacity={0}/></linearGradient></defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb"/>
                        <XAxis dataKey="hour" tickFormatter={(hour) => `${hour}:00`} stroke="#9ca3af" />
                        <YAxis stroke="#9ca3af" />
                        <Tooltip />
                        <Area type="monotone" dataKey="count" stroke="#16a34a" fill="url(#colorCount)" strokeWidth={2} dot={{ r: 4, fill: '#16a34a' }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-md p-6">
                  <div className="flex items-center gap-2 mb-4"><svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg><h3 className="text-lg font-bold text-gray-800">Quick Actions</h3></div>
                  <div className="space-y-4">
                    <div className="bg-gradient-to-r from-red-50 to-red-100 rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:shadow-md transition" onClick={resetAllQueues} disabled={actionLoading}>
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center shadow-md"><svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg></div>
                        <div><p className="font-bold text-red-800 text-lg">{actionLoading ? 'Resetting...' : 'Reset All Queues'}</p><p className="text-xs text-gray-500">Clear all entries for next day</p></div>
                      </div>
                      <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                    </div>
                    <div className="bg-white rounded-xl p-3 flex items-center justify-between border border-gray-100 cursor-pointer hover:shadow-md transition" onClick={() => setActiveTab('report')}>
                      <div className="flex items-center gap-3"><div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center"><svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg></div><div><p className="font-semibold">View Reports</p><p className="text-xs text-gray-400">Daily & monthly</p></div></div>
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                    </div>
                    <div className="bg-white rounded-xl p-3 flex items-center justify-between border border-gray-100 cursor-pointer hover:shadow-md transition" onClick={() => setActiveTab('offices')}>
                      <div className="flex items-center gap-3"><div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center"><svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg></div><div><p className="font-semibold">Offices</p><p className="text-xs text-gray-400">Manage all offices</p></div></div>
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Notice Bar */}
            <div className="mt-8 bg-green-50/80 backdrop-blur-sm rounded-full py-3 px-6 flex items-center justify-center gap-3 shadow-sm border border-green-100">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              <span className="text-green-800 text-sm font-medium">Manage queues efficiently. Ensure fairness, transparency and excellent service delivery.</span>
            </div>
          </>
        )}

        {activeTab === 'report' && (
          <div className="space-y-8">
            <ServiceLogFilterBar
              filters={reportFilters}
              onFiltersChange={setReportFilters}
              totalCount={reportTotal}
            />

            <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-md p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">Service Log</h2>
                  <p className="text-sm text-gray-500 mt-1">All served queue entries from all offices.</p>
                </div>
                <div className="relative">
                  <button
                    onClick={() => setExportMenuOpen(!exportMenuOpen)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm"
                  >
                    <Download className="w-4 h-4" />
                    Export
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  {exportMenuOpen && (
                    <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                      <button
                        onClick={() => {
                          exportToCSV(reportData)
                          setExportMenuOpen(false)
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors text-gray-700 font-medium text-sm border-b border-gray-100"
                      >
                        📊 Export to Excel
                      </button>
                      <button
                        onClick={() => {
                          exportToWord(reportData)
                          setExportMenuOpen(false)
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors text-gray-700 font-medium text-sm"
                      >
                        📄 Export to Word
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-2xl">
                <p className="text-sm text-blue-700"><strong>Total entries:</strong> {reportData.length}</p>
              </div>
              {reportData.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center text-gray-400">No service entries found.</div>
              ) : (
                <div className="grid gap-4">
                  {reportData.map(entry => (
                    <div key={entry.id} className="rounded-3xl border border-gray-200 bg-gray-50 p-5 shadow-sm hover:shadow-md transition-shadow">
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">Ref No</label>
                          <p className="mt-1 text-lg font-semibold text-gray-800">REF-{entry.id}</p>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">Ticket</label>
                          <p className="mt-1 text-lg font-bold text-green-600">#{entry.queueNumber}</p>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">Service</label>
                          <p className="mt-1 text-gray-700 capitalize font-medium">{entry.serviceType.replace('_', ' ')}</p>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">Name</label>
                          <p className="mt-1 text-gray-700">{entry.name}</p>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">Student ID</label>
                          <p className="mt-1 text-gray-700">{entry.studentId}</p>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">Served At</label>
                          <p className="mt-1 text-gray-700">{entry.servedAt ? new Date(entry.servedAt).toLocaleString() : '—'}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'offices' && loggedIn && auth && (
          <OfficeManagement
            offices={offices}
            onCreateOffice={async () => {
              // Refetch offices after creation
              const res = await fetch('/api/admin/offices', {
                headers: { Authorization: `Basic ${auth}` }
              })
              if (res.ok) {
                const data = await res.json()
                setOffices(data.offices || [])
              }
            }}
            onDeleteOffice={async () => {
              // Refetch offices after deletion
              const res = await fetch('/api/admin/offices', {
                headers: { Authorization: `Basic ${auth}` }
              })
              if (res.ok) {
                const data = await res.json()
                setOffices(data.offices || [])
              }
            }}
            onEditOffice={async () => {
              // Refetch offices after editing
              const res = await fetch('/api/admin/offices', {
                headers: { Authorization: `Basic ${auth}` }
              })
              if (res.ok) {
                const data = await res.json()
                setOffices(data.offices || [])
              }
            }}
            adminAuth={auth}
          />
        )}

        {activeTab === 'feedback' && loggedIn && auth && (
          <FeedbackSystem adminAuth={auth} offices={offices} />
        )}
      </main>
    </div>
  )
}

// Icon components


