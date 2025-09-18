'use client'

interface LoadingWithTipsProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function LoadingWithTips({
  size = 'md',
  className = ""
}: LoadingWithTipsProps) {
  const sizeClasses = {
    sm: {
      spinner: 'h-8 w-8',
    },
    md: {
      spinner: 'h-12 w-12',
    },
    lg: {
      spinner: 'h-16 w-16',
    }
  }

  const currentSize = sizeClasses[size]

  return (
    <div className={`flex items-center justify-center w-full h-full ${className}`}>
      <div className={`animate-spin rounded-full ${currentSize.spinner} border-t-2 border-b-2 border-primary mx-auto`}></div>
    </div>
  )
}