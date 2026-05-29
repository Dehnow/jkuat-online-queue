import { useState, useEffect } from 'react'
import { X, Send, Check } from 'lucide-react'

type Message = {
  id: number
  officeId: number
  staffUsername: string
  messageType: 'feedback' | 'admin_request' | 'admin_response'
  message: string
  response?: string
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
  respondedAt?: string
}

interface FeedbackSystemProps {
  adminAuth: string
  offices: any[]
}

export default function FeedbackSystem({ adminAuth, offices }: FeedbackSystemProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null)
  const [responseText, setResponseText] = useState('')
  const [responseStatus, setResponseStatus] = useState<'pending' | 'approved' | 'rejected'>('pending')
  const [sendingResponse, setSendingResponse] = useState(false)
  const [error, setError] = useState('')

  // Fetch messages
  useEffect(() => {
    const fetchMessages = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/admin/feedback', {
          headers: { 'Authorization': `Basic ${adminAuth}` },
        })
        if (res.ok) {
          const data = await res.json()
          setMessages(data.messages || [])
        } else {
          setError('Failed to fetch messages')
        }
      } catch (err) {
        setError('Network error')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchMessages()
    const interval = setInterval(fetchMessages, 10000)
    return () => clearInterval(interval)
  }, [adminAuth])

  const handleSendResponse = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedMessage || !responseText.trim()) return

    setSendingResponse(true)
    try {
      const res = await fetch('/api/admin/feedback', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${adminAuth}`,
        },
        body: JSON.stringify({
          messageId: selectedMessage.id,
          response: responseText,
          status: responseStatus,
        }),
      })

      if (res.ok) {
        setResponseText('')
        setSelectedMessage(null)
        // Refresh messages
        const fetchRes = await fetch('/api/admin/feedback', {
          headers: { 'Authorization': `Basic ${adminAuth}` },
        })
        if (fetchRes.ok) {
          const data = await fetchRes.json()
          setMessages(data.messages || [])
        }
      } else {
        setError('Failed to send response')
      }
    } catch (err) {
      setError('Network error')
      console.error(err)
    } finally {
      setSendingResponse(false)
    }
  }

  const getOfficeName = (officeId: number) => {
    return offices.find(o => o.id === officeId)?.name || `Office #${officeId}`
  }

  const pendingMessages = messages.filter(m => m.status === 'pending')
  const respondedMessages = messages.filter(m => m.status !== 'pending')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Feedback & Messaging</h2>
        <p className="text-gray-600">Manage messages and feedback from staff across all offices</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
          <p className="text-gray-600 text-sm">Pending Messages</p>
          <p className="text-3xl font-bold text-orange-600">{pendingMessages.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
          <p className="text-gray-600 text-sm">Responded</p>
          <p className="text-3xl font-bold text-green-600">{respondedMessages.filter(m => m.status === 'approved').length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
          <p className="text-gray-600 text-sm">Rejected</p>
          <p className="text-3xl font-bold text-red-600">{respondedMessages.filter(m => m.status === 'rejected').length}</p>
        </div>
      </div>

      {/* Pending Messages */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : pendingMessages.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-500">No pending messages</p>
        </div>
      ) : (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800">Pending Messages ({pendingMessages.length})</h3>
          {pendingMessages.map((message) => (
            <div
              key={message.id}
              className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500 hover:shadow-lg transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-gray-800">{getOfficeName(message.officeId)}</h4>
                    <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-semibold rounded">
                      {message.messageType.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">From: {message.staffUsername}</p>
                </div>
                <p className="text-xs text-gray-500">{new Date(message.createdAt).toLocaleString()}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <p className="text-gray-700">{message.message}</p>
              </div>
              <button
                onClick={() => {
                  setSelectedMessage(message)
                  setResponseText('')
                  setResponseStatus('approved')
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all"
              >
                Respond
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Responded Messages */}
      {respondedMessages.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800">Responded Messages ({respondedMessages.length})</h3>
          <div className="space-y-4">
            {respondedMessages.map((message) => (
              <div
                key={message.id}
                className={`bg-white rounded-lg shadow p-6 border-l-4 ${
                  message.status === 'approved' ? 'border-green-500' : 'border-red-500'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-800">{getOfficeName(message.officeId)}</h4>
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded ${
                          message.status === 'approved'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {message.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">From: {message.staffUsername}</p>
                  </div>
                  <p className="text-xs text-gray-500">{new Date(message.createdAt).toLocaleString()}</p>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-gray-600 mb-1">Original Message:</p>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-sm text-gray-700">{message.message}</p>
                    </div>
                  </div>
                  {message.response && (
                    <div>
                      <p className="text-xs font-semibold text-gray-600 mb-1">Response:</p>
                      <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                        <p className="text-sm text-gray-700">{message.response}</p>
                        <p className="text-xs text-gray-500 mt-2">
                          Responded: {new Date(message.respondedAt!).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Response Modal */}
      {selectedMessage && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-800">Respond to Message</h3>
              <button
                onClick={() => setSelectedMessage(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-1">From Office:</p>
                <p className="text-lg font-semibold text-gray-800">{getOfficeName(selectedMessage.officeId)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-1">Staff:</p>
                <p className="text-gray-700">{selectedMessage.staffUsername}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-1">Original Message:</p>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-gray-700">{selectedMessage.message}</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSendResponse} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Your Response</label>
                <textarea
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  placeholder="Type your response..."
                  required
                  className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Decision</label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setResponseStatus('approved')}
                    className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-all ${
                      responseStatus === 'approved'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    <Check className="w-4 h-4 inline mr-2" />
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => setResponseStatus('rejected')}
                    className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-all ${
                      responseStatus === 'rejected'
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    <X className="w-4 h-4 inline mr-2" />
                    Reject
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-300 text-red-700 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setSelectedMessage(null)}
                  className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingResponse || !responseText.trim()}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  {sendingResponse ? 'Sending...' : 'Send Response'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
