'use client'

import { useState, useEffect } from 'react'

interface LoadingWithTipsProps {
  title?: string
  subtitle?: string
  tips?: string[]
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const defaultTips = [
  "💡 Tip: Use the theme toggle in the navigation menu to switch between light and dark modes",
  "🔍 Tip: Click on any job to view detailed menu information and collaborators",
  "👥 Tip: Add collaborators to jobs to work together on menu creation",
  "📋 Tip: Use the admin panel to manage user roles and permissions",
  "🎯 Tip: Transfer job ownership to other users through the actions menu",
  "📊 Tip: Check the logs page to monitor system activity and user actions",
  "🔄 Tip: Your work is automatically saved as you make changes",
  "⚡ Tip: Use keyboard shortcuts to navigate faster through the interface",
  "📱 Tip: The interface is responsive and works great on mobile devices",
  "🎨 Tip: Color-coded badges help identify different users and their roles"
]

export function LoadingWithTips({
  title = "Loading",
  subtitle = "Please wait while we process your request...",
  tips = defaultTips,
  size = 'md',
  className = ""
}: LoadingWithTipsProps) {
  const [currentTipIndex, setCurrentTipIndex] = useState(0)
  const [mounted, setMounted] = useState(false)

  // Rotate tips every 3 seconds
  useEffect(() => {
    setMounted(true)
    const interval = setInterval(() => {
      setCurrentTipIndex((prevIndex) => (prevIndex + 1) % tips.length)
    }, 3000)

    return () => clearInterval(interval)
  }, [tips.length])

  const sizeClasses = {
    sm: {
      spinner: 'h-8 w-8',
      title: 'text-lg',
      subtitle: 'text-sm',
      container: 'max-w-sm'
    },
    md: {
      spinner: 'h-12 w-12',
      title: 'text-2xl',
      subtitle: 'text-base',
      container: 'max-w-md'
    },
    lg: {
      spinner: 'h-16 w-16',
      title: 'text-3xl',
      subtitle: 'text-lg',
      container: 'max-w-lg'
    }
  }

  const currentSize = sizeClasses[size]

  if (!mounted) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <div className={`${currentSize.container} mx-auto text-center`}>
          <div className={`animate-spin rounded-full ${currentSize.spinner} bg-gradient-to-r from-primary via-primary/50 to-transparent mx-auto mb-6`}></div>
          <h1 className={`${currentSize.title} font-bold mb-2 text-foreground`}>{title}</h1>
          <p className="text-muted-foreground">{subtitle}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className={`${currentSize.container} mx-auto text-center`}>
        <div className={`animate-spin rounded-full ${currentSize.spinner} border-b-2 border-primary mx-auto mb-6`}></div>
        <h1 className={`${currentSize.title} font-bold mb-2 text-foreground`}>{title}</h1>
        <p className={`text-muted-foreground mb-8 ${currentSize.subtitle}`}>{subtitle}</p>

        {/* Tips Section */}
        <div className="bg-secondary/50 rounded-lg p-4">
          <div className="min-h-[60px] flex items-center justify-center">
            <p className={`text-muted-foreground ${currentSize.subtitle} transition-opacity duration-500 text-center`}>
              {tips[currentTipIndex]}
            </p>
          </div>

          {/* Tip Progress Dots */}
          <div className="flex justify-center mt-4 space-x-2">
            {tips.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                  index === currentTipIndex ? 'bg-primary' : 'bg-muted'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Additional helpful text */}
        <p className="text-xs text-muted-foreground mt-4 opacity-75">
          Tips rotate every 3 seconds
        </p>
      </div>
    </div>
  )
}