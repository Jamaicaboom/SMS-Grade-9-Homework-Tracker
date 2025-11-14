'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'

interface ContactModalProps {
  isOpen: boolean
  onClose: () => void
}


const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    
    return process.env.NEXT_PUBLIC_API_URL || 'https://sms-grade-9-homework-server.onrender.com'
  } else {
    
    return process.env.NEXT_PUBLIC_API_URL || 'https://sms-grade-9-homework-server.onrender.com'
  }
}

const API_URL = getApiUrl()

export default function ContactModal({ isOpen, onClose }: ContactModalProps) {
  const [formData, setFormData] = useState({
    type: 'suggestion' as 'suggestion' | 'issue',
    title: '',
    description: '',
    submittedBy: ''
  })
  const [files, setFiles] = useState<File[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [submitAttempts, setSubmitAttempts] = useState(0)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files)
      // Filter to only PNG files
      const pngFiles = selectedFiles.filter(file => {
        const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png')
        if (!isPng) {
          alert(`${file.name} is not a PNG file. Only PNG images are supported.`)
        }
        return isPng
      })
      // Only allow one PNG file
      setFiles(pngFiles.slice(0, 1))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    
    if (isSubmitting) return
    
    setIsSubmitting(true)
    setSubmitStatus('idle')
    setSubmitAttempts(prev => prev + 1)

    try {
      
      const username = localStorage.getItem('homework-username') || 'Anonymous'
      
      // Upload files first if any (only PNG images)
      let uploadedAttachments = []
      if (files.length > 0) {
        // Filter to only PNG files
        const pngFiles = files.filter(file => {
          const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png')
          if (!isPng) {
            alert(`${file.name} is not a PNG file. Only PNG images are supported.`)
          }
          return isPng
        })

        if (pngFiles.length > 0) {
          const formData = new FormData()
          // Only upload the first PNG file
          formData.append('files', pngFiles[0])

          try {
            const uploadResponse = await axios.post(`${API_URL}/api/upload`, formData, {
              headers: {
                'Content-Type': 'multipart/form-data',
              },
              timeout: 30000
            })

            if (uploadResponse.data.success && uploadResponse.data.files) {
              uploadedAttachments = uploadResponse.data.files.map((file: any) => ({
                filename: file.filename,
                mimetype: 'image/png',
                url: file.url
              }))
            }
          } catch (uploadError) {
            console.error('Error uploading files:', uploadError)
            // Continue without attachments if upload fails
          }
        }
      }
      
      
      const submitData = {
        ...formData,
        submittedBy: username,
        attachments: uploadedAttachments
      }

      
      let retryCount = 0
      const maxRetries = 2
      
      while (retryCount <= maxRetries) {
        try {
          await axios.post(`${API_URL}/api/contact`, submitData, {
            timeout: 15000, 
            headers: {
              'Content-Type': 'application/json',
            }
          })
          break 
        } catch (error) {
          if (axios.isAxiosError(error) && error.response?.status === 429 && retryCount < maxRetries) {
            
            const waitTime = Math.pow(2, retryCount) * 1000 
            await new Promise(resolve => setTimeout(resolve, waitTime))
            retryCount++
            continue
          }
          throw error 
        }
      }

      setSubmitStatus('success')
      
      
      setFormData({
        type: 'suggestion',
        title: '',
        description: '',
        submittedBy: ''
      })
      setFiles([])
      setSubmitAttempts(0)

      
      setTimeout(() => {
        onClose()
        setSubmitStatus('idle')
      }, 2000)

    } catch (error) {
      console.error('Error submitting contact form:', error)
      
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
          console.error('Backend server is not running or not reachable')
        } else if (error.response?.status === 503) {
          console.error('Backend service temporarily unavailable')
        } else if (error.response?.status === 429) {
          console.error('Rate limit exceeded, please try again later')
        }
      }
      setSubmitStatus('error')
      setSubmitAttempts(0)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      onClose()
      setSubmitStatus('idle')
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-dark-card rounded-lg border border-dark-border w-full max-w-md max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white">Contact Us</h2>
                <button
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="text-dark-text-secondary hover:text-white transition-colors disabled:opacity-50"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {submitStatus === 'success' ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center py-8"
                >
                  <div className="text-6xl mb-4">✅</div>
                  <h3 className="text-lg font-semibold text-white mb-2">Thank you!</h3>
                  <p className="text-dark-text-secondary">
                    Your {formData.type} has been submitted successfully.
                  </p>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      What is your issue?
                    </label>
                    <select
                      name="type"
                      value={formData.type}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-dark-border border border-dark-border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="suggestion">💡 Suggest Homework</option>
                      <option value="issue">🐛 Report an Issue</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Title
                    </label>
                    <input
                      type="text"
                      name="title"
                      value={formData.title}
                      onChange={handleInputChange}
                      placeholder={formData.type === 'suggestion' ? 'e.g., Add more math problems' : 'e.g., Website not loading'}
                      className="w-full px-3 py-2 bg-dark-border border border-dark-border rounded-md text-white placeholder-dark-text-secondary focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Description
                    </label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      placeholder={formData.type === 'suggestion' ? 'Describe your homework suggestion...' : 'Describe the issue you\'re experiencing...'}
                      rows={4}
                      className="w-full px-3 py-2 bg-dark-border border border-dark-border rounded-md text-white placeholder-dark-text-secondary focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      required
                    />
                  </div>

                  {formData.type === 'issue' && (
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">
                        Attach Image (Optional - PNG only)
                      </label>
                      <input
                        type="file"
                        onChange={handleFileChange}
                        className="w-full px-3 py-2 bg-dark-border border border-dark-border rounded-md text-white file:mr-4 file:py-1 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-500 file:text-white hover:file:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        accept="image/png,.png"
                      />
                      <p className="text-xs text-dark-text-secondary mt-1">
                        Only PNG images are supported for webhook display
                      </p>
                      {files.length > 0 && (
                        <div className="mt-2">
                          <p className="text-sm text-dark-text-secondary">Selected files:</p>
                          <ul className="text-sm text-white">
                            {files.map((file, index) => (
                              <li key={index}>• {file.name}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={handleClose}
                      disabled={isSubmitting}
                      className="flex-1 px-4 py-2 bg-dark-border text-white rounded-md hover:bg-dark-border/80 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? 'Submitting...' : 'Submit'}
                    </button>
                  </div>

                  {submitStatus === 'error' && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 bg-red-500/20 border border-red-500/50 rounded-md"
                    >
                      <p className="text-red-400 text-sm">
                        {submitAttempts > 1 
                          ? 'Rate limit exceeded. Please wait a minute before trying again.'
                          : 'Failed to submit. Please try again later.'
                        }
                      </p>
                    </motion.div>
                  )}
                </form>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
