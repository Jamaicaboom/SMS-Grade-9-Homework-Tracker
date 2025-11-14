'use client'

import { motion } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'

interface HeaderProps {
  onContactClick?: () => void
}

export default function Header({ onContactClick }: HeaderProps) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-dark-card border-b border-dark-border"
    >
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="flex items-center">
              {/* SMS Logo */}
              <img 
                src="/sms_logo.svg" 
                alt="SMS Logo" 
                className="w-12 h-12 mr-4"
              />
              <div>
                <h1 className="text-3xl font-bold text-white">Homework Tracker</h1>
                <p className="text-dark-text-secondary mt-1">
                  Stay organized with your assignments
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 md:space-x-4">
            <button
              onClick={onContactClick}
              className="px-3 py-2 md:px-4 md:py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors duration-200 text-xs md:text-sm font-medium"
            >
              Contact Us
            </button>
            <div className="hidden md:block text-right">
              <p className="text-sm text-dark-text-secondary">Auto-refresh</p>
              <p className="text-xs text-gray-500">Every 60 seconds</p>
            </div>
            <div className="hidden md:block w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
          </div>
        </div>
      </div>
    </motion.header>
  )
}
