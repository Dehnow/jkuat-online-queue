import { useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Building2, Banknote, Headphones } from 'lucide-react'

const ADMIN_DEFAULT_USERNAME = 'Admin0375'
const ADMIN_DEFAULT_PASSWORD = 'group2sysdev'

export default function LoginPage() {
  const navigate = useNavigate()
  const [role, setRole] = useState<'student' | 'staff'>('student')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showQueueModal, setShowQueueModal] = useState(false)

  // Clear fields when role changes (prevents browser autofill cross‑contamination)
  useEffect(() => {
    setError('')
    setUsername('')
    setPassword('')
  }, [role])

  // Student login (mock – accepts any non‑empty credentials)
  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    if (username.trim() === '' || password.trim() === '') {
      setError('Please enter both username and password')
      setLoading(false)
      return
    }
    sessionStorage.setItem('studentId', username.trim())
    sessionStorage.setItem('studentAuth', btoa(`${username}:${password}`))
    sessionStorage.setItem('userRole', 'student')
    navigate({ to: '/dashboard' })
  }

  // Staff login (Basic Auth)
  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const auth = btoa(`${username}:${password}`)
    try {
      const res = await fetch('/api/admin/report', {
        headers: { Authorization: `Basic ${auth}` }
      })
      if (res.ok) {
        sessionStorage.setItem('adminAuth', auth)
        sessionStorage.setItem('userRole', 'staff')
        navigate({ to: '/admin' })
      } else {
        setError('Invalid username or password')
      }
    } catch {
      setError('Network error – try again')
    } finally {
      setLoading(false)
    }
  }

  // Fetch live queue status with TanStack Query
  const { data: liveQueueData, isLoading: isFetching, error: queryError } = useQuery({
    queryKey: ['live-queue-status'],
    queryFn: async () => {
      const services = [
        { id: 'registrar', name: "Registrar's Office", color: '#16a34a', bgColor: '#dcfce7' },
        { id: 'finance', name: 'Finance Office', color: '#f59e0b', bgColor: '#fef3c7' },
        { id: 'ict_helpdesk', name: 'ICT Help Desk', color: '#8b5cf6', bgColor: '#ede9fe' }
      ]
      
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)
      
      try {
        const results = await Promise.all(
          services.map(async (service) => {
            try {
              const res = await fetch(`/api/queue?service=${service.id}`, {
                signal: controller.signal
              })
              if (!res.ok) throw new Error(`HTTP ${res.status}`)
              const data = await res.json()
              return {
                serviceId: service.id,
                serviceName: service.name,
                waitingCount: data.waitingCount || 0,
                servingNumber: data.serving?.queueNumber || null,
                color: service.color,
                bgColor: service.bgColor,
              }
            } catch (err) {
              console.warn(`Queue fetch failed for ${service.id}:`, err)
              return {
                serviceId: service.id,
                serviceName: service.name,
                waitingCount: 0,
                servingNumber: null,
                color: service.color,
                bgColor: service.bgColor,
              }
            }
          })
        )
        return results
      } finally {
        clearTimeout(timeout)
      }
    },
    refetchInterval: showQueueModal ? 15000 : false,
    enabled: showQueueModal,
    staleTime: 10000,
    gcTime: 5 * 60 * 1000,
  })

  return (
    <div className="min-h-screen w-full flex font-['Inter',system-ui] bg-gradient-to-br from-gray-50 to-gray-100 relative overflow-hidden">
      {/* Abstract decorative shapes */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-green-100 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-pulse"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-green-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30"></div>

      {/* LEFT PANEL – campus image */}
      <div className="hidden lg:block lg:w-[34%] relative bg-cover bg-center" style={{ backgroundImage: "url('/Jomo_Kenyatta_University_Juja_Campus_Main_Library.JPG')" }}>
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/45 to-black/30"></div>
        <div className="relative z-10 flex flex-col justify-between h-full px-6 py-8">
          <div className="flex items-center gap-3">
            <img src="/queue-bg.jpeg" alt="JKUAT Logo" className="w-[78px] h-[78px] rounded-full border-2 border-white/30 shadow-md" />
            <div>
              <div className="text-white text-[18px] font-medium tracking-wide uppercase leading-tight">JOMO KENYATTA UNIVERSITY<br />OF AGRICULTURE AND TECHNOLOGY</div>
            </div>
          </div>
          <div className="flex flex-col justify-center -mt-16 space-y-5">
            <h1 className="text-7xl font-extrabold leading-tight">
              <span className="text-green-400">JKUAT</span>
              <span className="text-white"> Online QUEUE</span>
            </h1>
            <p className="text-white text-2xl font-normal">Smart. Simple. Seamless.</p>
            <p className="text-white/90 text-xl leading-relaxed max-w-[500px]">
              Streamlining campus service delivery with digital queue management.
              No more long lines – join remotely and get served efficiently.
            </p>
            <div className="space-y-6 pt-4">
              <div className="flex items-start gap-4"><div className="w-[48px] h-[48px] bg-green-600 rounded-full shadow-md flex items-center justify-center"><svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div><div><p className="text-white text-xl font-bold">Real-time Queue Updates</p><p className="text-gray-200 text-base">See your position and wait time live</p></div></div>
              <div className="flex items-start gap-4"><div className="w-[48px] h-[48px] bg-green-600 rounded-full shadow-md flex items-center justify-center"><svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg></div><div><p className="text-white text-xl font-bold">Join Anytime, Anywhere</p><p className="text-gray-200 text-base">Use any device to join the queue</p></div></div>
              <div className="flex items-start gap-4"><div className="w-[48px] h-[48px] bg-green-600 rounded-full shadow-md flex items-center justify-center"><svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg></div><div><p className="text-white text-xl font-bold">Smart Notifications</p><p className="text-gray-200 text-base">Get notified when it’s your turn</p></div></div>
              <div className="flex items-start gap-4"><div className="w-[48px] h-[48px] bg-green-600 rounded-full shadow-md flex items-center justify-center"><svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg></div><div><p className="text-white text-xl font-bold">Efficient & Transparent</p><p className="text-gray-200 text-base">Better service, less waiting</p></div></div>
            </div>
          </div>
          <div className="backdrop-blur-md bg-white/90 rounded-2xl shadow-xl border border-white/30 w-full max-w-[740px] h-auto py-5 px-6 flex items-center justify-between">
            <div className="flex items-center gap-4 w-1/2 border-r border-gray-300 pr-5"><svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><div><p className="font-bold text-gray-800">Important Notice</p><p className="text-gray-600 text-sm">Please arrive on campus before your estimated service time.</p></div></div>
            <div className="flex items-center gap-4 w-1/2 pl-5"><svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><div><p className="font-bold text-gray-800">Service Hours</p><p className="text-gray-600 text-sm">Mon - Fri : 8:00 AM - 4:30 PM</p></div></div>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL – login card */}
      <div className="w-full lg:w-[66%] flex flex-col justify-center items-center relative bg-gradient-to-br from-gray-50 to-white p-6 md:p-10"
           style={{ backgroundImage: "url('/jkuat-bg.png')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', backgroundBlendMode: 'overlay' }}>
        <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px]"></div>
        <div className="relative z-10 w-full max-w-[520px]">
          <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl p-8 md:p-12 border border-gray-100">
            <div className="text-center">
              <img src="/queue-bg.jpeg" alt="JKUAT" className="w-20 h-20 rounded-full mx-auto border-4 border-green-100 shadow-md" />
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mt-4">Welcome Back!</h1>
              <p className="text-gray-500 text-xl mt-1">Choose your role to continue</p>
            </div>
            <div className="flex gap-3 mt-8">
              <button onClick={() => setRole('student')} className={`flex-1 h-16 rounded-xl font-semibold text-lg transition-all flex items-center justify-center gap-2 ${role === 'student' ? 'bg-green-600 text-white shadow-md' : 'bg-gray-100 border border-gray-300 text-gray-700 hover:bg-gray-200'}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>Student
              </button>
              <button onClick={() => setRole('staff')} className={`flex-1 h-16 rounded-xl font-semibold text-lg transition-all flex items-center justify-center gap-2 ${role === 'staff' ? 'bg-blue-700 text-white shadow-md' : 'bg-gray-100 border border-gray-300 text-gray-700 hover:bg-gray-200'}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>Staff/Admin
              </button>
            </div>

            {role === 'student' && (
              <form onSubmit={handleStudentLogin} autoComplete="off" className="mt-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Username / Student ID</label>
                  <input
                    type="text"
                    required
                    autoComplete="off"
                    name="student_username"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="mt-1 w-full rounded-xl border-gray-300 p-3 text-lg focus:ring-green-500 focus:border-green-500"
                    placeholder="e.g., S12345"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Password</label>
                  <input
                    type="password"
                    required
                    autoComplete="new-password"
                    name="student_password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="mt-1 w-full rounded-xl border-gray-300 p-3 text-lg focus:ring-green-500 focus:border-green-500"
                    placeholder="Enter your password"
                  />
                </div>
                {error && <div className="text-red-600 text-sm bg-red-50 p-2 rounded-lg">{error}</div>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-green-600 to-green-500 text-white font-bold py-4 rounded-xl text-lg shadow-md hover:shadow-lg transition-all disabled:opacity-50 h-[64px]"
                >
                  {loading ? 'Logging in...' : 'Login as Student →'}
                </button>
              </form>
            )}

            {role === 'staff' && (
              <form onSubmit={handleStaffLogin} autoComplete="off" className="mt-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Username</label>
                  <input
                    type="text"
                    required
                    autoComplete="off"
                    name="staff_username"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="mt-1 w-full rounded-xl border-gray-300 p-3 text-lg focus:ring-green-500 focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Password</label>
                  <input
                    type="password"
                    required
                    autoComplete="new-password"
                    name="staff_password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="mt-1 w-full rounded-xl border-gray-300 p-3 text-lg focus:ring-green-500 focus:border-green-500"
                  />
                </div>
                {error && <div className="text-red-600 text-sm bg-red-50 p-2 rounded-lg">{error}</div>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold py-4 rounded-xl text-lg transition-all disabled:opacity-50 h-[64px]"
                >
                  {loading ? 'Logging in...' : 'Login as Staff'}
                </button>
              </form>
            )}

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
              <div className="relative flex justify-center text-sm"><span className="bg-white px-3 text-gray-400">or</span></div>
            </div>
            <button onClick={() => setShowQueueModal(true)} className="w-full border-2 border-green-500 text-green-600 font-semibold py-4 rounded-xl text-lg hover:bg-green-50 transition-all flex items-center justify-center gap-2 h-[64px]">
              🔍 Check Queue Status
            </button>
            <p className="text-center text-gray-500 text-sm mt-3">Check your position in the queue without logging in.</p>
          </div>
          <div className="mt-8 flex justify-center">
            <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-lg border border-green-100/50 px-6 py-3 flex gap-8 w-full justify-around">
              <div className="text-center"><div className="text-2xl font-bold text-green-600">5K+</div><div className="text-xs text-gray-500">Students Served</div></div>
              <div className="text-center"><div className="text-2xl font-bold text-green-600">95%</div><div className="text-xs text-gray-500">Satisfaction</div></div>
              <div className="text-center"><div className="text-2xl font-bold text-green-600">24/7</div><div className="text-xs text-gray-500">Access</div></div>
              <div className="text-center"><div className="text-2xl font-bold text-green-600">Secure</div><div className="text-xs text-gray-500">Your Data</div></div>
            </div>
          </div>
        </div>
      </div>

      {/* Live Queue Modal */}
      {showQueueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-all duration-300" onClick={() => setShowQueueModal(false)}>
          <div className="relative w-[95%] max-w-[540px] lg:max-w-[800px] bg-white/90 backdrop-blur-lg rounded-3xl shadow-2xl border border-white/40 p-6 lg:p-8" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowQueueModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2"><svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg><h2 className="text-3xl font-bold text-gray-800">Live Queue Status</h2></div>
              <div className="flex items-center gap-2 bg-gradient-to-r from-green-600 to-green-500 py-2 px-4 rounded-full shadow-md"><span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span></span><span className="text-white font-semibold text-sm">Live</span></div>
            </div>
            <p className="text-gray-500 text-lg mb-6">Real-time updates from campus services • Polling every 10 seconds</p>
            {isFetching && !liveQueueData ? (
              <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div></div>
            ) : queryError ? (
              <div className="bg-red-100 border border-red-300 text-red-700 p-4 rounded-lg">
                <p>Failed to load queue status. Please try again.</p>
              </div>
            ) : !liveQueueData || liveQueueData.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No active queues at the moment.</p>
              </div>
            ) : (
              <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-2">
                {liveQueueData.map((service) => {
                  const getServiceIcon = (serviceId: string) => {
                    switch (serviceId) {
                      case 'registrar':
                        return <Building2 className="w-6 h-6" />
                      case 'finance':
                        return <Banknote className="w-6 h-6" />
                      case 'ict_helpdesk':
                        return <Headphones className="w-6 h-6" />
                      default:
                        return null
                    }
                  }
                  const waitTime = service.waitingCount * 5
                  const progress = Math.min((service.waitingCount / 20) * 100, 100)
                  
                  return (
                    <div key={service.serviceId} className="bg-white rounded-2xl shadow-md border border-gray-100 p-5 hover:shadow-lg transition-shadow">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center`} style={{ backgroundColor: service.bgColor, color: service.color }}>
                            {getServiceIcon(service.serviceId)}
                          </div>
                          <div>
                            <h3 className="text-2xl font-bold text-gray-800">{service.serviceName}</h3>
                            <p className="text-gray-500 text-sm">Open • Closes 4:30 PM</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-5xl font-bold" style={{ color: service.color }}>{service.waitingCount}</div>
                          <div className="text-gray-400 text-sm">waiting</div>
                        </div>
                      </div>
                      <div className="mt-4">
                        <div className="flex items-center gap-2 text-gray-600 mb-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          <span className="text-sm">Est. wait time: {waitTime} min</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="h-2 rounded-full" style={{ width: `${progress}%`, backgroundColor: service.color }}></div>
                        </div>
                        {service.servingNumber && (
                          <div className="mt-3 text-sm text-gray-600">
                            <span>Currently serving: <strong className="font-bold" style={{ color: service.color }}>#{service.servingNumber}</strong></span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Icon components


