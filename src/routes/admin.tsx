import { useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { Building2, Banknote, Headphones } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
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

export default function AdminPage() {
  const navigate = useNavigate()
  const [loggedIn, setLoggedIn] = useState(false)
  const [auth, setAuth] = useState('')
  const [activeTab, setActiveTab] = useState<'queue' | 'report'>('queue')
  const [selectedOffice, setSelectedOffice] = useState<'registrar' | 'finance' | 'ict_helpdesk'>('registrar')
  const [serviceQueues, setServiceQueues] = useState<ServiceQueue[]>([])
  const [currentServing, setCurrentServing] = useState<QueueEntry | null>(null)
  const [waitingList, setWaitingList] = useState<WaitingListEntry[]>([])
  const [reportData, setReportData] = useState<QueueEntry[]>([])
  const [chartData, setChartData] = useState<{ hour: number; count: number }[]>([])
  const [actionLoading, setActionLoading] = useState(false)
  const [currentDateTime, setCurrentDateTime] = useState(new Date())

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
  const fetchAllData = async () => {
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

      // Update current serving for selected office
      const selectedQueue = queues.find(q => q.serviceId === selectedOffice)
      setCurrentServing(selectedQueue?.serving || null)

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

      // Fetch report (served entries) for graph
      try {
        const reportRes = await fetch('/api/admin/report', { headers: { Authorization: `Basic ${auth}` } })
        if (!reportRes.ok) throw new Error(`Report fetch failed: ${reportRes.status}`)
        const servedEntries = await reportRes.json()
        console.log(`[Admin] Served entries count: ${servedEntries.length}`)
        setReportData(servedEntries)
        setChartData(getHourlyServed(servedEntries))
      } catch (err) {
        console.error('[Admin] Error fetching report:', err)
        // Continue without report data rather than failing completely
      }
    } catch (err) {
      console.error('[Admin] fetchAllData error:', err)
    }
  }

  useEffect(() => {
    if (loggedIn) {
      fetchAllData()
      const interval = setInterval(fetchAllData, 8000)
      return () => clearInterval(interval)
    }
  }, [loggedIn, auth, selectedOffice])

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
    } catch (err) {
      console.error('[Admin] Serve Next error:', err)
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
            <div className="relative">
              <svg className="w-7 h-7 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full px-1.5">3</span>
            </div>
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
        <div className="flex gap-12 mb-8 border-b pb-2">
          <button
            onClick={() => setActiveTab('queue')}
            className={`flex items-center gap-2 text-lg font-semibold pb-2 transition-all ${activeTab === 'queue' ? 'text-green-600 border-b-2 border-green-600' : 'text-gray-500'}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
            Queue Management
          </button>
          <button
            onClick={() => setActiveTab('report')}
            className={`flex items-center gap-2 text-lg font-semibold pb-2 transition-all ${activeTab === 'report' ? 'text-green-600 border-b-2 border-green-600' : 'text-gray-500'}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            Service Report
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
                  <svg className="w-8 h-8 text-green-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
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
                  <svg className="w-8 h-8 text-amber-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
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
                  <svg className="w-8 h-8 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" /></svg>
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
                {/* Currently Serving Card */}
                <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-md p-6">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      <h2 className="text-xl font-bold text-gray-800">Currently Serving – {selectedQueueObj?.serviceName}</h2>
                    </div>
                    <button
                      onClick={serveNext}
                      disabled={actionLoading}
                      className="bg-gradient-to-r from-green-600 to-green-500 text-white px-5 py-2 rounded-xl font-semibold shadow-md hover:shadow-lg transition disabled:opacity-50 flex items-center gap-2"
                    >
                      {actionLoading ? '...' : '▶ Serve Next'}
                    </button>
                  </div>
                  {currentServing ? (
                    <div className="bg-green-50 rounded-2xl p-6 flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                          {selectedOffice === 'registrar' ? <Building2 className="w-10 h-10 text-green-600" /> : selectedOffice === 'finance' ? <Banknote className="w-10 h-10 text-amber-500" /> : <Headphones className="w-10 h-10 text-blue-600" />}
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold text-green-700">{selectedQueueObj?.serviceName}</h3>
                          <p className="text-gray-500">Ticket: {getTicketNumber(currentServing)}</p>
                          <span className="inline-block bg-green-500 text-white text-xs px-2 py-1 rounded-full mt-1">Now Serving</span>
                          <p className="text-sm text-gray-600 mt-2">Please proceed to the counter</p>
                        </div>
                      </div>
                      <div className="text-8xl font-black bg-gradient-to-r from-green-600 to-green-500 bg-clip-text text-transparent">#{currentServing.queueNumber}</div>
                    </div>
                  ) : (
                    <div className="bg-green-50 rounded-2xl p-10 text-center text-gray-500">No one is currently being served for this office</div>
                  )}
                </div>

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
                        </tr>
                      </thead>
                      <tbody>
                        {waitingList.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-4 text-center text-gray-400">No one waiting in this queue</td>
                          </tr>
                        ) : (
                          waitingList.slice(0, 5).map((item, idx) => (
                            <tr key={item.id} className="border-t">
                              <td className="p-2 text-gray-400">{idx+1}</td>
                              <td className="p-2 font-mono font-bold">{item.ticketNumber}</td>
                              <td className="p-2">{item.name}</td>
                              <td className="p-2">{item.office}</td>
                              <td className="p-2 flex items-center gap-1">
                                <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                {item.waitTime} mins
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
                    <div className="flex items-center gap-2"><svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg><h3 className="text-lg font-bold text-gray-800">Queue Statistics (Today)</h3></div>
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
                    <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:shadow-md transition" onClick={serveNext}>
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center shadow-md"><svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /></svg></div>
                        <div><p className="font-bold text-green-800 text-lg">Serve Next</p><p className="text-xs text-gray-500">Call next in line</p></div>
                      </div>
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                    </div>
                    <div className="bg-white rounded-xl p-3 flex items-center justify-between border border-gray-100">
                      <div className="flex items-center gap-3"><div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center"><svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg></div><div><p className="font-semibold">View Reports</p><p className="text-xs text-gray-400">Daily & monthly</p></div></div>
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                    </div>
                    <div className="bg-white rounded-xl p-3 flex items-center justify-between border border-gray-100">
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
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-md p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Service Report</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-2 text-left">Ref No</th>
                    <th className="p-2 text-left">Queue No</th>
                    <th className="p-2 text-left">Name</th>
                    <th className="p-2 text-left">Student ID</th>
                    <th className="p-2 text-left">Service</th>
                    <th className="p-2 text-left">Served At</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.slice(0, 10).map(entry => (
                    <tr key={entry.id} className="border-t">
                      <td className="p-2 font-mono text-green-600">REF-{entry.id}</td>
                      <td className="p-2 font-bold">#{entry.queueNumber}</td>
                      <td className="p-2">{entry.name}</td>
                      <td className="p-2">{entry.studentId}</td>
                      <td className="p-2">{entry.serviceType}</td>
                      <td className="p-2">{entry.servedAt ? new Date(entry.servedAt).toLocaleString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

// Icon components


