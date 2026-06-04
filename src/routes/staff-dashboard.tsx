import { useNavigate } from '@tanstack/react-router'
import { useEffect, useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Phone, Play, Square, X, Power, LogOut } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

type QueueEntry = {
  id: number
  name: string
  studentId: string
  queueNumber: number
  status: 'waiting' | 'serving' | 'served' | 'cancelled'
  createdAt: string
  servedAt?: string
}

// Helper: Generate hourly served data for today
const getHourlyServedData = (entries: QueueEntry[]) => {
  const today = new Date().toDateString()
  const hourly: Record<number, number> = {}
  for (let i = 0; i < 24; i++) hourly[i] = 0
  
  entries.forEach(entry => {
    if (entry.servedAt && new Date(entry.servedAt).toDateString() === today) {
      const hour = new Date(entry.servedAt).getHours()
      hourly[hour] = (hourly[hour] || 0) + 1
    }
  })
  
  return Object.entries(hourly)
    .map(([hour, count]) => ({ 
      hour: parseInt(hour),
      time: `${String(parseInt(hour)).padStart(2, '0')}:00`,
      served: count 
    }))
    .sort((a, b) => a.hour - b.hour)
}

// Live Queue Dispatch Animation Engine
const updateQueueDisplay = (newTicketNumber: number, newPhoneName: string, newIdName: string) => {
  const ticketEl = document.getElementById('ticketNumber')
  const phoneEl = document.getElementById('customerPhone')
  const idEl = document.getElementById('customerId')
  
  if (!ticketEl || !phoneEl || !idEl) return

  // Exit Phase: Slide left & fade out (150ms)
  ticketEl.classList.add('animate-queue-exit')
  phoneEl.classList.add('animate-queue-exit')
  idEl.classList.add('animate-queue-exit')

  setTimeout(() => {
    // Replace text values
    ticketEl.textContent = `#${newTicketNumber}`
    phoneEl.textContent = newPhoneName
    idEl.textContent = `ID: ${newIdName}`

    // Clear exit animation classes
    ticketEl.classList.remove('animate-queue-exit')
    phoneEl.classList.remove('animate-queue-exit')
    idEl.classList.remove('animate-queue-exit')

    // Entry Phase: Slide in from right & fade up
    phoneEl.classList.add('animate-queue-entry')
    idEl.classList.add('animate-queue-entry')

    // Emphasis Phase: Scale up to 1.15x (catch attention)
    ticketEl.style.transform = 'scale(1.15)'

    // Settle Phase: Scale back to 1.0 smoothly
    setTimeout(() => {
      ticketEl.style.transition = 'transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1)'
      ticketEl.style.transform = 'scale(1.0)'
      
      // Cleanup
      setTimeout(() => {
        phoneEl.classList.remove('animate-queue-entry')
        idEl.classList.remove('animate-queue-entry')
        ticketEl.style.transition = ''
      }, 300)
    }, 100)
  }, 150)
}

export default function StaffDashboard() {
  const navigate = useNavigate()
  const [officeId, setOfficeId] = useState<number | null>(null)
  const [officeName, setOfficeName] = useState<string>('')
  const [officeStatus, setOfficeStatus] = useState<'open' | 'closed'>('open')
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [currentDateTime, setCurrentDateTime] = useState(new Date())
  const [activeWorkflowStep, setActiveWorkflowStep] = useState<'call_next' | 'start_service' | 'end_service' | null>('call_next')

  // Get office info from session
  useEffect(() => {
    const office = sessionStorage.getItem('officeId')
    const name = sessionStorage.getItem('officeName')
    const auth = sessionStorage.getItem('staffAuth')
    const role = sessionStorage.getItem('userRole')

    if (!auth || role !== 'staff' || !office) {
      navigate({ to: '/login' })
      return
    }

    setOfficeId(parseInt(office))
    setOfficeName(name || 'Office')
  }, [navigate])

  // Update current time
  useEffect(() => {
    const timer = setInterval(() => setCurrentDateTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Fetch queue status
  const { data: queueData, isLoading, refetch } = useQuery({
    queryKey: ['staff-queue', officeId],
    queryFn: async () => {
      if (!officeId) return null
      const res = await fetch(`/api/staff/queue/${officeId}`)
      if (!res.ok) throw new Error('Failed to fetch queue')
      return res.json()
    },
    refetchInterval: 3000,
    enabled: !!officeId,
  })

  // Queue action handler
  const performQueueAction = useCallback(async (action: string, queueId?: number) => {
    if (!officeId) return
    setActionLoading(true)
    setError('')

    try {
      const res = await fetch('/api/staff/queue-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          queueId: queueId || queueData?.queue?.serving?.id,
          officeId,
        }),
      })

      const result = await res.json()
      if (res.ok) {
        // Update workflow state based on action performed
        if (action === 'call_next') {
          setActiveWorkflowStep('start_service')
        } else if (action === 'start_service') {
          setActiveWorkflowStep('end_service')
        } else if (action === 'end_service' || action === 'cancel') {
          setActiveWorkflowStep('call_next')
        }
        await refetch()
      } else {
        setError(result.error || 'Action failed')
      }
    } catch (err) {
      setError('Network error')
      console.error(err)
    } finally {
      setActionLoading(false)
    }
  }, [officeId, queueData, refetch])

  // Toggle office status
  const toggleOfficeStatus = async () => {
    if (!officeId) return
    const newStatus = officeStatus === 'open' ? 'closed' : 'open'
    
    try {
      const res = await fetch('/api/staff/office-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ officeId, status: newStatus }),
      })

      if (res.ok) {
        setOfficeStatus(newStatus)
      } else {
        setError('Failed to update office status')
      }
    } catch (err) {
      setError('Network error')
      console.error(err)
    }
  }



  // Logout
  const handleLogout = () => {
    sessionStorage.removeItem('staffAuth')
    sessionStorage.removeItem('officeId')
    sessionStorage.removeItem('officeName')
    sessionStorage.removeItem('userRole')
    navigate({ to: '/login' })
  }

  const queue = queueData?.queue || { waiting: [], serving: null, served: [], cancelled: [] }
  const totalWaiting = queue.waiting?.length || 0
  const isServing = !!queue.serving
  const chartData = getHourlyServedData(queue.served || [])
  const totalServedToday = queue.served?.filter((e: QueueEntry) => 
    new Date(e.servedAt || '').toDateString() === new Date().toDateString()
  ).length || 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 font-['Inter',system-ui] relative overflow-x-hidden">
      {/* Decorative shapes - Green accents to match admin */}
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-green-100/30 rounded-full filter blur-3xl pointer-events-none"></div>
      <div className="absolute top-1/3 left-1/4 w-64 h-64 bg-green-200/20 rounded-full filter blur-3xl pointer-events-none"></div>

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src="/queue-bg.jpeg" alt="JKUAT" className="w-16 h-16 rounded-full border-2 border-green-100 shadow-sm" />
            <div>
              <h1 className="text-3xl font-bold text-green-600">Staff Dashboard</h1>
              <p className="text-gray-600">{officeName} • {currentDateTime.toLocaleTimeString()}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={toggleOfficeStatus}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all ${
                officeStatus === 'open'
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-red-100 text-red-700 hover:bg-red-200'
              }`}
            >
              <Power className="w-5 h-5" />
              {officeStatus === 'open' ? 'OPEN' : 'CLOSED'}
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 font-semibold transition-all"
            >
              <LogOut className="w-5 h-5" />
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-300 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* Live Queue Status Board */}
        <div className="mb-8">
          {/* Current Service Status */}
          <div className="space-y-6">
            {/* Current Serving Board - Premium Minimalist Design */}
            {queue.serving ? (
              <div 
                id="currentlyServingCard"
                className="w-full max-w-sm mx-auto bg-white rounded-xl shadow-lg overflow-hidden transition-all duration-300 ease-out hover:shadow-xl hover:-translate-y-1"
                style={{
                  maxWidth: '420px',
                  minHeight: '180px',
                  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.08)',
                }}
              >
                {/* Header Container: 60px height */}
                <div 
                  className="flex items-center justify-between px-6"
                  style={{ height: '60px' }}
                >
                  {/* Left Wing: Golden Icon */}
                  <div 
                    className="flex items-center justify-center rounded-full flex-shrink-0"
                    style={{
                      width: '40px',
                      height: '40px',
                      backgroundColor: '#FDB813',
                    }}
                  >
                    <svg 
                      className="w-5 h-5"
                      fill="white" 
                      stroke="white" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>

                  {/* Right Wing: Typography Cluster */}
                  <div className="flex-1 ml-4">
                    <h3 
                      className="font-bold tracking-tight text-gray-900"
                      style={{
                        fontSize: '26px',
                        fontWeight: 700,
                        fontFamily: "'Inter', 'SF Pro Display', sans-serif",
                        lineHeight: 1.2,
                        margin: 0,
                      }}
                    >
                      Currently Serving
                    </h3>
                    <p 
                      className="text-gray-500 mt-0.5"
                      style={{
                        fontSize: '14px',
                        fontWeight: 400,
                        fontFamily: "'Inter', 'SF Pro Display', sans-serif",
                        margin: 0,
                      }}
                    >
                      {officeName}
                    </p>
                  </div>
                </div>

                {/* Body Information Panel */}
                <div 
                  className="mx-4 mb-4 rounded-lg flex items-center justify-between overflow-hidden"
                  style={{
                    height: '90px',
                    backgroundColor: '#FFF8EA',
                    padding: '0 20px',
                  }}
                >
                  {/* Block A: Ticket Number with Pulse */}
                  <div 
                    id="ticketNumber"
                    className="animate-pulse-queue"
                    style={{
                      fontSize: '56px',
                      fontWeight: 800,
                      lineHeight: 1,
                      color: '#FDB813',
                      fontFamily: "'Inter', 'SF Pro Display', sans-serif",
                    }}
                  >
                    #{queue.serving.queueNumber}
                  </div>

                  {/* Block B: Divider */}
                  <div 
                    style={{
                      width: '1px',
                      height: '55px',
                      backgroundColor: 'rgba(253, 184, 19, 0.25)',
                      margin: '0 20px',
                    }}
                  />

                  {/* Block C: Customer Info */}
                  <div 
                    className="flex flex-col justify-center flex-1"
                    style={{
                      minWidth: '140px',
                    }}
                  >
                    <p 
                      id="customerPhone"
                      className="animate-queue-entry"
                      style={{
                        fontSize: '20px',
                        fontWeight: 700,
                        color: '#111827',
                        fontFamily: "'Inter', 'SF Pro Display', sans-serif",
                        margin: 0,
                        lineHeight: 1.3,
                      }}
                    >
                      {queue.serving.name}
                    </p>
                    <p 
                      id="customerId"
                      className="animate-queue-entry"
                      style={{
                        fontSize: '14px',
                        fontWeight: 400,
                        color: '#6B7280',
                        fontFamily: "'Inter', 'SF Pro Display', sans-serif",
                        margin: '4px 0 0 0',
                      }}
                    >
                      ID: {queue.serving.studentId}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div 
                className="w-full max-w-sm mx-auto bg-white rounded-xl shadow-lg p-6 text-center"
                style={{
                  maxWidth: '420px',
                  minHeight: '180px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <p className="text-gray-400 text-base">No one is currently being served.</p>
              </div>
            )}
            
            {/* Animation Styles */}
            <style>{`
              @keyframes pulse-queue {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.05); }
              }
              
              .animate-pulse-queue {
                animation: pulse-queue 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
              }
              
              @keyframes queue-enter {
                from {
                  opacity: 0;
                  transform: translateX(20px);
                }
                to {
                  opacity: 1;
                  transform: translateX(0);
                }
              }
              
              .animate-queue-entry {
                animation: queue-enter 0.5s ease-out;
              }
              
              @keyframes queue-exit {
                from {
                  opacity: 1;
                  transform: translateX(0);
                }
                to {
                  opacity: 0;
                  transform: translateX(-20px);
                }
              }
              
              .animate-queue-exit {
                animation: queue-exit 0.15s ease-in forwards;
              }
            `}</style>
            

            {/* Waiting Queue List */}
            <div className="bg-white rounded-3xl shadow-lg p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-2a6 6 0 0112 0v2z" /></svg>
                  <h3 className="text-lg font-bold text-gray-800">Waiting Queue</h3>
                </div>
                <span className="bg-blue-100 text-blue-700 text-sm font-bold px-3 py-1 rounded-full">{totalWaiting}</span>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 text-xs font-semibold">
                    <tr>
                      <th className="p-3 text-left">#</th>
                      <th className="p-3 text-left">Ticket #</th>
                      <th className="p-3 text-left">Customer Name</th>
                      <th className="p-3 text-left">Student ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {totalWaiting === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-gray-400">
                          Queue is empty - All customers served
                        </td>
                      </tr>
                    ) : (
                      queue.waiting?.slice(0, 5).map((entry: QueueEntry, idx: number) => (
                        <tr key={entry.id} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="p-3 text-gray-500">{idx + 1}</td>
                          <td className="p-3 font-mono font-bold text-blue-600">#{entry.queueNumber}</td>
                          <td className="p-3 font-medium text-gray-800">{entry.name}</td>
                          <td className="p-3 text-gray-600">{entry.studentId}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {totalWaiting > 5 && (
                <div className="text-center mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-500">+{totalWaiting - 5} more in queue</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Queue Control Panel */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Queue Controls</h2>
          
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
            </div>
          ) : (
            <div className="flex gap-3 flex-wrap">
              {/* CALL NEXT - Available when queue waiting and not serving */}
              <button
                onClick={() => performQueueAction('call_next')}
                disabled={totalWaiting === 0 || activeWorkflowStep !== 'call_next' || actionLoading}
                className={`flex items-center gap-2 px-6 py-3 text-white rounded-lg font-semibold transition-all ${
                  activeWorkflowStep === 'call_next' && totalWaiting > 0
                    ? 'bg-gradient-to-r from-blue-700 to-blue-600 hover:shadow-2xl shadow-lg shadow-blue-500/50 animate-pulse'
                    : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:shadow-lg'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <Phone className="w-5 h-5" />
                CALL NEXT
              </button>

              {/* START SERVICE - Active after CALL NEXT */}
              <button
                onClick={() => performQueueAction('start_service')}
                disabled={activeWorkflowStep !== 'start_service' || actionLoading}
                className={`flex items-center gap-2 px-6 py-3 text-white rounded-lg font-semibold transition-all ${
                  activeWorkflowStep === 'start_service'
                    ? 'bg-gradient-to-r from-green-700 to-green-600 hover:shadow-2xl shadow-lg shadow-green-500/50 animate-pulse'
                    : 'bg-gradient-to-r from-green-600 to-green-500 hover:shadow-lg'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <Play className="w-5 h-5" />
                START SERVICE
              </button>

              {/* END SERVICE - Active after START SERVICE */}
              <button
                onClick={() => performQueueAction('end_service')}
                disabled={activeWorkflowStep !== 'end_service' || actionLoading}
                className={`flex items-center gap-2 px-6 py-3 text-white rounded-lg font-semibold transition-all ${
                  activeWorkflowStep === 'end_service'
                    ? 'bg-gradient-to-r from-purple-700 to-purple-600 hover:shadow-2xl shadow-lg shadow-purple-500/50 animate-pulse'
                    : 'bg-gradient-to-r from-purple-600 to-purple-500 hover:shadow-lg'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <Square className="w-5 h-5" />
                END SERVICE
              </button>

              {/* CANCEL TICKET - Available together with END SERVICE */}
              <button
                onClick={() => performQueueAction('cancel')}
                disabled={activeWorkflowStep !== 'end_service' || actionLoading}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-red-500 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X className="w-5 h-5" />
                CANCEL TICKET
              </button>
            </div>
          )}
        </div>

        {/* Service Log */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Service Log - Today</h2>
          
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs font-semibold">
                  <tr>
                    <th className="p-3 text-left">#</th>
                    <th className="p-3 text-left">Ticket #</th>
                    <th className="p-3 text-left">Customer Name</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-left">Completed At</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.served?.length === 0 && queue.cancelled?.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-gray-400">
                        No completed or cancelled services yet today
                      </td>
                    </tr>
                  ) : (
                    <>
                      {/* Served entries */}
                      {queue.served?.map((entry: QueueEntry, idx: number) => (
                        <tr key={`served-${entry.id}`} className="border-t border-gray-100 hover:bg-green-50 transition-colors">
                          <td className="p-3 text-gray-500">{idx + 1}</td>
                          <td className="p-3 font-mono font-bold text-green-600">#{entry.queueNumber}</td>
                          <td className="p-3 font-medium text-gray-800">{entry.name}</td>
                          <td className="p-3">
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                              Served
                            </span>
                          </td>
                          <td className="p-3 text-gray-600">{new Date(entry.servedAt || '').toLocaleTimeString()}</td>
                        </tr>
                      ))}
                      
                      {/* Cancelled entries */}
                      {queue.cancelled?.map((entry: QueueEntry, idx: number) => (
                        <tr key={`cancelled-${entry.id}`} className="border-t border-gray-100 hover:bg-red-50 transition-colors">
                          <td className="p-3 text-gray-500">{(queue.served?.length || 0) + idx + 1}</td>
                          <td className="p-3 font-mono font-bold text-red-600">#{entry.queueNumber}</td>
                          <td className="p-3 font-medium text-gray-800">{entry.name}</td>
                          <td className="p-3">
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                              Cancelled
                            </span>
                          </td>
                          <td className="p-3 text-gray-600">{new Date(entry.servedAt || '').toLocaleTimeString()}</td>
                        </tr>
                      ))}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Daily Service Graph */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">People Served by Hour</h2>
          
          {chartData.length > 0 && chartData.some(d => d.served > 0) ? (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="time" 
                  stroke="#6b7280"
                  style={{ fontSize: '14px' }}
                />
                <YAxis 
                  stroke="#6b7280"
                  style={{ fontSize: '14px' }}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '2px solid #10b981',
                    borderRadius: '8px',
                  }}
                  formatter={(value) => [`${value} people`, 'Served']}
                />
                <Line
                  type="monotone"
                  dataKey="served"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ fill: '#10b981', r: 5 }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center py-12 text-gray-500">
              <p>No services completed yet today</p>
            </div>
          )}
        </div>
      </div>


    </div>
  )
}
