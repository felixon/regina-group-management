import { useCallback } from 'react'

export interface NotificationOptions {
  type?: 'success' | 'error' | 'info'
  duration?: number
  isNew?: boolean // Mark as new message notification
}

/**
 * Custom hook for managing global notifications
 */
export function useNotifications() {
  const showNotification = useCallback((
    title: string, 
    message: string, 
    options?: NotificationOptions
  ) => {
    const { type = 'info', duration = 5000, isNew = false } = options || {}
    
    window.dispatchEvent(new CustomEvent('showGlobalNotification', {
      detail: { 
        type, 
        title, 
        message, 
        timestamp: Date.now(), 
        duration,
        isNew
      }
    }))
  }, [])

  const success = useCallback((title: string, message: string, duration?: number) => {
    showNotification(title, message, { type: 'success', duration, isNew: false })
  }, [showNotification])

  const error = useCallback((title: string, message: string, duration?: number) => {
    showNotification(title, message, { type: 'error', duration, isNew: false })
  }, [showNotification])

  const info = useCallback((title: string, message: string, duration?: number, isNew = false) => {
    showNotification(title, message, { type: 'info', duration, isNew })
  }, [showNotification])

  // Special method for new message notifications
  const newMessage = useCallback((senderName: string, messagePreview: string) => {
    showNotification('New Message', `${senderName}: ${messagePreview}`, { 
      type: 'info', 
      duration: 5000, 
      isNew: true 
    })
  }, [showNotification])

  return {
    showNotification,
    success,
    error,
    info,
    newMessage
  }
}