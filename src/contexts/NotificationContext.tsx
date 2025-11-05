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
  title?: string  // For backward compatibility
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
    // Note: Removed automatic refresh to prevent unnecessary UI updates
    // Notification data will refresh naturally through other means
  }, [])

  // Listen for save events from other components
  useEffect(() => {
    const handleSaveStart = () => {
      console.log('NotificationContext: Save operation started - temporarily pausing updates')
      setIsSaving(true)
    }
    const handleSaveEnd = () => {
      console.log('NotificationContext: Save operation completed - resuming updates')
      setIsSaving(false)
    }
    // Note: Removed settings-updated event listener to prevent unnecessary refreshes
    // Only handle save operations that are truly in progress

    if (typeof window !== 'undefined') {
      window.addEventListener('save-operation-start', handleSaveStart)
      window.addEventListener('save-operation-end', handleSaveEnd)
      // No longer listening for settings-updated to prevent cascade refreshes
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('save-operation-start', handleSaveStart)
        window.removeEventListener('save-operation-end', handleSaveEnd)
      }
    }
  }, [])

  // Calculate domain expiry data with caching
  const loadDomainExpiryData = useCallback(async () => {
    if (!user) {
      setExpiringDomainsCount(0)
      setExpiringDomainsList([])
      return
    }

    try {
      // Try to load from cache first
      const cachedData = cacheManager.get<any>(CACHE_KEYS.domainExpiry)
      if (cachedData && Date.now() - cachedData.timestamp < 60000) { // 1 minute cache
        console.log('Loading domain expiry data from cache')
        setExpiringDomainsCount(cachedData.count)
        setExpiringDomainsList(cachedData.list)
        return
      }

      // Load from database
      const ninetyDaysFromNow = new Date()
      ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90)
      
      const { data, error, count } = await supabase
        .from('domains')
        .select(`
          id,
          domain_name,
          expiry_date,
          projects!domains_project_id_fkey(name)
        `, { count: 'exact' })
        .not('expiry_date', 'is', null)
        .gte('expiry_date', new Date().toISOString()) // Only include future expiry dates
        .lte('expiry_date', ninetyDaysFromNow.toISOString())
        .order('expiry_date', { ascending: true })

      if (error) {
        console.error('Error loading domain expiry data:', error)
        throw error
      }

      const processed = (data || []).map(domain => {
        const daysUntilExpiry = Math.floor(
          (new Date(domain.expiry_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        )
        return {
          id: domain.id,
          domain_name: domain.domain_name,
          expiry_date: domain.expiry_date,
          project_name: (domain.projects as any)?.name || 'Unknown',
          days_until_expiry: daysUntilExpiry,
        }
      })

      // Cache the result
      cacheManager.set(CACHE_KEYS.domainExpiry, {
        count: count || 0,
        list: processed,
        timestamp: Date.now()
      })

      setExpiringDomainsCount(count || 0)
      setExpiringDomainsList(processed)

      console.log(`Loaded ${processed.length} expiring domains from database (total: ${count || 0})`)

    } catch (error) {
      console.error('Error loading domain expiry data:', error)
      // Set to zero on error to avoid showing stale data
      setExpiringDomainsCount(0)
      setExpiringDomainsList([])
    }
  }, [user])

  // Load comment notifications with caching
  const loadCommentNotifications = useCallback(async () => {
    if (!user) {
      setCommentNotifications([])
      setUnreadCommentCount(0)
      return
    }

    try {
      // Try to load from cache first
      const cachedComments = cacheManager.get<any>(CACHE_KEYS.commentNotifications)
      
      if (cachedComments && Date.now() - cachedComments.timestamp < 60000) { // 1 minute cache
        console.log('Loading comment notifications from cache')
        setCommentNotifications(cachedComments.notifications)
        setUnreadCommentCount(cachedComments.unreadCount)
        return
      }

      // Load from database
      const { data: notifications, error } = await supabase
        .from('notifications')
        .select(`
          id,
          type,
          title,
          content,
          is_read,
          created_at,
          comment_id,
          user_id,
          project_id,
          comments (
            content,
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
          text: notification.content || notification.title || comment?.content || 'New comment',
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

      // Cache the result
      cacheManager.set(CACHE_KEYS.commentNotifications, {
        notifications: processedComments,
        unreadCount,
        timestamp: Date.now()
      })

      setCommentNotifications(processedComments)
      setUnreadCommentCount(unreadCount)

      console.log(`Loaded ${processedComments.length} comment notifications from database`)

    } catch (error) {
      console.error('Error loading comment notifications:', error)
      // Set to defaults on error
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
      // Try to load from cache first
      const cachedCounts = cacheManager.get<any>(CACHE_KEYS.notificationCounts)
      const cachedMessages = cacheManager.get<any>(CACHE_KEYS.messageCounts)
      
      if (cachedCounts && Date.now() - cachedCounts.timestamp < 30000) { // 30 second cache
        setUnreadNotificationsCount(cachedCounts.count)
      } else {
        // Load from database
        const { count: notificationCount } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_read', false)

        cacheManager.set(CACHE_KEYS.notificationCounts, {
          count: notificationCount || 0,
          timestamp: Date.now()
        })

        setUnreadNotificationsCount(notificationCount || 0)
      }

      if (cachedMessages && Date.now() - cachedMessages.timestamp < 5000) { // 5 second cache for messages to prevent flashing
        setUnreadMessagesCount(cachedMessages.count)
      } else {
        // Load from database
        const { count: messageCount } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('recipient_id', user.id)
          .eq('is_read', false)

        cacheManager.set(CACHE_KEYS.messageCounts, {
          count: messageCount || 0,
          timestamp: Date.now()
        })

        setUnreadMessagesCount(messageCount || 0)
      }

    } catch (error) {
      console.error('Error loading notification counts:', error)
      // Set to zero on error
      setUnreadNotificationsCount(0)
      setUnreadMessagesCount(0)
    }
  }, [user])

  // Refresh all data
  const refreshAllData = useCallback(async () => {
    setLoading(true)
    try {
      await Promise.all([
        loadDomainExpiryData(),
        loadNotificationAndMessageCounts(),
        loadCommentNotifications()
      ])
    } finally {
      setLoading(false)
    }
  }, [loadDomainExpiryData, loadNotificationAndMessageCounts, loadCommentNotifications])

  // Refresh only domain expiry data
  const refreshDomainExpiryData = useCallback(async () => {
    await loadDomainExpiryData()
  }, [loadDomainExpiryData])

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
            ? { ...comment } // The notification is now read
            : comment
        )
      )

      // Update unread count
      setUnreadCommentCount(prev => Math.max(0, prev - 1))

      // Clear cache to refresh on next load
      cacheManager.invalidate(CACHE_KEYS.commentNotifications)

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

      // Clear cache to refresh on next load
      cacheManager.invalidate(CACHE_KEYS.commentNotifications)

    } catch (error) {
      console.error('Error clearing all comments:', error)
    }
  }, [user])

  // Clear cache and refresh all data
  const clearCacheAndRefresh = useCallback(async () => {
    // Clear relevant caches
    cacheManager.invalidate(CACHE_KEYS.domainExpiry)
    cacheManager.invalidate(CACHE_KEYS.notificationCounts)
    cacheManager.invalidate(CACHE_KEYS.messageCounts)
    cacheManager.invalidate(CACHE_KEYS.commentNotifications)
    
    await refreshAllData()
  }, [refreshAllData])

  // Initial data load
  useEffect(() => {
    refreshAllData()
  }, [user, refreshAllData])

  // Set up real-time subscriptions
  useEffect(() => {
    if (!user) return

    const setupSubscriptions = async () => {
      // Domain expiry changes
      const domainSubscription = supabase
        .channel('notification-context-domains')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'domains'
        }, (payload) => {
          console.log('Domain change detected in notification context:', payload)
          
          // Skip updates during save operations to prevent conflicts
          if (isSaving) {
            console.log('Skipping domain update during save operation')
            return
          }
          
          // Use debouncing to avoid excessive updates
          const timeoutId = setTimeout(() => {
            console.log('Triggering debounced domain expiry data refresh')
            loadDomainExpiryData()
          }, 1000) // Wait 1 second to batch multiple changes
          
          return () => clearTimeout(timeoutId)
        })
        .subscribe()

      // Notification changes
      const notificationSubscription = supabase
        .channel('notification-context-notifications')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        }, (payload) => {
          console.log('Notification change detected in notification context:', payload)
          // Refresh notification counts
          loadNotificationAndMessageCounts()
        })
        .subscribe()

      // Message changes
      const messageSubscription = supabase
        .channel('notification-context-messages')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${user.id}`
        }, (payload) => {
          console.log('Message change detected in notification context:', payload)
          // Refresh message counts for any message change (new message, read status update, etc.)
          loadNotificationAndMessageCounts()
        })
        .subscribe()

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
          
          // Skip updates during save operations to prevent conflicts
          if (isSaving) {
            console.log('Skipping comment notification update during save operation')
            return
          }
          
          // Only refresh for comment-related notifications
          if (payload.new?.type === 'comment' || payload.old?.type === 'comment' || payload.eventType === 'INSERT') {
            // Use debouncing to avoid excessive updates
            const timeoutId = setTimeout(() => {
              console.log('Triggering debounced comment notification refresh')
              loadCommentNotifications()
            }, 1000) // Wait 1 second to batch multiple changes
            
            return () => clearTimeout(timeoutId)
          }
        })
        .subscribe()

      return () => {
        domainSubscription.unsubscribe()
        notificationSubscription.unsubscribe()
        messageSubscription.unsubscribe()
        commentSubscription.unsubscribe()
      }
    }

    setupSubscriptions()
  }, [user, loadDomainExpiryData, loadNotificationAndMessageCounts, loadCommentNotifications])

  // Listen for cross-component domain update events
  useEffect(() => {
    const handleDomainDataChanged = () => {
      console.log('Domain data changed event received in notification context')
      // Refresh domain expiry data when other components update it
      loadDomainExpiryData()
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('domainDataChanged', handleDomainDataChanged)
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('domainDataChanged', handleDomainDataChanged)
      }
    }
  }, [loadDomainExpiryData])

  const value: NotificationContextType & {
    // Save state management
    isSaving: boolean
    markSaveStart: () => void
    markSaveEnd: () => void
  } = {
    // Domain expiry data
    expiringDomainsCount,
    expiringDomainsList,
    
    // Notification counts
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
    refreshDomainExpiryData,
    refreshNotificationData,
    refreshCommentNotifications,
    clearCacheAndRefresh,
    markCommentAsRead,
    clearAllComments
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}