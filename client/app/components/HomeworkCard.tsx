'use client'

import { motion } from 'framer-motion'
import { formatDistanceToNow, format } from 'date-fns'
import { utcToZonedTime } from 'date-fns-tz'
import { CheckCircle, Clock, BookOpen } from 'lucide-react'

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

interface HomeworkCardProps {
  homework: Homework
  onClick: () => void
  onStatusToggle: () => void
  getStatusColor: (homework: Homework) => string
  getUrgencyColor: (dueDate: string) => string
  getPersonalStatus: (homework: Homework) => string
  username: string
}

export default function HomeworkCard({
  homework,
  onClick,
  onStatusToggle,
  getStatusColor,
  getUrgencyColor,
  getPersonalStatus,
  username
}: HomeworkCardProps) {
  const WINNIPEG_TIMEZONE = 'America/Winnipeg'
  const dueDate = new Date(homework.dueDate)
  const dueDateWinnipeg = utcToZonedTime(dueDate, WINNIPEG_TIMEZONE)
  const nowWinnipeg = utcToZonedTime(new Date(), WINNIPEG_TIMEZONE)
  const isOverdue = dueDateWinnipeg < nowWinnipeg && homework.status === 'Not Done'
  const isPersonallyCompleted = homework.completedBy.some(completion => completion.username === username)
  
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="card cursor-pointer group"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-gray-200 transition-colors">
            {homework.title}
          </h3>
          <div className="flex items-center text-sm text-dark-text-secondary mb-2">
            <BookOpen className="w-4 h-4 mr-2" />
            {homework.subject}
          </div>
        </div>
        
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={(e) => {
            e.stopPropagation()
            onStatusToggle()
          }}
          className={`p-2 rounded-full transition-colors ${
            isPersonallyCompleted
              ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
              : 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
          }`}
        >
          <CheckCircle className="w-5 h-5" />
        </motion.button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center text-sm">
          <Clock className="w-4 h-4 mr-2 text-gray-500" />
          <span className={getUrgencyColor(homework.dueDate)}>
            {isOverdue ? 'Overdue' : `Due ${formatDistanceToNow(dueDateWinnipeg, { addSuffix: true })}`}
          </span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className={`text-sm font-medium ${getStatusColor(homework)}`}>
            {getPersonalStatus(homework)}
          </span>
          <span className="text-xs text-gray-500">
            {format(dueDateWinnipeg, 'MMM dd, yyyy')}
          </span>
        </div>
      </div>

      {homework.description && (
        <div className="mt-3 pt-3 border-t border-dark-border">
          <p className="text-sm text-dark-text-secondary line-clamp-2">
            {homework.description}
          </p>
        </div>
      )}
    </motion.div>
  )
}
