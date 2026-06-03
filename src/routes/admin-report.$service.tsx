import { useNavigate, useParams } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { Building2, Banknote, Headphones, ArrowLeft, Download, Search } from 'lucide-react'

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

const SERVICE_INFO: Record<string, { name: string; icon: JSX.Element; color: string; bgColor: string }> = {
  registrar: {
    name: "Registrar's Office",
    icon: <Building2 className="w-8 h-8" />,
    color: '#16a34a',
    bgColor: '#dcfce7',
  },
  finance: {
    name: 'Finance Office',
    icon: <Banknote className="w-8 h-8" />,
    color: '#f59e0b',
    bgColor: '#fef3c7',
  },
  ict_helpdesk: {
    name: 'ICT Help Desk',
    icon: <Headphones className="w-8 h-8" />,
    color: '#8b5cf6',
    bgColor: '#ede9fe',
  },
}

export default function AdminServiceReportPage() {
  const navigate = useNavigate()
  const { service } = useParams({ from: '/admin-report/$service' })
  const [loggedIn, setLoggedIn] = useState(false)
  const [auth, setAuth] = useState('')
  const [serviceData, setServiceData] = useState<QueueEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'served' | 'cancelled' | 'waiting'>('served')

  // Auth check
  useEffect(() => {
    const storedAuth = sessionStorage.getItem('adminAuth')
    if (!storedAuth) {
      navigate({ to: '/login' })
      return
    }
    setAuth(storedAuth)
    setLoggedIn(true)
  }, [])

  // Fetch service-specific report
  useEffect(() => {
    if (!loggedIn || !auth) return

    const fetchServiceReport = async () => {
      try {
        setLoading(true)
        const res = await fetch('/api/admin/report', {
          headers: { Authorization: `Basic ${auth}` },
        })

        if (!res.ok) {
          throw new Error(`Report fetch failed: ${res.status}`)
        }

        const reportJson = await res.json()
        const allEntries = Array.isArray(reportJson)
          ? reportJson
          : Array.isArray(reportJson.entries)
          ? reportJson.entries
          : []
        
        // Filter entries for this specific service
        const serviceEntries = allEntries.filter(
          (entry: QueueEntry) => entry.serviceType === service
        )
        
        setServiceData(serviceEntries)
      } catch (err) {
        console.error('[AdminServiceReport] Error fetching report:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchServiceReport()
  }, [loggedIn, auth, service])

  if (!loggedIn) return null

  const serviceInfo = SERVICE_INFO[service as keyof typeof SERVICE_INFO]
  if (!serviceInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-800">Service not found</p>
          <button
            onClick={() => navigate({ to: '/admin' })}
            className="mt-4 flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 mx-auto"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Admin
          </button>
        </div>
      </div>
    )
  }

  // Filter and search logic
  const filteredData = serviceData.filter(entry => {
    const matchesSearch = 
      entry.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.studentId.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = filterStatus === 'all' || entry.status === filterStatus
    
    return matchesSearch && matchesStatus
  })

  const todayServed = filteredData.filter(
    e => e.status === 'served' && new Date(e.servedAt || '').toDateString() === new Date().toDateString()
  )

  const stats = {
    total: serviceData.length,
    served: serviceData.filter(e => e.status === 'served').length,
    cancelled: serviceData.filter(e => e.status === 'cancelled').length,
    todayServed: todayServed.length,
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 font-['Inter',system-ui] relative overflow-x-hidden">
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-green-100/30 rounded-full filter blur-3xl pointer-events-none"></div>
      <div className="absolute top-1/3 left-1/4 w-64 h-64 bg-green-200/20 rounded-full filter blur-3xl pointer-events-none"></div>

      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate({ to: '/admin' })}
              className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 transition"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center shadow-md"
              style={{ backgroundColor: serviceInfo.bgColor, color: serviceInfo.color }}
            >
              {serviceInfo.icon}
            </div>
            <div>
              <h1 className="text-3xl font-bold" style={{ color: serviceInfo.color }}>
                {serviceInfo.name}
              </h1>
              <p className="text-gray-500 text-base">Service Report</p>
            </div>
          </div>
          <button
            onClick={() => navigate({ to: '/admin' })}
            className="flex items-center gap-2 border border-gray-300 bg-white text-gray-700 px-4 py-2 rounded-xl hover:bg-gray-50 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Admin
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-md p-6">
            <p className="text-xs uppercase text-gray-500 mb-2">Total Records</p>
            <p className="text-4xl font-bold text-gray-800">{stats.total}</p>
          </div>
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-md p-6">
            <p className="text-xs uppercase text-gray-500 mb-2">Served</p>
            <p className="text-4xl font-bold text-green-600">{stats.served}</p>
          </div>
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-md p-6">
            <p className="text-xs uppercase text-gray-500 mb-2">Cancelled</p>
            <p className="text-4xl font-bold text-red-600">{stats.cancelled}</p>
          </div>
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-md p-6">
            <p className="text-xs uppercase text-gray-500 mb-2">Today Served</p>
            <p className="text-4xl font-bold text-blue-600">{stats.todayServed}</p>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-md p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or student ID..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="flex gap-2">
              {['all', 'served', 'cancelled', 'waiting'].map(status => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status as any)}
                  className={`px-4 py-2 rounded-xl font-medium transition capitalize ${
                    filterStatus === status
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-md overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-500">
              <svg className="w-8 h-8 animate-spin mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Loading report...
            </div>
          ) : filteredData.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <p className="text-lg font-semibold">No records found</p>
              <p className="text-sm mt-2">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="p-4 text-left text-xs uppercase tracking-wide text-gray-500">Ref No</th>
                    <th className="p-4 text-left text-xs uppercase tracking-wide text-gray-500">Queue No</th>
                    <th className="p-4 text-left text-xs uppercase tracking-wide text-gray-500">Name</th>
                    <th className="p-4 text-left text-xs uppercase tracking-wide text-gray-500">Student ID</th>
                    <th className="p-4 text-left text-xs uppercase tracking-wide text-gray-500">Status</th>
                    <th className="p-4 text-left text-xs uppercase tracking-wide text-gray-500">Served At</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((entry, idx) => (
                    <tr
                      key={entry.id}
                      className="border-t border-gray-100 hover:bg-gray-50 transition"
                    >
                      <td className="p-4 font-mono text-green-600 font-semibold">REF-{entry.id}</td>
                      <td className="p-4 font-bold">#{entry.queueNumber}</td>
                      <td className="p-4">{entry.name}</td>
                      <td className="p-4">{entry.studentId}</td>
                      <td className="p-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            entry.status === 'served'
                              ? 'bg-green-100 text-green-700'
                              : entry.status === 'cancelled'
                              ? 'bg-red-100 text-red-700'
                              : entry.status === 'serving'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {entry.status}
                        </span>
                      </td>
                      <td className="p-4">
                        {entry.servedAt ? new Date(entry.servedAt).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Detail View */}
        {filteredData.length > 0 && (
          <div className="mt-8 bg-white/90 backdrop-blur-sm rounded-3xl shadow-md p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-6">Service Details</h3>
            <div className="grid gap-4">
              {filteredData.map(entry => (
                <div key={entry.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-5 hover:shadow-md transition">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
                        Ticket Number
                      </label>
                      <p className="text-lg font-bold text-gray-800">#{entry.queueNumber}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
                        Name
                      </label>
                      <p className="text-gray-700">{entry.name}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
                        Student ID
                      </label>
                      <p className="text-gray-700">{entry.studentId}</p>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3 mt-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
                        Status
                      </label>
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                          entry.status === 'served'
                            ? 'bg-green-100 text-green-700'
                            : entry.status === 'cancelled'
                            ? 'bg-red-100 text-red-700'
                            : entry.status === 'serving'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {entry.status}
                      </span>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
                        Created
                      </label>
                      <p className="text-gray-700">{new Date(entry.createdAt).toLocaleString()}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
                        Served At
                      </label>
                      <p className="text-gray-700">{entry.servedAt ? new Date(entry.servedAt).toLocaleString() : '—'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom Bar */}
        <div className="mt-8 bg-green-50/80 backdrop-blur-sm rounded-full py-3 px-6 flex items-center justify-center gap-3 shadow-sm border border-green-100">
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span className="text-green-800 text-sm font-medium">
            Showing {filteredData.length} of {stats.total} records for {serviceInfo.name}
          </span>
        </div>
      </main>
    </div>
  )
}
