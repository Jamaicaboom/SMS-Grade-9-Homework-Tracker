'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  imageUrl?: string
}

interface BobbyChatProps {
  apiUrl: string
}

export default function BobbyChat({ apiUrl }: BobbyChatProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'm Bobby, your AI homework assistant! 🐱 I can help you with your homework, answer questions, and research topics from the internet. You can also upload images of your homework for me to analyze! What would you like help with today?",
      timestamp: new Date()
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [activityStatus, setActivityStatus] = useState<string>('')
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [chatSize, setChatSize] = useState({ width: 384, height: 600 })
  const [isResizing, setIsResizing] = useState(false)
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 })
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatWindowRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    if (!chatWindowRef.current) return
    
    setIsResizing(true)
    const rect = chatWindowRef.current.getBoundingClientRect()
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: rect.width,
      height: rect.height
    })
  }, [])

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeStart.x
      const deltaY = e.clientY - resizeStart.y
      
      setChatSize({
        width: Math.max(320, Math.min(800, resizeStart.width + deltaX)),
        height: Math.max(400, Math.min(900, resizeStart.height - deltaY))
      })
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, resizeStart])

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 10 * 1024 * 1024) { 
        alert('Image size must be less than 10MB')
        return
      }
      setSelectedImage(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const removeImage = () => {
    setSelectedImage(null)
    setImagePreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  
  const renderContentWithLinks = (content: string) => {
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
    const parts: (string | JSX.Element)[] = []
    let lastIndex = 0
    let match

    while ((match = linkRegex.exec(content)) !== null) {
      
      if (match.index > lastIndex) {
        parts.push(content.substring(lastIndex, match.index))
      }
      
      
      parts.push(
        <a
          key={match.index}
          href={match[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 underline"
        >
          {match[1]}
        </a>
      )
      
      lastIndex = match.index + match[0].length
    }

    
    if (lastIndex < content.length) {
      parts.push(content.substring(lastIndex))
    }

    return parts.length > 0 ? parts : content
  }

  const sendMessage = async () => {
    if ((!input.trim() && !selectedImage) || isLoading) return

    
    const needsResearch = input.toLowerCase().includes('search') || 
                         input.toLowerCase().includes('research') ||
                         input.toLowerCase().includes('find') ||
                         input.toLowerCase().includes('what is') ||
                         input.toLowerCase().includes('who is')

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim() || (selectedImage ? 'Image uploaded' : ''),
      timestamp: new Date(),
      imageUrl: imagePreview || undefined
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setSelectedImage(null)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setIsLoading(true)
    
    
    if (selectedImage) {
      setActivityStatus('Analyzing image...')
    } else if (needsResearch) {
      setActivityStatus('Researching...')
    } else {
      setActivityStatus('Thinking...')
    }

    try {
      const formData = new FormData()
      formData.append('message', input.trim() || (selectedImage ? 'Please analyze this homework image and help me with it.' : ''))
      if (selectedImage) {
        formData.append('image', selectedImage)
      }

      
      setTimeout(() => {
        if (isLoading) {
          if (selectedImage) {
            setActivityStatus('Analyzing homework...')
          } else if (needsResearch) {
            setActivityStatus('Researching online...')
          } else {
            setActivityStatus('Generating response...')
          }
        }
      }, 1000)

      const response = await axios.post(
        `${apiUrl}/api/bobby/chat`,
        formData,
        {
          timeout: 60000,
          headers: {
            'Content-Type': 'multipart/form-data',
          }
        }
      )

      setActivityStatus('')
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.data.response || 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      setActivityStatus('')
      console.error('Error sending message:', error)
      
      let errorContent = 'Sorry, I encountered an error. Please make sure the AI service is configured correctly.'
      
      if (axios.isAxiosError(error)) {
        if (error.response?.data?.response) {
          errorContent = error.response.data.response
        } else if (error.response?.data?.error) {
          errorContent = `Error: ${error.response.data.error}`
        } else if (error.response?.status === 500) {
          errorContent = 'Server error. Please check that the GEMINI_API_KEY is set correctly in your Render environment variables.'
        } else if (error.response?.status === 429) {
          errorContent = 'Too many requests. Please wait a moment and try again.'
        } else if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
          errorContent = 'Cannot connect to the server. Please check that your backend is running.'
        }
      }
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errorContent,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
      setActivityStatus('')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <>
      {/* Chat Toggle Button - Mobile Responsive */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-50 w-14 h-14 md:w-16 md:h-16 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-200"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        aria-label="Toggle Bobby Chat"
      >
        {isOpen ? (
          <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}
      </motion.button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={chatWindowRef}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            style={{
              width: `${chatSize.width}px`,
              height: `${chatSize.height}px`,
              maxWidth: '100vw',
              maxHeight: '100vh'
            }}
            className="fixed bottom-20 right-4 md:bottom-24 md:right-6 z-40 bg-dark-card border border-dark-border rounded-lg shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header with Purple Sunset Gradient */}
            <div className="relative bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 px-4 py-3 flex items-center justify-between overflow-hidden">
              {/* Sunset overlay effect */}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-orange-300/30"></div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-400/20 rounded-full blur-2xl"></div>
              <div className="absolute top-2 left-4 w-24 h-24 bg-pink-400/20 rounded-full blur-xl"></div>
              
              <div className="relative z-10 flex items-center space-x-2">
                {/* Cat-like profile picture */}
                <div className="w-10 h-10 bg-gradient-to-br from-orange-200 to-orange-400 rounded-full flex items-center justify-center shadow-lg border-2 border-white/50">
                  <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none">
                    {/* Cat head */}
                    <ellipse cx="12" cy="10" rx="8" ry="8" fill="#ff8c42" />
                    {/* Ears */}
                    <path d="M6 6 L8 3 L10 5" stroke="#ff8c42" strokeWidth="2" fill="#ff8c42" />
                    <path d="M18 6 L16 3 L14 5" stroke="#ff8c42" strokeWidth="2" fill="#ff8c42" />
                    {/* Eyes */}
                    <circle cx="9" cy="9" r="1.5" fill="#333" />
                    <circle cx="15" cy="9" r="1.5" fill="#333" />
                    {/* Nose */}
                    <polygon points="12,11 11,13 13,13" fill="#ff6b9d" />
                    {/* Mouth */}
                    <path d="M12 13 Q10 15, 9 14" stroke="#333" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                    <path d="M12 13 Q14 15, 15 14" stroke="#333" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-white font-semibold">Bobby</h3>
                  <p className="text-xs text-white/90">AI Homework Assistant</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="relative z-10 text-white hover:text-gray-200 transition-colors"
                aria-label="Close chat"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      message.role === 'user'
                        ? 'bg-blue-500 text-white'
                        : 'bg-dark-border text-dark-text'
                    }`}
                  >
                    {message.imageUrl && (
                      <div className="mb-2 rounded-lg overflow-hidden">
                        <img src={message.imageUrl} alt="Uploaded" className="max-w-full h-auto rounded" />
                      </div>
                    )}
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {renderContentWithLinks(message.content)}
                    </p>
                    <span className={`text-xs mt-1 block ${
                      message.role === 'user' ? 'text-blue-100' : 'text-dark-text-secondary'
                    }`}>
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </motion.div>
              ))}
              {(isLoading || activityStatus) && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="bg-dark-border text-dark-text rounded-lg px-4 py-2">
                    {activityStatus ? (
                      <div className="flex items-center space-x-2">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                        <span className="text-sm text-dark-text">{activityStatus}</span>
                      </div>
                    ) : (
                      <div className="flex space-x-2">
                        <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-dark-border p-4">
              {imagePreview && (
                <div className="mb-2 relative inline-block">
                  <img src={imagePreview} alt="Preview" className="w-24 h-24 object-cover rounded-lg" />
                  <button
                    onClick={removeImage}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                  >
                    ×
                  </button>
                </div>
              )}
              <div className="flex space-x-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-2 bg-dark-bg border border-dark-border rounded-lg hover:bg-dark-border transition-colors"
                  title="Upload image"
                >
                  <svg className="w-5 h-5 text-dark-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </button>
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={selectedImage ? "Ask about the image..." : "Ask Bobby anything..."}
                  disabled={isLoading}
                  className="flex-1 bg-dark-bg border border-dark-border rounded-lg px-4 py-2 text-white placeholder-dark-text-secondary focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                />
                <button
                  onClick={sendMessage}
                  disabled={(!input.trim() && !selectedImage) || isLoading}
                  className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
              <p className="text-xs text-dark-text-secondary mt-2">
                Bobby can help with homework, answer questions, research online, and analyze images
              </p>
            </div>

            {/* Resize Handle */}
            <div
              onMouseDown={handleMouseDown}
              className="absolute top-0 left-0 w-6 h-6 cursor-nwse-resize opacity-0 hover:opacity-100 transition-opacity bg-gradient-to-br from-purple-500/50 to-pink-500/50 rounded-br-lg"
              style={{ cursor: 'nwse-resize' }}
            >
              <div className="absolute top-1 left-1 w-4 h-4">
                <div className="w-full h-0.5 bg-white/50 mb-0.5"></div>
                <div className="w-full h-0.5 bg-white/50 mb-0.5"></div>
                <div className="w-full h-0.5 bg-white/50"></div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
