'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import axios from 'axios'


const getApiUrl = () => {
  return process.env.NEXT_PUBLIC_API_URL || 'https://sms-grade-9-homework-server.onrender.com'
}

const API_URL = getApiUrl()

export default function StudyGuidesPage() {
  const router = useRouter()
  const [inputText, setInputText] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [studyGuide, setStudyGuide] = useState('')
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files) {
      setUploadedFiles(Array.from(files))
    }
  }

  const handleGenerateStudyGuide = async () => {
    if (!inputText.trim() && uploadedFiles.length === 0) {
      alert('Please enter text or upload files to generate a study guide')
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

        const extractResponse = await axios.post(`${API_URL}/api/extract-text`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          timeout: 60000
        })

        if (extractResponse.data.success) {
          const extractedText = extractResponse.data.text
          // Combine with existing text if any
          contentToUse = inputText.trim() 
            ? `${inputText}\n\n${extractedText}` 
            : extractedText

          // Show warnings if any
          if (extractResponse.data.errors && extractResponse.data.errors.length > 0) {
            alert(`Some files couldn't be processed:\n${extractResponse.data.errors.join('\n')}`)
          }
        } else {
          throw new Error('Failed to extract text from files')
        }
      }
     
      const response = await axios.post(`${API_URL}/api/bobby/chat`, {
        message: `Create a comprehensive, well-organized study guide using ALL the information provided. 

IMPORTANT: 
- Use numbers 1, 2, 3, 4 instead of Roman numerals I, II, III, IV
- Do NOT use markdown tables with | symbols
- Format regions and climate regions as bullet points with descriptions
- Format cause and effect as bullet points with arrows →
- Keep all definitions and descriptions intact
- Make it clean and easy to read

Here is the content:\n\n${contentToUse}`
      }, {
        timeout: 60000
      })

      if (response.data && response.data.response) {
        const guide = response.data.response
        
        const cleanGuide = guide
          .replace(/\*\*/g, '')
          .replace(/\|/g, '')
          .replace(/I\. /g, '1. ')
          .replace(/II\. /g, '2. ')
          .replace(/III\. /g, '3. ')
          .replace(/IV\. /g, '4. ')
          .replace(/V\. /g, '5. ')
          .replace(/VI\. /g, '6. ')
          .replace(/VII\. /g, '7. ')
          .replace(/VIII\. /g, '8. ')
        setStudyGuide(cleanGuide)
      } else {
        throw new Error('No response from AI')
      }
    } catch (error) {
      console.error('Error generating study guide:', error)
      
      // Fallback to local generation if AI fails
      let contentToUse = inputText
      if (uploadedFiles.length > 0) {
        // Try to extract text from files for fallback
        try {
          const formData = new FormData()
          uploadedFiles.forEach(file => {
            formData.append('files', file)
          })
          const response = await axios.post(`${API_URL}/api/extract-text`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 60000
          })
          if (response.data.success) {
            contentToUse = inputText.trim() 
              ? `${inputText}\n\n${response.data.text}` 
              : response.data.text
          }
        } catch (fileError) {
          console.error('Error extracting text from files:', fileError)
        }
      }
      
      const formattedContent = generateComprehensiveStudyGuide(contentToUse)
      setStudyGuide(formattedContent)
    } finally {
      setIsGenerating(false)
    }
  }

  
  const generateComprehensiveStudyGuide = (text: string) => {
    return `GRADE 9 CANADA STUDY GUIDE

1. KEY TERMS & DEFINITIONS

${extractKeyTermsWithDefinitions(text)}

2. CANADIAN REGIONS

${extractRegionsWithDescriptions(text)}

3. CLIMATE REGIONS OF CANADA

${extractClimateRegionsWithCharacteristics(text)}

4. SOCIAL & POPULATION FACTORS

${extractSocialFactors(text)}

5. HYDROGRAPHIC CONCEPTS

${extractHydrographicConcepts(text)}

6. IMPORTANT FACTS TO MEMORIZE

${extractFactsToMemorize(text)}

7. CAUSE AND EFFECT RELATIONSHIPS

${extractCauseAndEffect(text)}

STUDY TIPS
• Create flashcards for each key term and its definition
• Practice matching regions with their characteristics  
• Study the climate regions and their unique features
• Understand the cause-effect relationships in Canadian geography
• Review the social factors affecting population distribution`
  }

  
  const extractKeyTermsWithDefinitions = (text: string) => {
    const lines = text.split('\n')
    let keyTerms = ''
    let inKeyTerms = false
    
    for (const line of lines) {
      if (line.includes('Key Terms/Concepts')) {
        inKeyTerms = true
        continue
      }
      if (inKeyTerms && line.includes('Key Regions')) {
        break
      }
      if (inKeyTerms && line.trim() && !line.includes('Key Terms/Concepts')) {
        if (line.includes(':')) {
          keyTerms += `• ${line.trim()}\n`
        } else if (line.trim()) {
          keyTerms += `• ${line.trim()}\n`
        }
      }
    }
    return keyTerms || 'No key terms extracted'
  }

  const extractRegionsWithDescriptions = (text: string) => {
    const lines = text.split('\n')
    let regions = ''
    let inRegions = false
    
    for (const line of lines) {
      if (line.includes('Key Regions')) {
        inRegions = true
        continue
      }
      if (inRegions && line.includes('Key Climate Regions')) {
        break
      }
      if (inRegions && line.includes('\t') && !line.includes('Region') && !line.includes('Description')) {
        const parts = line.split('\t').filter(part => part.trim())
        if (parts.length >= 2) {
          regions += `• ${parts[0].trim()}: ${parts[1].trim()}\n`
        }
      }
    }
    return regions || 'No regions extracted'
  }

  const extractClimateRegionsWithCharacteristics = (text: string) => {
    const lines = text.split('\n')
    let climates = ''
    let inClimates = false
    
    for (const line of lines) {
      if (line.includes('Key Climate Regions')) {
        inClimates = true
        continue
      }
      if (inClimates && line.includes('Key Social Factors')) {
        break
      }
      if (inClimates && line.includes('\t') && !line.includes('Climate Region') && !line.includes('Characteristics')) {
        const parts = line.split('\t').filter(part => part.trim())
        if (parts.length >= 2) {
          climates += `• ${parts[0].trim()}: ${parts[1].trim()}\n`
        }
      }
    }
    return climates || 'No climate regions extracted'
  }

  const extractSocialFactors = (text: string) => {
    const lines = text.split('\n')
    let socialFactors = ''
    let inSocial = false
    
    for (const line of lines) {
      if (line.includes('Key Social Factors')) {
        inSocial = true
        continue
      }
      if (inSocial && line.includes('Key Hydrographic Concepts')) {
        break
      }
      if (inSocial && line.trim() && !line.includes('Key Social Factors')) {
        socialFactors += `• ${line.trim()}\n`
      }
    }
    return socialFactors || 'No social factors extracted'
  }

  const extractHydrographicConcepts = (text: string) => {
    const lines = text.split('\n')
    let concepts = ''
    let inConcepts = false
    
    for (const line of lines) {
      if (line.includes('Key Hydrographic Concepts')) {
        inConcepts = true
        continue
      }
      if (inConcepts && line.includes('Facts to Memorize')) {
        break
      }
      if (inConcepts && line.trim() && !line.includes('Key Hydrographic Concepts')) {
        concepts += `• ${line.trim()}\n`
      }
    }
    return concepts || 'No hydrographic concepts extracted'
  }

  const extractFactsToMemorize = (text: string) => {
    const lines = text.split('\n')
    let facts = ''
    let inFacts = false
    
    for (const line of lines) {
      if (line.includes('Facts to Memorize')) {
        inFacts = true
        continue
      }
      if (inFacts && line.includes('Reference Information')) {
        break
      }
      if (inFacts && line.trim() && !line.includes('Facts to Memorize')) {
        facts += `• ${line.trim()}\n`
      }
    }
    return facts || 'No facts extracted'
  }

  const extractCauseAndEffect = (text: string) => {
    const lines = text.split('\n')
    let relationships = ''
    let inCauseEffect = false
    let isHeader = true
    
    for (const line of lines) {
      if (line.includes('Cause and Effect')) {
        inCauseEffect = true
        continue
      }
      if (inCauseEffect && line.trim() && !line.includes('Cause and Effect')) {
        if (line.includes('\t') && !isHeader) {
          const parts = line.split('\t').filter(part => part.trim())
          if (parts.length >= 2) {
            relationships += `• ${parts[0].trim()} → ${parts[1].trim()}\n`
          }
        }
        isHeader = false
      }
    }
    return relationships || 'No cause and effect relationships extracted'
  }

  const handleCreateFlashcards = () => {
    if (!studyGuide) {
      alert('Please generate a study guide first')
      return
    }
    router.push('/flashcards?content=' + encodeURIComponent(inputText))
  }

  const triggerFileInput = () => {
    fileInputRef.current?.click()
  }

  
  const speakImportantParts = async () => {
    if (!studyGuide) return

    if (isSpeaking) {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
      setIsSpeaking(false)
      return
    }

    setIsSpeaking(true)

    if ('speechSynthesis' in window) {
      
      const cleanText = studyGuide.replace(/\*\*/g, '').replace(/[•*;-]\s*/g, '')
      
      const speech = new SpeechSynthesisUtterance()
      
      const bobbyIntro = "Hello! I'm Bobby, here to help you study. Let's go through your study guide. "
      const contentPreview = cleanText.substring(0, 1000) + "... That covers the main topics. Good luck with your studies!"
      const fullText = bobbyIntro + contentPreview
      
      speech.text = fullText
      speech.rate = 1.0
      speech.pitch = 2.5
      speech.volume = 1

      const voices = window.speechSynthesis.getVoices()
      const clearVoice = voices.find(voice => 
        voice.name.includes('Google US English') || 
        voice.name.includes('Microsoft David')
      )
      
      if (clearVoice) {
        speech.voice = clearVoice
      }

      speech.onend = () => {
        setIsSpeaking(false)
      }

      speech.onerror = () => {
        setIsSpeaking(false)
      }

      window.speechSynthesis.speak(speech)
    } else {
      alert('Text-to-speech is not supported in your browser. Try Chrome or Edge!')
      setIsSpeaking(false)
    }
  }

  
  const cleanStudyGuide = (text: string) => {
    return text
      .replace(/\*\*/g, '') 
      .replace(/\|/g, '') 
      .replace(/#+/g, '') 
      .replace(/\* /g, '• ') 
      .replace(/- /g, '• ') 
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n')
  }

  
  const renderStudyGuide = () => {
    const cleanGuide = cleanStudyGuide(studyGuide)
    const sections = []
    let currentSection = []
    let currentSectionTitle = ''
    
    
    const lines = cleanGuide.split('\n')
    
    for (const line of lines) {
      
      if ((/^\d+\./.test(line) || line.toUpperCase() === line) && line.length < 100 && !line.startsWith('•') && line.length > 3) {
        
        if (currentSection.length > 0) {
          sections.push({
            title: currentSectionTitle,
            content: [...currentSection]
          })
        }
        
        currentSectionTitle = line
        currentSection = []
      } else {
        currentSection.push(line)
      }
    }
    
    
    if (currentSection.length > 0) {
      sections.push({
        title: currentSectionTitle,
        content: [...currentSection]
      })
    }

    
    if (sections.length === 0) {
      sections.push({
        title: 'STUDY GUIDE',
        content: lines
      })
    }

    return sections.map((section, sectionIndex) => (
      <div key={sectionIndex} className="mb-8 pb-6 border-b border-gray-600 last:border-b-0">
        {/* Section Header */}
        <div className="text-2xl font-bold text-purple-400 mb-4 pb-2 border-b border-purple-400">
          {section.title}
        </div>
        
        {/* Section Content */}
        <div className="space-y-3">
          {section.content.map((line, lineIndex) => {
            if (line.trim() === '') {
              return <div key={lineIndex} className="h-3"></div>
            }
            
            
            if (/^\d+\./.test(line.trim())) {
              const numberMatch = line.match(/^(\d+\.)\s*(.*)/)
              if (numberMatch) {
                return (
                  <div key={lineIndex} className="text-white mb-3 ml-4 leading-relaxed flex">
                    <span className="text-blue-400 font-bold mr-2">{numberMatch[1]}</span>
                    <span>{numberMatch[2]}</span>
                  </div>
                )
              }
            }
            
            
            if (line.trim().startsWith('•')) {
              const content = line.substring(1).trim()
              return (
                <div key={lineIndex} className="text-white mb-2 ml-6 leading-relaxed flex items-start">
                  <span className="text-green-400 mr-2 mt-1">•</span>
                  <span>{content}</span>
                </div>
              )
            }
            
            
            return (
              <div key={lineIndex} className="text-white mb-3 leading-relaxed">
                {line}
              </div>
            )
          })}
        </div>
      </div>
    ))
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
              <h1 className="text-2xl font-semibold text-white">Study Guides</h1>
            </div>
            <div className="text-dark-text-secondary text-sm">
              SMS Grade 9
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Input Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-dark-card rounded-lg p-6 border border-dark-border mb-6"
          >
            <h2 className="text-xl font-semibold text-white mb-4">Create Study Guide</h2>
            
            {/* Text Input */}
            <div className="mb-6">
              <label className="block text-white mb-2">Paste your notes or textbook content:</label>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Paste your notes, textbook content, or any study material here..."
                className="w-full h-48 bg-dark-border border border-dark-border rounded-lg p-4 text-white placeholder-dark-text-secondary focus:border-purple-400 focus:outline-none transition-colors duration-200"
              />
            </div>

            {/* File Upload */}
            <div className="mb-6">
              <label className="block text-white mb-2">Or upload files:</label>
              <div className="flex flex-wrap gap-4 mb-4">
                <button
                  onClick={triggerFileInput}
                  className="flex items-center space-x-2 bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 transition-colors duration-200"
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
                <span className="text-dark-text-secondary self-center">
                  PDF, Word, PowerPoint, Text files
                </span>
                <p className="text-xs text-dark-text-secondary mt-2">
                  Supported: PDF, Word (.docx), Text files. Note: .doc and PowerPoint files need to be converted.
                </p>
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
              onClick={handleGenerateStudyGuide}
              disabled={isGenerating || (!inputText.trim() && uploadedFiles.length === 0)}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 rounded-lg font-semibold hover:from-purple-600 hover:to-pink-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? 'Generating Study Guide...' : 'Generate Study Guide'}
            </button>
          </motion.div>

          {/* Loading State */}
          {isGenerating && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-dark-card rounded-lg p-8 border border-dark-border mb-6 text-center"
            >
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
              <h3 className="text-white text-lg font-semibold mb-2">Bobby is creating your study guide</h3>
              <p className="text-dark-text-secondary">
                Analyzing your content and organizing it into a study guide...
              </p>
            </motion.div>
          )}

          {/* Study Guide Output */}
          {studyGuide && !isGenerating && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-dark-card rounded-lg p-6 border border-dark-border"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h2 className="text-xl font-semibold text-white">Your Study Guide</h2>
                
                <div className="flex flex-wrap gap-3">
                  {/* Fullscreen Button */}
                  <button
                    onClick={() => setIsFullscreen(true)}
                    className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-600 transition-all duration-200"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
                    </svg>
                    Full Screen
                  </button>

                  {/* Text-to-Speech Button */}
                  <button
                    onClick={speakImportantParts}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all duration-200 ${
                      isSpeaking 
                        ? 'bg-red-500 text-white hover:bg-red-600' 
                        : 'bg-green-500 text-white hover:bg-green-600'
                    }`}
                  >
                    {isSpeaking ? (
                      <>
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M6 6h4v12H6zm8 0h4v12h-4z"/>
                        </svg>
                        Stop Bobby
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                        </svg>
                        Bobby's Summary
                      </>
                    )}
                  </button>

                  {/* Create Flashcards Button */}
                  <button
                    onClick={handleCreateFlashcards}
                    className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white px-4 py-2 rounded-lg font-semibold hover:from-cyan-600 hover:to-blue-600 transition-all duration-200"
                  >
                    Create Flashcards
                  </button>
                </div>
              </div>
              
              {/* Study Guide Content */}
              <div className="bg-dark-border rounded-lg p-6 max-h-[600px] overflow-y-auto">
                <div className="prose prose-invert max-w-none">
                  {renderStudyGuide()}
                </div>
              </div>

              {/* Bobby AI Assistance */}
              <div className="mt-6 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-lg p-4 border border-purple-400/30">
                <div className="flex items-start space-x-3">
                  <div className="text-2xl">🐱</div>
                  <div>
                    <h4 className="text-white font-semibold mb-2">Bobby the Study Cat</h4>
                    <p className="text-dark-text-secondary">
                      {isSpeaking 
                        ? "I'm reading through your study guide with my high-pitched voice!"
                        : "Click 'Bobby's Summary' to hear me read through your study guide content!"
                      }
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </main>

      {/* Fullscreen Modal */}
      <AnimatePresence>
        {isFullscreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-50 flex flex-col"
          >
            {/* Fullscreen Header */}
            <div className="bg-dark-card border-b border-dark-border p-4 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-white">Study Guide - Full Screen</h2>
              <div className="flex gap-3">
                <button
                  onClick={speakImportantParts}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all duration-200 ${
                    isSpeaking 
                      ? 'bg-red-500 text-white hover:bg-red-600' 
                      : 'bg-green-500 text-white hover:bg-green-600'
                  }`}
                >
                  {isSpeaking ? 'Stop Bobby' : "Bobby's Summary"}
                </button>
                <button
                  onClick={() => setIsFullscreen(false)}
                  className="bg-red-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-600 transition-all duration-200"
                >
                  Exit Full Screen
                </button>
              </div>
            </div>

            {/* Fullscreen Content */}
            <div className="flex-1 bg-dark-bg p-8 overflow-y-auto">
              <div className="max-w-4xl mx-auto bg-dark-card rounded-lg p-8 border border-dark-border">
                <div className="prose prose-invert max-w-none text-lg leading-relaxed">
                  {renderStudyGuide()}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
