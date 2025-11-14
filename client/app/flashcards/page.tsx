'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useRouter, useSearchParams } from 'next/navigation'
import axios from 'axios'

export default function FlashcardsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isFlipped, setIsFlipped] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [inputText, setInputText] = useState('')
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [flashcards, setFlashcards] = useState<Array<{ id: number; front: string; back: string }>>([])
  const [numQuestions, setNumQuestions] = useState(10)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const content = searchParams.get('content')
    if (content) {
      setInputText(decodeURIComponent(content))
    }
  }, [searchParams])

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files) {
      setUploadedFiles(Array.from(files))
    }
  }

  const triggerFileInput = () => {
    fileInputRef.current?.click()
  }

  const handleGenerateFlashcards = async () => {
    if (!inputText.trim() && uploadedFiles.length === 0) {
      alert('Please enter text or upload files to generate flashcards')
      return
    }

    setIsGenerating(true)
    
    try {
      let contentToUse = inputText

      // If files are uploaded, extract text from them
      if (uploadedFiles.length > 0) {
        const formData = new FormData()
        uploadedFiles.forEach(file => {
          formData.append('files', file)
        })

        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://sms-grade-9-homework-server.onrender.com'
        const response = await axios.post(`${API_URL}/api/extract-text`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          timeout: 60000
        })

        if (response.data.success) {
          const extractedText = response.data.text
          // Combine with existing text if any
          contentToUse = inputText.trim() 
            ? `${inputText}\n\n${extractedText}` 
            : extractedText

          // Show warnings if any
          if (response.data.errors && response.data.errors.length > 0) {
            alert(`Some files couldn't be processed:\n${response.data.errors.join('\n')}`)
          }
        } else {
          throw new Error('Failed to extract text from files')
        }
      }

      const generatedFlashcards = generateFlashcardsFromContent(contentToUse, numQuestions)
      setFlashcards(generatedFlashcards)
    } catch (error) {
      console.error('Error generating flashcards:', error)
      if (axios.isAxiosError(error)) {
        alert(`Failed to process files: ${error.response?.data?.error || error.message}`)
      } else {
        alert('Failed to generate flashcards. Please try again.')
      }
    } finally {
      setIsGenerating(false)
    }
  }

  const generateFlashcardsFromContent = (content: string, count: number) => {
    const flashcards = []
    const lines = content.split('\n')
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0)
    
    const termDefinitionPairs = []
    const importantConcepts = []
    const questions = []
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      
      if (line.includes(':') && line.length < 150) {
        const parts = line.split(':')
        if (parts.length === 2) {
          const term = parts[0].trim()
          const definition = parts[1].trim()
          if (term && definition && term.split(' ').length < 8) {
            termDefinitionPairs.push({ term, definition })
          }
        }
      }
      
      if ((line.includes(' is ') || line.includes(' are ') || line.includes(' refers to ') || line.includes(' means ')) && line.length < 200) {
        importantConcepts.push(line)
      }
      
      if (line.includes('?') && !line.startsWith('?')) {
        questions.push(line)
      }
    }
    
    for (const sentence of sentences) {
      const trimmed = sentence.trim()
      if (trimmed.length > 20 && trimmed.length < 150) {
        const words = trimmed.split(' ')
        if (words.length > 3 && words.length < 15) {
          if (trimmed.includes(' is ') || trimmed.includes(' are ') || trimmed.includes(' was ') || trimmed.includes(' were ')) {
            importantConcepts.push(trimmed)
          }
        }
      }
    }
    
    let id = 1
    
    for (const pair of termDefinitionPairs) {
      if (flashcards.length >= count) break
      
      const frontOptions = [
        `What is the definition of ${pair.term}?`,
        `What does ${pair.term} mean?`,
        `Define ${pair.term}`,
        `Explain the concept of ${pair.term}`
      ]
      
      flashcards.push({
        id: id++,
        front: frontOptions[Math.floor(Math.random() * frontOptions.length)],
        back: pair.definition
      })
    }
    
    for (const concept of importantConcepts) {
      if (flashcards.length >= count) break
      
      const words = concept.split(' ')
      if (words.length < 5) continue
      
      const keyTerm = words.slice(0, 3).join(' ')
      const explanation = words.slice(3).join(' ')
      
      if (explanation.length < 10) continue
      
      flashcards.push({
        id: id++,
        front: `What is ${keyTerm}?`,
        back: concept
      })
    }
    
    for (const question of questions) {
      if (flashcards.length >= count) break
      
      const answer = importantConcepts.find(c => c.toLowerCase().includes(question.toLowerCase().replace('?', '').split(' ')[0])) || "Review your study materials for this answer"
      
      flashcards.push({
        id: id++,
        front: question,
        back: answer
      })
    }
    
    const usedSentences = new Set()
    for (const sentence of sentences) {
      if (flashcards.length >= count) break
      
      const trimmed = sentence.trim()
      if (trimmed.length > 30 && trimmed.length < 100 && !usedSentences.has(trimmed)) {
        const words = trimmed.split(' ')
        if (words.length > 6) {
          const keyWord = words.find(w => w.length > 6 && !['the', 'and', 'that', 'this', 'with'].includes(w.toLowerCase()))
          if (keyWord) {
            const blanked = trimmed.replace(keyWord, '__________')
            flashcards.push({
              id: id++,
              front: `Fill in the blank: ${blanked}`,
              back: trimmed
            })
            usedSentences.add(trimmed)
          }
        }
      }
    }
    
    while (flashcards.length < count) {
      const randomSentence = sentences[Math.floor(Math.random() * sentences.length)]
      if (randomSentence && randomSentence.length > 20) {
        flashcards.push({
          id: id++,
          front: `Explain: ${randomSentence.substring(0, 80)}...`,
          back: randomSentence
        })
      } else {
        flashcards.push({
          id: id++,
          front: `Study question ${id}`,
          back: 'Review your study materials'
        })
      }
    }
    
    return flashcards.slice(0, count)
  }

  const [currentCard, setCurrentCard] = useState(0)

  const nextCard = () => {
    setCurrentCard((prev) => (prev + 1) % flashcards.length)
    setIsFlipped(false)
  }

  const prevCard = () => {
    setCurrentCard((prev) => (prev - 1 + flashcards.length) % flashcards.length)
    setIsFlipped(false)
  }

  return (
    <div className="min-h-screen bg-dark-bg">
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
              <h1 className="text-2xl font-semibold text-white">Flashcards</h1>
            </div>
            <div className="text-dark-text-secondary text-sm">
              SMS Grade 9
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-dark-card rounded-lg p-6 border border-dark-border mb-6"
          >
            <h2 className="text-xl font-semibold text-white mb-4">Create Flashcards</h2>
            
            <div className="mb-4">
              <label className="block text-white mb-2">Paste your study materials:</label>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Paste your notes, study guide, or any content here..."
                className="w-full h-32 bg-dark-border border border-dark-border rounded-lg p-4 text-white placeholder-dark-text-secondary focus:border-blue-400 focus:outline-none transition-colors duration-200"
              />
            </div>

            <div className="mb-4">
              <label className="block text-white mb-2">Number of flashcards to generate:</label>
              <select
                value={numQuestions}
                onChange={(e) => setNumQuestions(Number(e.target.value))}
                className="bg-dark-border border border-dark-border rounded-lg p-3 text-white focus:border-blue-400 focus:outline-none transition-colors duration-200"
              >
                <option value={5}>5 flashcards</option>
                <option value={10}>10 flashcards</option>
                <option value={15}>15 flashcards</option>
                <option value={20}>20 flashcards</option>
                <option value={25}>25 flashcards</option>
              </select>
            </div>

            <div className="mb-6">
              <label className="block text-white mb-2">Or upload files:</label>
              <div className="flex flex-wrap gap-4 mb-4">
                <button
                  onClick={triggerFileInput}
                  className="flex items-center space-x-2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors duration-200"
                >
                  <span>📎</span>
                  <span>Choose Files</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <p className="text-xs text-dark-text-secondary mt-2">
                  Supported: PDF, Word (.docx), Text files. Note: .doc and PowerPoint files need to be converted.
                </p>
                <span className="text-dark-text-secondary self-center">
                  PDF, Word, PowerPoint, Text files
                </span>
              </div>
              
              {uploadedFiles.length > 0 && (
                <div className="bg-dark-border rounded-lg p-4">
                  <h4 className="text-white font-semibold mb-2">Selected Files:</h4>
                  <ul className="text-dark-text-secondary space-y-1">
                    {uploadedFiles.map((file, index) => (
                      <li key={index}>• {file.name}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <button
              onClick={handleGenerateFlashcards}
              disabled={isGenerating || (!inputText.trim() && uploadedFiles.length === 0)}
              className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white py-3 rounded-lg font-semibold hover:from-blue-600 hover:to-cyan-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? 'Generating Flashcards...' : `Generate ${numQuestions} Flashcards`}
            </button>
          </motion.div>

          {isGenerating && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-dark-card rounded-lg p-8 border border-dark-border mb-6 text-center"
            >
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <h3 className="text-white text-lg font-semibold mb-2">Creating your flashcards</h3>
              <p className="text-dark-text-secondary">
                Generating {numQuestions} flashcards from your content...
              </p>
            </motion.div>
          )}

          {flashcards.length > 0 && !isGenerating && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-2xl mx-auto"
            >
              <div className="text-center mb-8">
                <h2 className="text-xl font-semibold text-white mb-2">Your Flashcards</h2>
                <p className="text-dark-text-secondary">Click the card to flip it</p>
              </div>

              <div className="mb-8">
                <div 
                  className="relative w-full h-64 cursor-pointer mx-auto"
                  onClick={() => setIsFlipped(!isFlipped)}
                  style={{ perspective: '1000px' }}
                >
                  <div
                    className={`relative w-full h-full transition-transform duration-500`}
                    style={{ 
                      transformStyle: 'preserve-3d',
                      transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
                    }}
                  >
                    <div 
                      className="absolute w-full h-full bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl shadow-lg flex items-center justify-center p-6"
                      style={{ backfaceVisibility: 'hidden' }}
                    >
                      <div className="text-white text-center text-lg font-medium">
                        {flashcards[currentCard].front}
                      </div>
                    </div>
                    
                    <div 
                      className="absolute w-full h-full bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl shadow-lg flex items-center justify-center p-6"
                      style={{ 
                        backfaceVisibility: 'hidden',
                        transform: 'rotateY(180deg)'
                      }}
                    >
                      <div className="text-white text-center text-lg font-medium">
                        {flashcards[currentCard].back}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center mb-8">
                <button
                  onClick={prevCard}
                  className="bg-dark-card text-white px-6 py-3 rounded-lg border border-dark-border hover:border-blue-400 transition-colors duration-200"
                >
                  Previous
                </button>
                
                <span className="text-white font-semibold">
                  {currentCard + 1} / {flashcards.length}
                </span>
                
                <button
                  onClick={nextCard}
                  className="bg-dark-card text-white px-6 py-3 rounded-lg border border-dark-border hover:border-blue-400 transition-colors duration-200"
                >
                  Next
                </button>
              </div>

              <div className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-lg p-4 border border-blue-400/30">
                <div className="flex items-start space-x-3">
                  <div className="text-2xl">🐱</div>
                  <div>
                    <h4 className="text-white font-semibold mb-2">Bobby the Study Cat</h4>
                    <p className="text-dark-text-secondary">
                      Need help with these flashcards? Ask me anything about the content!
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  )
}
