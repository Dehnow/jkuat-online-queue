'use client'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect, useRef } from 'react'

export const Route = createFileRoute('/track/$id')({
  component: TrackPage,
})

const SERVICE_LABELS: Record<string, string> = {
  registrar: "Registrar's Office",
  finance: 'Finance Office',
  ict_helpdesk: 'ICT Helpdesk',
}

const SERVICE_ICONS: Record<string, string> = {
  registrar: '🎓',
  finance: '💳',
  ict_helpdesk: '🖥️',
}

type QueueEntry = {
  id: number
  name: string
  studentId: string
  serviceType: string
  queueNumber: number
  status: 'waiting' | 'serving' | 'served' | 'cancelled'
  createdAt: string
  waitingAhead: number
  currentlyServing: number | null
}

function TrackPage() {
  const { id } = Route.useParams()
  const [entry, setEntry] = useState<QueueEntry | null>(null)
  const [error, setError] = useState('')
  const [notified, setNotified] = useState(false)
  const prevStatus = useRef<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    async function fetch_status() {
      try {
        const res = await fetch(`/api/queue/${id}`)
        if (!res.ok) { setError('Queue entry not found'); return }
        const data: QueueEntry = await res.json()

        // Trigger notification when status changes to 'serving'
        if (prevStatus.current !== 'serving' && data.status === 'serving') {
          setNotified(true)
          // Browser notification
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('🎉 Your Turn!', {
              body: `Queue #${data.queueNumber} — Please proceed to ${SERVICE_LABELS[data.serviceType]}`,
              icon: '/queue-bg.jpeg',
            })
          }
          // Play a sound cue via oscillator
          try {
            const ctx = new AudioContext()
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.connect(gain); gain.connect(ctx.destination)
            osc.frequency.value = 880
            gain.gain.setValueAtTime(0.3, ctx.currentTime)
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1)
            osc.start(); osc.stop(ctx.currentTime + 1)
          } catch {}
        }
        prevStatus.current = data.status
        setEntry(data)
      } catch {
        setError('Unable to fetch queue status')
      }
    }

    fetch_status()
    const t = setInterval(fetch_status, 5000)
    return () => clearInterval(t)
  }, [id])

  useEffect(() => {
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  if (error) return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="glass rounded-2xl p-8 text-center shadow-xl max-w-sm w-full">
        <div className="text-4xl mb-3">⚠️</div>
        <p className="text-red-600 font-semibold">{error}</p>
        <Link to="/" className="mt-4 inline-block text-sm font-bold px-5 py-2 rounded-lg text-white" style={{ background: 'var(--navy)' }}>← Home</Link>
      </div>
    </div>
  )

  if (!entry) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="glass rounded-2xl p-8 text-center shadow-xl">
        <div className="w-10 h-10 border-4 rounded-full animate-spin mx-auto mb-3" style={{ borderColor: 'var(--green-dark)', borderTopColor: 'transparent' }} />
        <p className="text-sm font-medium" style={{ color: 'var(--navy)' }}>Loading your queue status...</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="glass-dark shadow-lg sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <img src="/queue-bg.jpeg" alt="JKUAT" className="w-10 h-10 rounded-full object-cover border-2 border-yellow-400" />
          <div>
            <div className="text-white font-bold text-sm">JKUAT Queue Tracker</div>
            <div className="text-yellow-300 text-xs">Real-time Queue Status</div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-10">
        {/* Notification Alert */}
        {notified && entry.status === 'serving' && (
          <div className="w-full max-w-md mb-5 animate-bounce-in">
            <div className="rounded-2xl px-6 py-4 text-white text-center shadow-2xl animate-glow"
              style={{ background: 'linear-gradient(135deg,#c8a000,#e6b800)' }}>
              <div className="text-3xl mb-1">🔔</div>
              <div className="font-bold text-lg">It's Your Turn!</div>
              <div className="text-sm mt-1 text-yellow-100">
                Please proceed to <strong>{SERVICE_LABELS[entry.serviceType]}</strong> now
              </div>
            </div>
          </div>
        )}

        {/* Queue Card */}
        <div className="glass rounded-2xl shadow-2xl w-full max-w-md p-7 animate-slide-in">
          {/* Service Header */}
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-green-100">
            <span className="text-3xl">{SERVICE_ICONS[entry.serviceType]}</span>
            <div>
              <div className="font-bold text-sm" style={{ color: 'var(--navy)' }}>{SERVICE_LABELS[entry.serviceType]}</div>
              <div className="text-xs text-gray-400">Queue Ticket</div>
            </div>
            <div className="ml-auto">
              <StatusBadge status={entry.status} />
            </div>
          </div>

          {/* Queue Number */}
          <div className="text-center my-6">
            <div className="text-xs font-bold uppercase tracking-widest mb-1 text-gray-400">Your Queue Number</div>
            <div className="text-7xl font-black leading-none" style={{ color: getStatusColor(entry.status) }}>
              #{entry.queueNumber}
            </div>
            <div className="text-sm mt-2 text-gray-500">{entry.name} · {entry.studentId}</div>
          </div>

          {/* Status Info */}
          <div className="space-y-3">
            {entry.status === 'waiting' && (
              <>
                <InfoRow icon="⏳" label="Position in Queue" value={`${entry.waitingAhead + 1} of ${entry.waitingAhead + 1}`} />
                <InfoRow icon="👥" label="People Ahead" value={String(entry.waitingAhead)} />
                {entry.currentlyServing && (
                  <InfoRow icon="▶️" label="Currently Serving" value={`#${entry.currentlyServing}`} />
                )}
                <div className="rounded-xl px-4 py-3 mt-2 text-xs text-center font-medium" style={{ background: 'rgba(26,48,96,0.07)', color: 'var(--navy)' }}>
                  Please wait — you will be notified when your turn arrives
                </div>
              </>
            )}
            {entry.status === 'serving' && (
              <div className="rounded-xl px-4 py-4 text-center font-bold text-white animate-glow"
                style={{ background: 'linear-gradient(135deg,var(--green-dark),var(--green-mid))' }}>
                🎉 You're being served now! Please proceed to the counter.
              </div>
            )}
            {entry.status === 'served' && (
              <div className="rounded-xl px-4 py-4 text-center font-semibold text-white"
                style={{ background: 'linear-gradient(135deg,var(--navy),#2a4080)' }}>
                ✅ Service complete. Thank you for using JKUAT Queue System!
              </div>
            )}
            {entry.status === 'cancelled' && (
              <div className="rounded-xl px-4 py-3 text-center font-semibold text-red-700 bg-red-50 border border-red-200">
                ❌ Your queue entry was cancelled.
              </div>
            )}
          </div>

          {/* Refresh indicator */}
          <div className="flex items-center justify-center gap-1.5 mt-5 text-xs text-gray-400">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block" />
            Auto-refreshing every 5 seconds
          </div>
        </div>

        <Link to="/" className="mt-5 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-white/10 transition-colors">
          ← Back to Home
        </Link>
      </div>

      <footer className="glass-dark py-3 text-center text-xs text-gray-300">
        © 2025 JKUAT Digital Queue Management System
      </footer>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    waiting: { label: 'Waiting', cls: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
    serving: { label: 'Being Served', cls: 'bg-green-100 text-green-700 border-green-300' },
    served: { label: 'Served', cls: 'bg-blue-100 text-blue-700 border-blue-300' },
    cancelled: { label: 'Cancelled', cls: 'bg-red-100 text-red-700 border-red-300' },
  }
  const s = map[status] || map.waiting
  return <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${s.cls}`}>{s.label}</span>
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl px-4 py-2.5" style={{ background: 'rgba(26,92,42,0.05)' }}>
      <span className="text-xs text-gray-500 flex items-center gap-1.5"><span>{icon}</span>{label}</span>
      <span className="text-sm font-bold" style={{ color: 'var(--green-dark)' }}>{value}</span>
    </div>
  )
}

function getStatusColor(status: string) {
  const map: Record<string, string> = {
    waiting: '#c8a000',
    serving: '#1a5c2a',
    served: '#1a3060',
    cancelled: '#dc2626',
  }
  return map[status] || '#1a5c2a'
}
