'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'
import { formatDistanceToNow, format } from 'date-fns'
import { zonedTimeToUtc, utcToZonedTime, format as formatTz } from 'date-fns-tz'
import HomeworkCard from './components/HomeworkCard'
import HomeworkModal from './components/HomeworkModal'
import Header from './components/Header'
import ContactModal from './components/ContactModal'
import BobbyChat from './components/BobbyChat'
import { useRouter } from 'next/navigation'

interface Homework {
  _id: string
  title: string
  subject: string
  dueDate: string
  description: string
  creator: string
  status: 'Done' | 'Not Done'
  completedBy: Array<{
    username: string
    completedAt: string
  }>
  createdAt: string
}

interface StudyLink {
  _id: string
  url: string
  title: string
  description: string
  addedBy: string
  createdAt: string
}


const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    
    return process.env.NEXT_PUBLIC_API_URL || 'https://sms-grade-9-homework-server.onrender.com'
  } else {
    
    return process.env.NEXT_PUBLIC_API_URL || 'https://sms-grade-9-homework-server.onrender.com'
  }
}

const API_URL = getApiUrl()
const WINNIPEG_TIMEZONE = 'America/Winnipeg'


axios.interceptors.response.use(null, async (error) => {
  if (error.response?.status === 429) {
    console.log('Rate limited, retrying in 2 seconds...')
    await new Promise(res => setTimeout(res, 2000))
    return axios.request(error.config)
  }
  return Promise.reject(error)
})

export default function Home() {
  const [homework, setHomework] = useState<Homework[]>([])
  const [studyLinks, setStudyLinks] = useState<StudyLink[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedHomework, setSelectedHomework] = useState<Homework | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isContactModalOpen, setIsContactModalOpen] = useState(false)
  const [username, setUsername] = useState('')
  const [activeTab, setActiveTab] = useState<'main' | 'done' | 'studying'>('main')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [announcement, setAnnouncement] = useState<{ message: string; _id: string } | null>(null)
  const router = useRouter()

  
  useEffect(() => {
    const savedUsername = localStorage.getItem('homework-username')
    if (savedUsername) {
      setUsername(savedUsername)
    } else {
      const newUsername = prompt('Enter your name for the homework tracker:') || 'Student'
      setUsername(newUsername)
      localStorage.setItem('homework-username', newUsername)
    }
  }, [])

  const fetchHomework = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/homework`, {
        timeout: 10000, 
        headers: {
          'Content-Type': 'application/json',
        }
      })
      setHomework(response.data)
    } catch (error) {
      console.error('Error fetching homework:', error)
      
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
          console.error('Backend server is not running or not reachable')
        } else if (error.response?.status === 503) {
          console.error('Backend service temporarily unavailable')
        }
      }
      
    } finally {
      setLoading(false)
    }
  }

  const fetchStudyLinks = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/study-links`, {
        timeout: 10000, 
        headers: {
          'Content-Type': 'application/json',
        }
      })
      setStudyLinks(response.data)
    } catch (error) {
      console.error('Error fetching study links:', error)
      
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
          console.error('Backend server is not running or not reachable')
        } else if (error.response?.status === 503) {
          console.error('Backend service temporarily unavailable')
        }
      }
      
    }
  }

  const fetchAnnouncement = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/announcement`, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
        }
      })
      if (response.data && response.data.message) {
        setAnnouncement(response.data)
      } else {
        setAnnouncement(null)
      }
    } catch (error) {
      console.error('Error fetching announcement:', error)
      setAnnouncement(null)
    }
  }

  useEffect(() => {
    fetchHomework()
    fetchStudyLinks()
    fetchAnnouncement()
    
    
    const interval = setInterval(() => {
      fetchHomework()
      fetchStudyLinks()
      fetchAnnouncement()
    }, 60000)
    
    return () => clearInterval(interval)
  }, [])

  
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  const handleCardClick = (homework: Homework) => {
    setSelectedHomework(homework)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedHomework(null)
  }

  const handleStatusToggle = async (id: string, currentStatus: string) => {
    try {
      if (!username) return
      
      
      try {
        await axios.patch(`${API_URL}/api/homework/${id}/complete`, 
          { username },
          {
            timeout: 10000,
            headers: {
              'Content-Type': 'application/json',
            }
          }
        )
      } catch (patchError) {
        
        console.log('PATCH failed, trying POST fallback...')
        await axios.post(`${API_URL}/api/homework/${id}/complete`, 
          { username },
          {
            timeout: 10000,
            headers: {
              'Content-Type': 'application/json',
            }
          }
        )
      }
      
      
      setHomework(prev => prev.map(item => {
        if (item._id === id) {
          const isCompleted = item.completedBy.some(completion => completion.username === username)
          if (isCompleted) {
            
            setToast({ message: '✅ Homework marked as not done!', type: 'success' })
            return {
              ...item,
              completedBy: item.completedBy.filter(completion => completion.username !== username)
            }
          } else {
            
            setToast({ message: '✅ Homework marked as done!', type: 'success' })
            return {
              ...item,
              completedBy: [...item.completedBy, { username, completedAt: new Date().toISOString() }]
            }
          }
        }
        return item
      }))
    } catch (error) {
      console.error('Error updating homework status:', error)
      
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
          console.error('Backend server is not running or not reachable')
        } else if (error.response?.status === 503) {
          console.error('Backend service temporarily unavailable')
        }
      }
      setToast({ message: '❌ Failed to update homework status', type: 'error' })
    }
  }

  const getStatusColor = (homework: Homework) => {
    const isPersonallyCompleted = homework.completedBy.some(completion => completion.username === username)
    return isPersonallyCompleted ? 'text-green-400' : 'text-red-400'
  }

  const getPersonalStatus = (homework: Homework) => {
    const isPersonallyCompleted = homework.completedBy.some(completion => completion.username === username)
    return isPersonallyCompleted ? 'Done' : 'Not Done'
  }

  const getUrgencyColor = (dueDate: string) => {
    const due = new Date(dueDate)
    const nowWinnipeg = utcToZonedTime(new Date(), WINNIPEG_TIMEZONE)
    const dueWinnipeg = utcToZonedTime(due, WINNIPEG_TIMEZONE)
    const diffDays = Math.ceil((dueWinnipeg.getTime() - nowWinnipeg.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays < 0) return 'text-red-500' 
    if (diffDays <= 1) return 'text-red-400' 
    if (diffDays <= 3) return 'text-yellow-400' 
    return 'text-gray-400' 
  }

  
  const navigateToStudyGuides = () => {
    router.push('/study-guides')
  }

  const navigateToFlashcards = () => {
    router.push('/flashcards')
  }

  const navigateToStudySessions = () => {
    router.push('/study-sessions')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-dark-text-secondary">Loading homework...</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark-bg">
      {/* Announcement Banner */}
      {announcement && (
        <div className="bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 text-white py-2 overflow-hidden relative z-50">
          <div className="marquee-container">
            <div className="marquee-content">
              <span className="font-semibold">📢 {announcement.message}</span>
            </div>
          </div>
        </div>
      )}
      <Header onContactClick={() => setIsContactModalOpen(true)} />
      
      <main className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <h1 className="text-2xl font-semibold text-white mb-2">SMS Grade 9 Homework</h1>
          <p className="text-dark-text-secondary text-sm">
            {homework.length} assignment{homework.length !== 1 ? 's' : ''} total
          </p>
        </motion.div>

        {/* Tab Navigation */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-8"
        >
          <div className="flex space-x-1 bg-dark-card p-1 rounded-lg w-fit">
            <button
              onClick={() => setActiveTab('main')}
              className={`px-6 py-3 rounded-md font-medium transition-all duration-200 ${
                activeTab === 'main'
                  ? 'bg-blue-500 text-white shadow-lg'
                  : 'text-dark-text-secondary hover:text-white hover:bg-dark-border'
              }`}
            >
              Main
            </button>
            <button
              onClick={() => setActiveTab('done')}
              className={`px-6 py-3 rounded-md font-medium transition-all duration-200 ${
                activeTab === 'done'
                  ? 'bg-green-500 text-white shadow-lg'
                  : 'text-dark-text-secondary hover:text-white hover:bg-dark-border'
              }`}
            >
              Done
            </button>
            <button
              onClick={() => setActiveTab('studying')}
              className={`px-6 py-3 rounded-md font-medium transition-all duration-200 ${
                activeTab === 'studying'
                  ? 'bg-purple-500 text-white shadow-lg'
                  : 'text-dark-text-secondary hover:text-white hover:bg-dark-border'
              }`}
            >
              Studying
            </button>
          </div>
        </motion.div>

        {activeTab === 'studying' ? (
          
          <div className="space-y-8">
            {/* Study Tools Navigation */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
            >
              <button
                onClick={navigateToStudyGuides}
                className="bg-gradient-to-br from-purple-500 to-pink-500 text-white p-6 rounded-lg border border-purple-400 hover:from-purple-600 hover:to-pink-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 group"
              >
                <div className="text-3xl mb-3 group-hover:scale-110 transition-transform duration-200">📚</div>
                <h3 className="text-lg font-semibold mb-2">Study Guides</h3>
                <p className="text-sm opacity-90">Generate custom study guides</p>
              </button>

              <button
                onClick={navigateToFlashcards}
                className="bg-gradient-to-br from-blue-500 to-cyan-500 text-white p-6 rounded-lg border border-blue-400 hover:from-blue-600 hover:to-cyan-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 group"
              >
                <div className="text-3xl mb-3 group-hover:scale-110 transition-transform duration-200">🎴</div>
                <h3 className="text-lg font-semibold mb-2">Flashcards</h3>
                <p className="text-sm opacity-90">Interactive flashcard decks</p>
              </button>

              <button
                onClick={navigateToStudySessions}
                className="bg-gradient-to-br from-green-500 to-emerald-500 text-white p-6 rounded-lg border border-green-400 hover:from-green-600 hover:to-emerald-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 group"
              >
                <div className="text-3xl mb-3 group-hover:scale-110 transition-transform duration-200">⏱️</div>
                <h3 className="text-lg font-semibold mb-2">Study Sessions</h3>
                <p className="text-sm opacity-90">Timed study sessions</p>
              </button>
            </motion.div>

            {/* Study Links Section */}
            <div>
              <h2 className="text-xl font-semibold text-white mb-6">Study Resources</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatePresence>
                  {studyLinks.map((link, index) => (
                    <motion.div
                      key={link._id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                      className="bg-dark-card rounded-lg p-6 border border-dark-border hover:border-purple-400 transition-colors duration-200"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <h3 className="text-lg font-semibold text-white line-clamp-2">{link.title}</h3>
                        <span className="text-xs text-dark-text-secondary bg-dark-border px-2 py-1 rounded">
                          {formatDistanceToNow(new Date(link.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      
                      {link.description && (
                        <p className="text-dark-text-secondary text-sm mb-4 line-clamp-3">
                          {link.description}
                        </p>
                      )}
                      
                      <div className="flex items-center justify-between">
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 transition-colors duration-200 text-sm font-medium"
                        >
                          <span>Visit Link</span>
                          <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                        <span className="text-xs text-dark-text-secondary">
                          by {link.addedBy}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>
        ) : homework.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <div className="text-6xl mb-4">📚</div>
            <h2 className="text-2xl font-semibold text-white mb-2">No homework!</h2>
            <p className="text-dark-text-secondary">
              Add homework using the Discord bot or wait for assignments to be added.
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {homework
                .filter(item => {
                  const isPersonallyCompleted = item.completedBy.some(completion => completion.username === username)
                  if (activeTab === 'main') {
                    
                    return !isPersonallyCompleted
                  } else {
                    
                    return isPersonallyCompleted
                  }
                })
                .map((item, index) => (
                <motion.div
                  key={item._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                >
                  <HomeworkCard
                    homework={item}
                    onClick={() => handleCardClick(item)}
                    onStatusToggle={() => handleStatusToggle(item._id, getPersonalStatus(item))}
                    getStatusColor={getStatusColor}
                    getUrgencyColor={getUrgencyColor}
                    getPersonalStatus={getPersonalStatus}
                    username={username}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Show message when no items in current tab */}
        {activeTab === 'studying' ? (
          studyLinks.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-8"
            >
              <div className="text-4xl mb-4">📖</div>
              <h2 className="text-xl font-semibold text-white mb-2">No study links yet!</h2>
              <p className="text-dark-text-secondary">
                Add study resources using the Discord bot command /link
              </p>
            </motion.div>
          )
        ) : homework.length > 0 && homework.filter(item => {
          const isPersonallyCompleted = item.completedBy.some(completion => completion.username === username)
          if (activeTab === 'main') {
            return !isPersonallyCompleted
          } else {
            return isPersonallyCompleted
          }
        }).length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <div className="text-6xl mb-4">
              {activeTab === 'main' ? '🎉' : '✅'}
            </div>
            <h2 className="text-2xl font-semibold text-white mb-2">No homework!</h2>
            <p className="text-dark-text-secondary">
              {activeTab === 'main' 
                ? 'You have no pending homework assignments.' 
                : 'No homework! Woohoo, you rock!'}
            </p>
          </motion.div>
        )}
      </main>

      {/* Footer with credit */}
      <footer className="mt-16 py-8 border-t border-dark-border">
        <div className="container mx-auto px-4 text-center">
          <p className="text-dark-text-secondary text-sm">
            Created by <span className="text-white font-medium">Somting</span> • SMS Grade 9 Homework Tracker
          </p>
        </div>
      </footer>

      <AnimatePresence>
        {isModalOpen && selectedHomework && (
          <HomeworkModal
            homework={selectedHomework}
            onClose={handleCloseModal}
            onStatusToggle={() => handleStatusToggle(selectedHomework._id, getPersonalStatus(selectedHomework))}
            getStatusColor={getStatusColor}
            getUrgencyColor={getUrgencyColor}
          />
        )}
      </AnimatePresence>

      <ContactModal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
      />

      {/* Bobby AI Chat */}
      <BobbyChat apiUrl={API_URL} />

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-4 right-4 z-50"
          >
            <div className={`px-6 py-3 rounded-lg shadow-lg border ${
              toast.type === 'success' 
                ? 'bg-green-500/90 text-white border-green-400' 
                : 'bg-red-500/90 text-white border-red-400'
            }`}>
              <p className="font-medium">{toast.message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
