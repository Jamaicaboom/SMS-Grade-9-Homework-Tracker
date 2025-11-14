'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'

export default function StudySessionsPage() {
  const router = useRouter()
  const [timeLeft, setTimeLeft] = useState(25 * 60) 
  const [isActive, setIsActive] = useState(false)

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(time => time - 1)
      }, 1000)
    } else if (timeLeft === 0) {
      setIsActive(false)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isActive, timeLeft])

  const startTimer = () => setIsActive(true)
  const pauseTimer = () => setIsActive(false)
  const resetTimer = () => {
    setIsActive(false)
    setTimeLeft(25 * 60)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen bg-dark-bg">
      {/* Header */}
      <header className="bg-dark-card border-b border-dark-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.back()}
                className="text-dark-text-secondary hover:text-white transition-colors duration-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <h1 className="text-2xl font-semibold text-white">Study Sessions</h1>
            </div>
            <div className="text-dark-text-secondary text-sm">
              SMS Grade 9
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-md mx-auto"
        >
          {/* Pomodoro Timer */}
          <div className="bg-dark-card rounded-lg p-8 border border-dark-border mb-8">
            <h2 className="text-2xl font-semibold text-white text-center mb-6">Pomodoro Timer</h2>
            
            <div className="text-center mb-6">
              <div className="text-6xl font-mono text-white mb-4">
                {formatTime(timeLeft)}
              </div>
              <p className="text-dark-text-secondary">
                {isActive ? 'Time to focus! 📚' : 'Ready to study?'}
              </p>
            </div>

            <div className="flex justify-center space-x-4">
              {!isActive ? (
                <button
                  onClick={startTimer}
                  className="bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 transition-colors duration-200 font-semibold"
                >
                  Start Session
                </button>
              ) : (
                <button
                  onClick={pauseTimer}
                  className="bg-yellow-500 text-white px-6 py-3 rounded-lg hover:bg-yellow-600 transition-colors duration-200 font-semibold"
                >
                  Pause
                </button>
              )}
              <button
                onClick={resetTimer}
                className="bg-red-500 text-white px-6 py-3 rounded-lg hover:bg-red-600 transition-colors duration-200 font-semibold"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Study Tips */}
          <div className="bg-dark-card rounded-lg p-6 border border-dark-border">
            <h3 className="text-white font-semibold mb-4">Study Session Tips</h3>
            <ul className="text-dark-text-secondary space-y-3">
              <li className="flex items-start">
                <span className="text-green-400 mr-2">•</span>
                <span>Study for 25 minutes, then take a 5-minute break</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">•</span>
                <span>After 4 sessions, take a longer 15-30 minute break</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">•</span>
                <span>Eliminate distractions during study sessions</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">•</span>
                <span>Stay hydrated and take care of yourself!</span>
              </li>
            </ul>
          </div>
        </motion.div>
      </main>
    </div>
  )
}
