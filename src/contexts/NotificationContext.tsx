import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { cacheManager } from '@/lib/cache-manager'

interface CommentNotification {
  id: string
  text: string
  user: string
  userId: string
  projectId: string
  projectName: string
  timestamp: string
  type: 'comment'
}

interface NotificationContextType {
  // Domain expiry notification counts
  expiringDomainsCount: number
  expiringDomainsList: Array<{
    id: string
    domain_name: string
    expiry_date: string
    project_name: string
    days_until_expiry: number
  }>
  
  // General notification counts
  unreadNotificationsCount: number
  unreadMessagesCount: number
  
  // Comment notifications
  commentNotifications: CommentNotification[]
  unreadCommentCount: number
  
  // Loading states
  loading: boolean
  
  // Actions
  refreshAllData: () => Promise<void>
  refreshDomainExpiryData: () => Promise<void>
  refreshNotificationData: () => Promise<void>
  refreshCommentNotifications: () => Promise<void>
  clearCacheAndRefresh: () => Promise<void>
  isSaving: boolean
  markSaveStart: () => void
  markSaveEnd: () => void
  markCommentAsRead: (commentId: string) => Promise<void>
  clearAllComments: () => Promise<void>
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function useNotificationContext() {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error('useNotificationContext must be used within a NotificationProvider')
  }
  return context
}

interface NotificationProviderProps {
  children: React.ReactNode
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const { user } = useAuth()
  
  // State
  const [expiringDomainsCount, setExpiringDomainsCount] = useState(0)
  const [expiringDomainsList, setExpiringDomainsList] = useState<Array<{
    id: string
    domain_name: string
    expiry_date: string
    project_name: string
    days_until_expiry: number
  }>>([])
  
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0)
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0)
  const [commentNotifications, setCommentNotifications] = useState<CommentNotification[]>([])
  const [unreadCommentCount, setUnreadCommentCount] = useState(0)
  const [loading, setLoading] = useState(false)
  
  // Save state management to prevent conflicts during save operations
  const [isSaving, setIsSaving] = useState(false)

  // Cache keys
  const CACHE_KEYS = {
    domainExpiry: 'notification-domain-expiry',
    notificationCounts: 'notification-counts',
    messageCounts: 'message-counts',
    commentNotifications: 'comment-notifications'
  }

  // Save state management functions
  const markSaveStart = useCallback(() => {
    console.log('NotificationContext: Save operation started')
    setIsSaving(true)
  }, [])

  const markSaveEnd = useCallback(() => {
    console.log('NotificationContext: Save operation completed')
    setIsSaving(false)
  }, [])

  // Listen for save events from other components
  useEffect(() => {
    const handleSaveStart = () => {
      setIsSaving(true)
    }
    const handleSaveEnd = () => {
      setIsSaving(false)
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('save-operation-start', handleSaveStart)
      window.addEventListener('save-operation-end', handleSaveEnd)
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('save-operation-start', handleSaveStart)
        window.removeEventListener('save-operation-end', handleSaveEnd)
      }
    }
  }, [])

  // Load comment notifications with caching
  const loadCommentNotifications = useCallback(async () => {
    if (!user) {
      setCommentNotifications([])
      setUnreadCommentCount(0)
      return
    }

    try {
      // Load from database
      const { data: notifications, error } = await supabase
        .from('notifications')
        .select(`
          id,
          type,
          text,
          is_read,
          created_at,
          comment_id,
          user_id,
          project_id,
          comments (
            text,
            user_id,
            project_id
          ),
          profiles!notifications_user_id_fkey (
            full_name,
            email
          ),
          projects!notifications_project_id_fkey (
            name
          )
        `)
        .eq('user_id', user.id)
        .eq('type', 'comment')
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        console.error('Error loading comment notifications:', error)
        throw error
      }

      const processedComments: CommentNotification[] = (notifications || []).map(notification => {
        const comment = notification.comments as any
        const author = notification.profiles as any
        const project = notification.projects as any
        
        return {
          id: notification.id,
          text: notification.text || comment?.text || 'New comment',
          user: author?.full_name || author?.email || 'Unknown User',
          userId: notification.user_id || comment?.user_id || '',
          projectId: notification.project_id || comment?.project_id || '',
          projectName: project?.name || 'Unknown Project',
          timestamp: notification.created_at,
          type: 'comment' as const
        }
      })

      const unreadCount = processedComments.filter(comment => 
        !notifications?.find(n => n.id === comment.id)?.is_read
      ).length

      setCommentNotifications(processedComments)
      setUnreadCommentCount(unreadCount)

      console.log(`Loaded ${processedComments.length} comment notifications from database`)

    } catch (error) {
      console.error('Error loading comment notifications:', error)
      setCommentNotifications([])
      setUnreadCommentCount(0)
    }
  }, [user])

  // Load notification and message counts with caching
  const loadNotificationAndMessageCounts = useCallback(async () => {
    if (!user) {
      setUnreadNotificationsCount(0)
      setUnreadMessagesCount(0)
      return
    }

    try {
      // Load notification counts
      const { count: notificationCount } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false)

      setUnreadNotificationsCount(notificationCount || 0)

      // Load message counts
      const { count: messageCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', user.id)
        .eq('is_read', false)

      setUnreadMessagesCount(messageCount || 0)

    } catch (error) {
      console.error('Error loading notification counts:', error)
      setUnreadNotificationsCount(0)
      setUnreadMessagesCount(0)
    }
  }, [user])

  // Refresh all data
  const refreshAllData = useCallback(async () => {
    setLoading(true)
    try {
      await Promise.all([
        loadNotificationAndMessageCounts(),
        loadCommentNotifications()
      ])
    } finally {
      setLoading(false)
    }
  }, [loadNotificationAndMessageCounts, loadCommentNotifications])

  // Refresh only notification data
  const refreshNotificationData = useCallback(async () => {
    await loadNotificationAndMessageCounts()
  }, [loadNotificationAndMessageCounts])

  // Refresh comment notifications
  const refreshCommentNotifications = useCallback(async () => {
    await loadCommentNotifications()
  }, [loadCommentNotifications])

  // Mark comment as read
  const markCommentAsRead = useCallback(async (commentId: string) => {
    if (!user) return

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', commentId)
        .eq('user_id', user.id)

      if (error) {
        console.error('Error marking comment as read:', error)
        throw error
      }

      // Update local state
      setCommentNotifications(prev => 
        prev.map(comment => 
          comment.id === commentId 
            ? { ...comment }
            : comment
        )
      )

      // Update unread count
      setUnreadCommentCount(prev => Math.max(0, prev - 1))

    } catch (error) {
      console.error('Error marking comment as read:', error)
    }
  }, [user])

  // Clear all comments
  const clearAllComments = useCallback(async () => {
    if (!user) return

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('type', 'comment')

      if (error) {
        console.error('Error clearing all comments:', error)
        throw error
      }

      // Update local state
      setCommentNotifications(prev => 
        prev.map(comment => ({ ...comment }))
      )

      // Update unread count
      setUnreadCommentCount(0)

    } catch (error) {
      console.error('Error clearing all comments:', error)
    }
  }, [user])

  // Initial data load
  useEffect(() => {
    refreshAllData()
  }, [user, refreshAllData])

  // Set up real-time subscriptions
  useEffect(() => {
    if (!user) return

    // Comment notification changes
    const commentSubscription = supabase
      .channel('notification-context-comments')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        console.log('Comment notification change detected:', payload)
        
        // Skip updates during save operations
        if (isSaving) {
          console.log('Skipping comment notification update during save operation')
          return
        }
        
        // Only refresh for comment-related notifications
        if (payload.new?.type === 'comment' || payload.old?.type === 'comment' || payload.eventType === 'INSERT') {
          const timeoutId = setTimeout(() => {
            console.log('Triggering debounced comment notification refresh')
            loadCommentNotifications()
          }, 1000)
          
          return () => clearTimeout(timeoutId)
        }
      })
      .subscribe()

    return () => {
      commentSubscription.unsubscribe()
    }
  }, [user, loadCommentNotifications, isSaving])

  const value: NotificationContextType = {
    // Notification counts
    expiringDomainsCount: 0,
    expiringDomainsList: [],
    unreadNotificationsCount,
    unreadMessagesCount,
    
    // Comment notifications
    commentNotifications,
    unreadCommentCount,
    
    // Loading state
    loading,
    
    // Save state management
    isSaving,
    markSaveStart,
    markSaveEnd,
    
    // Actions
    refreshAllData,
    refreshDomainExpiryData: async () => {},
    refreshNotificationData,
    refreshCommentNotifications,
    clearCacheAndRefresh: refreshAllData,
    markCommentAsRead,
    clearAllComments
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}