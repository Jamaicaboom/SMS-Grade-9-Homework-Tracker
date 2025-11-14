'use client'

import { motion } from 'framer-motion'
import { formatDistanceToNow, format, differenceInDays, differenceInHours, differenceInMinutes } from 'date-fns'
import { utcToZonedTime } from 'date-fns-tz'
import { X, CheckCircle, Clock, BookOpen, Calendar } from 'lucide-react'

interface Homework {
  _id: string
  title: string
  subject: string
  dueDate: string
  description: string
  status: 'Done' | 'Not Done'
  completedBy: Array<{
    username: string
    completedAt: string
  }>
  createdAt: string
}

interface HomeworkModalProps {
  homework: Homework
  onClose: () => void
  onStatusToggle: () => void
  getStatusColor: (homework: Homework) => string
  getUrgencyColor: (dueDate: string) => string
}

export default function HomeworkModal({
  homework,
  onClose,
  onStatusToggle,
  getStatusColor,
  getUrgencyColor
}: HomeworkModalProps) {
  const WINNIPEG_TIMEZONE = 'America/Winnipeg'
  const dueDate = new Date(homework.dueDate)
  const dueDateWinnipeg = utcToZonedTime(dueDate, WINNIPEG_TIMEZONE)
  const nowWinnipeg = utcToZonedTime(new Date(), WINNIPEG_TIMEZONE)
  const isOverdue = dueDateWinnipeg < nowWinnipeg && homework.completedBy.length === 0
  
  const getTimeRemaining = () => {
    const days = differenceInDays(dueDateWinnipeg, nowWinnipeg)
    const hours = differenceInHours(dueDateWinnipeg, nowWinnipeg) % 24
    const minutes = differenceInMinutes(dueDateWinnipeg, nowWinnipeg) % 60
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`
    if (hours > 0) return `${hours}h ${minutes}m`
    if (minutes > 0) return `${minutes}m`
    return 'Due now'
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="bg-dark-card border border-dark-border rounded-xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-white mb-2">{homework.title}</h2>
            <div className="flex items-center text-dark-text-secondary mb-4">
              <BookOpen className="w-5 h-5 mr-2" />
              <span className="text-lg">{homework.subject}</span>
            </div>
          </div>
          
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className="p-2 rounded-full bg-gray-800 hover:bg-gray-700 transition-colors"
          >
            <X className="w-6 h-6 text-gray-400" />
          </motion.button>
        </div>

        <div className="space-y-6">
          {/* Status Section */}
          <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg">
            <div className="flex items-center">
              <CheckCircle className={`w-6 h-6 mr-3 ${getStatusColor(homework)}`} />
              <span className={`text-lg font-medium ${getStatusColor(homework)}`}>
                {homework.completedBy.length > 0 ? 'Done' : 'Not Done'}
              </span>
            </div>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onStatusToggle}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                homework.completedBy.length > 0
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                  : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
              }`}
            >
              Mark as {homework.completedBy.length > 0 ? 'Not Done' : 'Done'}
            </motion.button>
          </div>

          {/* Due Date Section */}
          <div className="p-4 bg-gray-900/50 rounded-lg">
            <div className="flex items-center mb-3">
              <Calendar className="w-5 h-5 mr-2 text-gray-400" />
              <span className="text-lg font-medium text-white">Due Date</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-dark-text-secondary mb-1">Date</p>
                <p className="text-white font-medium">{format(dueDateWinnipeg, 'EEEE, MMMM dd, yyyy')}</p>
              </div>
              
              <div>
                <p className="text-sm text-dark-text-secondary mb-1">Time Remaining</p>
                <p className={`font-medium ${isOverdue ? 'text-red-400' : getUrgencyColor(homework.dueDate)}`}>
                  {isOverdue ? 'Overdue' : getTimeRemaining()}
                </p>
              </div>
            </div>
          </div>

          {/* Description Section */}
          {homework.description && (
            <div className="p-4 bg-gray-900/50 rounded-lg">
              <h3 className="text-lg font-medium text-white mb-3">Description</h3>
              <p className="text-dark-text-secondary leading-relaxed whitespace-pre-wrap">
                {homework.description}
              </p>
            </div>
          )}

          {/* Created Date */}
          <div className="text-sm text-gray-500 text-center">
            Created {formatDistanceToNow(new Date(homework.createdAt), { addSuffix: true })}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
