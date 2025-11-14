'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  BookOpen, 
  Target, 
  Timer, 
  Trophy, 
  RotateCcw,
  Play,
  Pause,
  CheckCircle2,
  XCircle
} from 'lucide-react'
import axios from 'axios'

interface Flashcard {
  _id?: string
  question: string
  answer: string
}

interface StudySession {
  _id: string
  studyGuideId: string
  userId: string
  flashcardsStudied: Array<{
    flashcardId: string
    correct: boolean
    timestamp: string
  }>
  score: number
  completed: boolean
  createdAt: string
}

interface StudySessionProps {
  studyGuide: {
    _id: string
    title: string
    flashcards: Flashcard[]
  }
  apiUrl: string
  userId: string
  onSessionComplete?: (session: StudySession) => void
}

type StudyMode = 'learn' | 'test' | 'review'
type CardStatus = 'unseen' | 'correct' | 'incorrect'

export default function StudySession({ 
  studyGuide, 
  apiUrl, 
  userId, 
  onSessionComplete 
}: StudySessionProps) {
  const [currentMode, setCurrentMode] = useState<StudyMode>('learn')
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [sessionStarted, setSessionStarted] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [cardStatus, setCardStatus] = useState<CardStatus[]>(
    Array(studyGuide.flashcards.length).fill('unseen')
  )
  const [sessionTime, setSessionTime] = useState(0)
  const [isTimerRunning, setIsTimerRunning] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [sessionResults, setSessionResults] = useState<StudySession | null>(null)

  const currentCard = studyGuide.flashcards[currentCardIndex]
  const progress = ((currentCardIndex + 1) / studyGuide.flashcards.length) * 100
  const correctCount = cardStatus.filter(status => status === 'correct').length
  const incorrectCount = cardStatus.filter(status => status === 'incorrect').length
  const unseenCount = cardStatus.filter(status => status === 'unseen').length

  
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    
    if (isTimerRunning) {
      interval = setInterval(() => {
        setSessionTime(prev => prev + 1)
      }, 1000)
    }
    
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isTimerRunning])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const startSession = async () => {
    try {
      const response = await axios.post(`${apiUrl}/api/study/session`, {
        studyGuideId: studyGuide._id,
        userId
      })
      setSessionId(response.data._id)
      setSessionStarted(true)
      setIsTimerRunning(true)
      setSessionTime(0)
    } catch (error) {
      console.error('Error starting study session:', error)
    }
  }

  const recordAnswer = async (correct: boolean) => {
    if (!sessionId || !currentCard._id) return

    try {
      
      const newCardStatus = [...cardStatus]
      newCardStatus[currentCardIndex] = correct ? 'correct' : 'incorrect'
      setCardStatus(newCardStatus)

      
      await axios.patch(`${apiUrl}/api/study/session/${sessionId}`, {
        flashcardId: currentCard._id,
        correct
      })

      
      if (currentCardIndex < studyGuide.flashcards.length - 1) {
        setCurrentCardIndex(prev => prev + 1)
        setIsFlipped(false)
      } else {
        completeSession()
      }
    } catch (error) {
      console.error('Error recording answer:', error)
    }
  }

  const completeSession = async () => {
    if (!sessionId) return

    try {
      setIsTimerRunning(false)
      const response = await axios.patch(`${apiUrl}/api/study/session/${sessionId}/complete`)
      setSessionResults(response.data)
      setShowResults(true)
      onSessionComplete?.(response.data)
    } catch (error) {
      console.error('Error completing session:', error)
    }
  }

  const resetSession = () => {
    setCurrentCardIndex(0)
    setIsFlipped(false)
    setCardStatus(Array(studyGuide.flashcards.length).fill('unseen'))
    setSessionTime(0)
    setShowResults(false)
    setSessionResults(null)
    setSessionStarted(false)
    setSessionId(null)
  }

  const navigateCard = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && currentCardIndex > 0) {
      setCurrentCardIndex(prev => prev - 1)
      setIsFlipped(false)
    } else if (direction === 'next' && currentCardIndex < studyGuide.flashcards.length - 1) {
      setCurrentCardIndex(prev => prev + 1)
      setIsFlipped(false)
    }
  }

  const toggleTimer = () => {
    setIsTimerRunning(prev => !prev)
  }

  if (!sessionStarted) {
    return (
      <div className="bg-dark-card border border-dark-border rounded-lg p-6">
        <div className="text-center">
          <BookOpen className="w-16 h-16 text-purple-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">Study Session</h3>
          <p className="text-dark-text-secondary mb-6">
            Practice with {studyGuide.flashcards.length} flashcards from "{studyGuide.title}"
          </p>

          {/* Study Mode Selection */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {[
              { mode: 'learn', icon: BookOpen, title: 'Learn Mode', desc: 'Study at your own pace' },
              { mode: 'test', icon: Target, title: 'Test Mode', desc: 'Test your knowledge' },
              { mode: 'review', icon: Trophy, title: 'Review Mode', desc: 'Focus on weak areas' }
            ].map(({ mode, icon: Icon, title, desc }) => (
              <motion.button
                key={mode}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setCurrentMode(mode as StudyMode)}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  currentMode === mode
                    ? 'border-purple-500 bg-purple-500/20'
                    : 'border-dark-border bg-dark-bg hover:border-purple-400/50'
                }`}
              >
                <Icon className="w-8 h-8 text-purple-400 mb-2" />
                <h4 className="text-white font-medium mb-1">{title}</h4>
                <p className="text-dark-text-secondary text-sm">{desc}</p>
              </motion.button>
            ))}
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={startSession}
            className="px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium"
          >
            Start Studying
          </motion.button>
        </div>
      </div>
    )
  }

  if (showResults && sessionResults) {
    const accuracy = studyGuide.flashcards.length > 0 
      ? Math.round((sessionResults.score / studyGuide.flashcards.length) * 100) 
      : 0

    return (
      <div className="bg-dark-card border border-dark-border rounded-lg p-6">
        <div className="text-center">
          <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
          <h3 className="text-2xl font-semibold text-white mb-2">Session Complete! 🎉</h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-dark-border rounded-lg p-4">
              <div className="text-2xl font-bold text-white">{accuracy}%</div>
              <div className="text-dark-text-secondary text-sm">Accuracy</div>
            </div>
            <div className="bg-dark-border rounded-lg p-4">
              <div className="text-2xl font-bold text-green-400">{correctCount}</div>
              <div className="text-dark-text-secondary text-sm">Correct</div>
            </div>
            <div className="bg-dark-border rounded-lg p-4">
              <div className="text-2xl font-bold text-red-400">{incorrectCount}</div>
              <div className="text-dark-text-secondary text-sm">Incorrect</div>
            </div>
            <div className="bg-dark-border rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-400">{formatTime(sessionTime)}</div>
              <div className="text-dark-text-secondary text-sm">Time</div>
            </div>
          </div>

          <div className="flex space-x-4 justify-center">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={resetSession}
              className="px-6 py-2 bg-purple-500 text-white rounded-lg font-medium"
            >
              <RotateCcw className="w-4 h-4 mr-2 inline" />
              Study Again
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowResults(false)}
              className="px-6 py-2 bg-dark-border text-white rounded-lg font-medium"
            >
              Review Cards
            </motion.button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-dark-card border border-dark-border rounded-lg p-6">
      {/* Session Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-white font-semibold">{studyGuide.title}</h3>
          <p className="text-dark-text-secondary text-sm">
            {currentMode === 'learn' ? 'Learn Mode' : 
             currentMode === 'test' ? 'Test Mode' : 'Review Mode'}
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center text-dark-text-secondary">
            <Timer className="w-4 h-4 mr-2" />
            <span>{formatTime(sessionTime)}</span>
            <button
              onClick={toggleTimer}
              className="ml-2 p-1 hover:bg-dark-border rounded"
            >
              {isTimerRunning ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
            </button>
          </div>
          
          <div className="text-sm text-dark-text-secondary">
            {currentCardIndex + 1} / {studyGuide.flashcards.length}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="w-full bg-dark-border rounded-full h-2">
          <div 
            className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>

      {/* Flashcard */}
      <div 
        className="relative h-64 mb-6 cursor-pointer"
        onClick={() => setIsFlipped(!isFlipped)}
      >
        <motion.div
          className="absolute inset-0 bg-dark-border rounded-xl p-6 flex items-center justify-center backface-hidden"
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.6 }}
          style={{ transformStyle: 'preserve-3d' }}
        >
          <div className="text-center" style={{ transform: 'rotateY(180deg)' }}>
            <p className="text-white text-lg font-medium mb-4">{currentCard.answer}</p>
            <div className="text-dark-text-secondary text-sm">
              Click to flip back
            </div>
          </div>
        </motion.div>
        
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-xl p-6 flex items-center justify-center backface-hidden"
          animate={{ rotateY: isFlipped ? 0 : -180 }}
          transition={{ duration: 0.6 }}
          style={{ transformStyle: 'preserve-3d' }}
        >
          <div className="text-center">
            <p className="text-white text-lg font-medium mb-4">{currentCard.question}</p>
            <div className="text-dark-text-secondary text-sm">
              Click to reveal answer
            </div>
          </div>
        </motion.div>

        {/* Card Status Indicator */}
        <div className="absolute top-4 right-4">
          {cardStatus[currentCardIndex] === 'correct' && (
            <CheckCircle2 className="w-6 h-6 text-green-400" />
          )}
          {cardStatus[currentCardIndex] === 'incorrect' && (
            <XCircle className="w-6 h-6 text-red-400" />
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex space-x-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigateCard('prev')}
            disabled={currentCardIndex === 0}
            className="p-2 bg-dark-border text-dark-text-secondary rounded-lg disabled:opacity-50"
          >
            ← Previous
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigateCard('next')}
            disabled={currentCardIndex === studyGuide.flashcards.length - 1}
            className="p-2 bg-dark-border text-dark-text-secondary rounded-lg disabled:opacity-50"
          >
            Next →
          </motion.button>
        </div>

        {currentMode === 'test' && isFlipped && (
          <div className="flex space-x-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => recordAnswer(false)}
              className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg flex items-center"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Incorrect
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => recordAnswer(true)}
              className="px-4 py-2 bg-green-500/20 text-green-400 rounded-lg flex items-center"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Correct
            </motion.button>
          </div>
        )}

        {currentMode !== 'test' && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => recordAnswer(true)}
            className="px-4 py-2 bg-purple-500 text-white rounded-lg"
          >
            {currentCardIndex === studyGuide.flashcards.length - 1 ? 'Finish' : 'Next Card'}
          </motion.button>
        )}
      </div>

      {/* Progress Summary */}
      <div className="mt-6 pt-4 border-t border-dark-border">
        <div className="flex justify-between text-sm">
          <span className="text-green-400">✓ {correctCount} correct</span>
          <span className="text-red-400">✗ {incorrectCount} incorrect</span>
          <span className="text-dark-text-secondary">{unseenCount} remaining</span>
        </div>
      </div>
    </div>
  )
}
