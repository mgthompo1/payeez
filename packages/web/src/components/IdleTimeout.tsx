'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface IdleTimeoutProps {
  // Time in milliseconds before showing warning (default: 25 minutes)
  warningTime?: number
  // Time in milliseconds before auto-logout after warning (default: 5 minutes)
  logoutTime?: number
}

export function IdleTimeout({
  warningTime = 25 * 60 * 1000, // 25 minutes
  logoutTime = 30 * 60 * 1000,  // 30 minutes total
}: IdleTimeoutProps) {
  const [showWarning, setShowWarning] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const router = useRouter()
  const lastActivityRef = useRef(Date.now())
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const logoutTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const logout = useCallback(async () => {
    // Submit logout form
    const form = document.createElement('form')
    form.method = 'POST'
    form.action = '/auth/signout'
    document.body.appendChild(form)
    form.submit()
  }, [])

  const resetTimers = useCallback(() => {
    lastActivityRef.current = Date.now()
    setShowWarning(false)

    // Clear existing timers
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current)
    if (logoutTimeoutRef.current) clearTimeout(logoutTimeoutRef.current)
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)

    // Set warning timer
    warningTimeoutRef.current = setTimeout(() => {
      setShowWarning(true)
      const remainingMs = logoutTime - warningTime
      setCountdown(Math.ceil(remainingMs / 1000))

      // Start countdown
      countdownIntervalRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            if (countdownIntervalRef.current) {
              clearInterval(countdownIntervalRef.current)
            }
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }, warningTime)

    // Set logout timer
    logoutTimeoutRef.current = setTimeout(() => {
      logout()
    }, logoutTime)
  }, [warningTime, logoutTime, logout])

  const handleActivity = useCallback(() => {
    // Debounce activity detection
    const now = Date.now()
    if (now - lastActivityRef.current > 1000) {
      resetTimers()
    }
  }, [resetTimers])

  const handleStayLoggedIn = useCallback(() => {
    resetTimers()
  }, [resetTimers])

  useEffect(() => {
    // Initialize timers
    resetTimers()

    // Activity events to track
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click']

    // Add listeners
    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true })
    })

    return () => {
      // Cleanup
      events.forEach(event => {
        document.removeEventListener(event, handleActivity)
      })
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current)
      if (logoutTimeoutRef.current) clearTimeout(logoutTimeoutRef.current)
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
    }
  }, [handleActivity, resetTimers])

  if (!showWarning) return null

  const minutes = Math.floor(countdown / 60)
  const seconds = countdown % 60

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center">
      <div className="bg-charcoal border border-white/10 rounded-xl p-6 max-w-sm mx-4 shadow-2xl">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Session Timeout</h3>
          <p className="text-sm text-slate-400 mb-4">
            You've been inactive. For security, you'll be logged out in:
          </p>
          <div className="text-3xl font-mono font-bold text-amber-400 mb-6">
            {minutes}:{seconds.toString().padStart(2, '0')}
          </div>
          <div className="flex gap-3">
            <button
              onClick={logout}
              className="flex-1 px-4 py-2 text-sm font-medium text-slate-300 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
            >
              Log out now
            </button>
            <button
              onClick={handleStayLoggedIn}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-cyan-600 rounded-lg hover:bg-cyan-500 transition-colors"
            >
              Stay logged in
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
