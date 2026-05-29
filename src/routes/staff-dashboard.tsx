import { useNavigate } from '@tanstack/react-router'
import { useEffect, useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Phone, Play, Square, X, MessageSquare, Power, LogOut, Settings } from 'lucide-react'

type QueueEntry = {
  id: number
  name: string
  studentId: string
  queueNumber: number
  status: 'waiting' | 'serving' | 'served' | 'cancelled'
  createdAt: string
  servedAt?: string
}

export default function StaffDashboard() {
  const navigate = useNavigate()
  const [officeId, setOfficeId] = useState<number | null>(null)
  const [officeName, setOfficeName] = useState<string>('')
  const [officeStatus, setOfficeStatus] = useState<'open' | 'closed'>('open')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showQueueWidget, setShowQueueWidget] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [currentDateTime, setCurrentDateTime] = useState(new Date())

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
        refetch()
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

  // Send feedback
  const handleSendFeedback = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!feedbackMessage.trim()) return

    setActionLoading(true)
    try {
      const res = await fetch('/api/admin/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          officeId,
          staffUsername: sessionStorage.getItem('staffUsername') || 'staff',
          messageType: 'feedback',
          message: feedbackMessage,
        }),
      })

      if (res.ok) {
        setFeedbackMessage('')
        setShowFeedback(false)
        alert('Feedback sent successfully')
      } else {
        setError('Failed to send feedback')
      }
    } catch (err) {
      setError('Network error')
      console.error(err)
    } finally {
      setActionLoading(false)
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 relative overflow-hidden">
      {/* Decorative shapes */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>

      {/* Header */}
      <div className="relative z-10 bg-white shadow-md border-b-4 border-blue-600">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src="/queue-bg.jpeg" alt="JKUAT" className="w-12 h-12 rounded-full" />
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Staff Dashboard</h1>
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
              onClick={() => setShowFeedback(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-100 text-orange-700 hover:bg-orange-200 font-semibold transition-all"
            >
              <MessageSquare className="w-5 h-5" />
              Feedback
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
      </div>

      {/* Main Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-300 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-blue-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total Waiting</p>
                <p className="text-4xl font-bold text-blue-600">{totalWaiting}</p>
              </div>
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">👥</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-green-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Now Serving</p>
                <p className="text-4xl font-bold text-green-600">{queue.serving?.queueNumber || '-'}</p>
                <p className="text-xs text-gray-500 mt-1">{queue.serving?.name || 'No one'}</p>
              </div>
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">📞</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-purple-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Served Today</p>
                <p className="text-4xl font-bold text-purple-600">{queue.served?.length || 0}</p>
              </div>
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">✓</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-red-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Cancelled</p>
                <p className="text-4xl font-bold text-red-600">{queue.cancelled?.length || 0}</p>
              </div>
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">✗</span>
              </div>
            </div>
          </div>
        </div>

        {/* Queue Widget */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Today's Queue</h2>
            <button
              onClick={() => setShowQueueWidget(!showQueueWidget)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all"
            >
              {showQueueWidget ? 'Hide Widget' : 'Show Full View'}
            </button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              {/* Mini Queue Visualization */}
              <div className="mb-8 p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl">
                <p className="text-sm font-medium text-gray-600 mb-4">Queue Overview (Compact View)</p>
                <div className="flex items-center gap-2 overflow-x-auto pb-2">
                  {queue.waiting && queue.waiting.length > 0 ? (
                    <>
                      {queue.serving && (
                        <div className="flex-shrink-0 w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center text-white font-bold shadow-lg border-2 border-green-600" title={`Now Serving: ${queue.serving.name}`}>
                          S
                        </div>
                      )}
                      {queue.waiting.slice(0, 10).map((entry, idx) => (
                        <div
                          key={entry.id}
                          className="flex-shrink-0 w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-md"
                          title={`${entry.name} - Ticket #${entry.queueNumber}`}
                        >
                          {idx + 1}
                        </div>
                      ))}
                      {queue.waiting.length > 10 && (
                        <div className="flex-shrink-0 px-4 py-2 bg-blue-200 rounded-lg text-blue-700 font-semibold text-sm">
                          +{queue.waiting.length - 10} more
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="w-full text-center py-6 text-gray-500">No one waiting</div>
                  )}
                </div>
              </div>

              {/* Queue Controls */}
              <div className="space-y-4 mb-8">
                <div className="flex gap-3 flex-wrap">
                  <button
                    onClick={() => performQueueAction('call_next')}
                    disabled={totalWaiting === 0 || actionLoading}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Phone className="w-5 h-5" />
                    CALL NEXT
                  </button>
                  <button
                    onClick={() => performQueueAction('start_service')}
                    disabled={!isServing || actionLoading}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-green-500 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Play className="w-5 h-5" />
                    START SERVICE
                  </button>
                  <button
                    onClick={() => performQueueAction('end_service')}
                    disabled={!isServing || actionLoading}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-500 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Square className="w-5 h-5" />
                    END SERVICE
                  </button>
                  <button
                    onClick={() => performQueueAction('cancel')}
                    disabled={!isServing || actionLoading}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-red-500 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <X className="w-5 h-5" />
                    CANCEL TICKET
                  </button>
                </div>
              </div>

              {/* Full Queue List */}
              {showQueueWidget && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowQueueWidget(false)}>
                  <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-8" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-2xl font-bold text-gray-800">Full Queue Details</h3>
                      <button onClick={() => setShowQueueWidget(false)} className="text-gray-400 hover:text-gray-600">
                        <X className="w-6 h-6" />
                      </button>
                    </div>

                    {/* Waiting List */}
                    <div className="mb-8">
                      <h4 className="text-lg font-semibold text-gray-800 mb-4">Waiting ({queue.waiting?.length || 0})</h4>
                      <div className="space-y-2">
                        {queue.waiting && queue.waiting.length > 0 ? (
                          queue.waiting.map((entry) => (
                            <div key={entry.id} className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
                              <div>
                                <p className="font-semibold text-gray-800">#{entry.queueNumber}</p>
                                <p className="text-sm text-gray-600">{entry.name} ({entry.studentId})</p>
                              </div>
                              <div className="text-sm text-gray-500">{new Date(entry.createdAt).toLocaleTimeString()}</div>
                            </div>
                          ))
                        ) : (
                          <p className="text-gray-500">No one waiting</p>
                        )}
                      </div>
                    </div>

                    {/* Served List */}
                    <div>
                      <h4 className="text-lg font-semibold text-gray-800 mb-4">Served ({queue.served?.length || 0})</h4>
                      <div className="space-y-2">
                        {queue.served && queue.served.length > 0 ? (
                          queue.served.map((entry) => (
                            <div key={entry.id} className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg opacity-75">
                              <div>
                                <p className="font-semibold text-gray-800 line-through">#{entry.queueNumber}</p>
                                <p className="text-sm text-gray-600">{entry.name}</p>
                              </div>
                              <div className="text-xs text-green-600 font-semibold">✓ SERVED</div>
                            </div>
                          ))
                        ) : (
                          <p className="text-gray-500">No one served yet</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Feedback Modal */}
      {showFeedback && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowFeedback(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-800">Send Feedback</h3>
              <button onClick={() => setShowFeedback(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSendFeedback} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
                <textarea
                  value={feedbackMessage}
                  onChange={(e) => setFeedbackMessage(e.target.value)}
                  placeholder="Describe your feedback or request..."
                  className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowFeedback(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !feedbackMessage.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all disabled:opacity-50"
                >
                  {actionLoading ? 'Sending...' : 'Send'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
