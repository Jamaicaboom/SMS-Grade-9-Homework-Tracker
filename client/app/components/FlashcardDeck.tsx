
'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FlipHorizontal, ChevronLeft, ChevronRight, Check, X } from 'lucide-react'
import axios from 'axios' 

interface Flashcard {
  _id?: string
  question: string
  answer: string
}

interface FlashcardDeckProps {
  flashcards: Flashcard[]
  studyGuideId: string
  apiUrl: string
  userId: string
}

export default function FlashcardDeck({ flashcards, studyGuideId, apiUrl, userId }: FlashcardDeckProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [sessionStarted, setSessionStarted] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [results, setResults] = useState<boolean[]>([])

  const startSession = async () => {
    try {
      const response = await axios.post(`${apiUrl}/api/study/session`, {
        studyGuideId,
        userId
      })
      setSessionId(response.data._id)
      setSessionStarted(true)
    } catch (error) {
      console.error('Error starting study session:', error)
    }
  }

  const recordResult = async (correct: boolean) => {
    if (!sessionId || !flashcards[currentIndex]._id) return

    try {
      await axios.patch(`${apiUrl}/api/study/session/${sessionId}`, {
        flashcardId: flashcards[currentIndex]._id,
        correct
      })
      
      setResults(prev => [...prev, correct])
      
     
      if (currentIndex < flashcards.length - 1) {
        setCurrentIndex(prev => prev + 1)
        setIsFlipped(false)
      } else {
        
        await axios.patch(`${apiUrl}/api/study/session/${sessionId}/complete`)
      }
    } catch (error) {
      console.error('Error recording result:', error)
    }
  }

  const nextCard = () => {
    if (currentIndex < flashcards.length - 1) {
      setCurrentIndex(prev => prev + 1)
      setIsFlipped(false)
    }
  }

  const prevCard = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1)
      setIsFlipped(false)
    }
  }

  if (!sessionStarted) {
    return (
      <div className="text-center py-8">
        <h3 className="text-white font-medium mb-4">Ready to Study?</h3>
        <p className="text-dark-text-secondary text-sm mb-6">
          Practice with {flashcards.length} flashcards
        </p>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={startSession}
          className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium"
        >
          Start Study Session
        </motion.button>
      </div>
    )
  }

  const currentCard = flashcards[currentIndex]
  const progress = ((currentIndex + 1) / flashcards.length) * 100

  return (
    <div className="bg-dark-card border border-dark-border rounded-lg p-6">
      {/* Progress */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-dark-text-secondary mb-2">
          <span>Card {currentIndex + 1} of {flashcards.length}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-dark-border rounded-full h-2">
          <div 
            className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>

      {/* Flashcard */}
      <div className="relative h-64 mb-6 cursor-pointer" onClick={() => setIsFlipped(!isFlipped)}>
        <motion.div
          className="absolute inset-0 bg-dark-border rounded-xl p-6 flex items-center justify-center backface-hidden"
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.6 }}
          style={{ transformStyle: 'preserve-3d' }}
        >
          <div className="text-center" style={{ transform: 'rotateY(180deg)' }}>
            <p className="text-white text-lg font-medium mb-4">{currentCard.answer}</p>
            <div className="flex items-center justify-center text-dark-text-secondary text-sm">
              <FlipHorizontal className="w-4 h-4 mr-2" />
              Click to flip
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
            <div className="flex items-center justify-center text-dark-text-secondary text-sm">
              <FlipHorizontal className="w-4 h-4 mr-2" />
              Click to flip
            </div>
          </div>
        </motion.div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={prevCard}
          disabled={currentIndex === 0}
          className="p-2 bg-dark-border text-dark-text-secondary rounded-lg disabled:opacity-50"
        >
          <ChevronLeft className="w-5 h-5" />
        </motion.button>

        <div className="flex space-x-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => recordResult(false)}
            className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg flex items-center"
          >
            <X className="w-4 h-4 mr-2" />
            Incorrect
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => recordResult(true)}
            className="px-4 py-2 bg-green-500/20 text-green-400 rounded-lg flex items-center"
          >
            <Check className="w-4 h-4 mr-2" />
            Correct
          </motion.button>
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={nextCard}
          disabled={currentIndex === flashcards.length - 1}
          className="p-2 bg-dark-border text-dark-text-secondary rounded-lg disabled:opacity-50"
        >
          <ChevronRight className="w-5 h-5" />
        </motion.button>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="mt-4 text-center">
          <p className="text-dark-text-secondary text-sm">
            Score: {results.filter(r => r).length}/{results.length} correct
          </p>
        </div>
      )}
    </div>
  )
}
