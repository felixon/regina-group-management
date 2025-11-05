import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/lib/auth'
import { useNotificationContext } from '@/contexts/NotificationContext'
import { supabase } from '@/lib/supabase'
import { useNavigate } from 'react-router-dom'
import { cacheManager } from '@/lib/cache-manager'
import { 
  Bell, 
  MessageSquare, 
  FolderOpen, 
  Calendar,
  AlertTriangle,
  Check,
  Trash2,
  MoreHorizontal,
  CheckCheck
} from 'lucide-react'
import { format, parseISO } from 'date-fns'

interface Notification {
  id: string
  user_id: string
  type: 'comment' | 'domain_expiry' | 'project_change'
  title: string
  content: string
  link?: string
  is_read: boolean
  created_at: string
  project_id?: string
  comment_id?: string
}

interface ExtendedNotification extends Notification {
  _sortDate?: number
  _daysRemaining?: number
}

interface NotificationDropdownProps {
  isOpen: boolean
  onClose: () => void
}

export function NotificationDropdown({ isOpen, onClose }: NotificationDropdownProps) {
  const { user } = useAuth()
  const { refreshNotificationData } = useNotificationContext()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      loadNotifications()
    }
  }, [isOpen, user])

  // Set up real-time subscriptions for notifications
  useEffect(() => {
    if (!user) return

    // Set up real-time subscription for notifications
    const notificationSubscription = supabase
      .channel('notifications-dropdown')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        console.log('Notification change in dropdown:', payload)
        if (isOpen) {
          // Only refresh if dropdown is open to avoid unnecessary updates
          refreshNotificationData()
          loadNotifications()
        }
      })
      .subscribe()

    return () => {
      notificationSubscription.unsubscribe()
    }
  }, [user, isOpen, refreshNotificationData])

  useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  const loadNotifications = async () => {
    if (!user) return

    try {
      setLoading(true)
      
      // Load notifications
      const { data, error, count } = await supabase
        .from('notifications')
        .select(`
          id,
          user_id,
          type,
          title,
          content,
          link,
          is_read,
          created_at,
          project_id,
          comment_id
        `, { count: 'exact' })
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) {
        console.error('Error loading notifications:', error)
        return
      }

      // Sort notifications with comment priority
      const sortedNotifications = (data || []).sort((a, b) => {
        // Comments always go first (highest priority)
        if (a.type === 'comment' && b.type !== 'comment') return -1
        if (a.type !== 'comment' && b.type === 'comment') return 1
        
        // Other notification types by created_at
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })

      setNotifications(sortedNotifications)
      setTotalCount(count || 0)
    } catch (error) {
      console.error('Error loading notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('user_id', user?.id)

      if (error) throw error

      setNotifications(prev => 
        prev.map(notification => 
          notification.id === notificationId 
            ? { ...notification, is_read: true }
            : notification
        )
      )
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const deleteNotification = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', user?.id)

      if (error) throw error

      setNotifications(prev => 
        prev.filter(notification => notification.id !== notificationId)
      )
      setTotalCount(prev => prev - 1)
    } catch (error) {
      console.error('Error deleting notification:', error)
    }
  }

  const dismissAll = async () => {
    if (!user) return

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false)

      if (error) throw error

      setNotifications(prev => 
        prev.map(notification => ({ ...notification, is_read: true }))
      )
    } catch (error) {
      console.error('Error dismissing all notifications:', error)
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'comment':
        return <MessageSquare className="w-4 h-4 text-green-600" />
      case 'domain_expiry':
        return <AlertTriangle className="w-4 h-4 text-orange-600" />
      case 'project_change':
        return <FolderOpen className="w-4 h-4 text-blue-600" />
      default:
        return <Bell className="w-4 h-4 text-gray-600" />
    }
  }

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      markAsRead(notification.id)
    }
    
    if (notification.link) {
      navigate(notification.link)
      onClose()
    }
  }

  const unreadCount = notifications.filter(n => !n.is_read).length

  if (!isOpen) return null

  return (
    <div 
      ref={dropdownRef}
      className="absolute left-1/2 -translate-x-1/2 md:left-auto md:right-0 md:translate-x-0 mt-2 w-[90vw] max-w-md md:w-[32rem] bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 max-h-96 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          <Bell className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Notifications
          </h3>
          {totalCount > 0 && (
            <span className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 rounded-full">
              {totalCount}
            </span>
          )}
        </div>
        
        {totalCount > 10 && (
          <button
            onClick={() => {
              navigate('/notifications')
              onClose()
            }}
            className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-md transition-colors"
          >
            View All
          </button>
        )}
      </div>

      {/* Actions */}
      {unreadCount > 0 && (
        <div className="p-3 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={dismissAll}
            className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            <CheckCheck className="w-4 h-4" />
            <span>Mark all as read</span>
          </button>
        </div>
      )}

      {/* Notifications List */}
      <div className="max-h-80 overflow-y-auto">
        {loading ? (
          <div className="p-6 text-center text-gray-500 dark:text-gray-400">
            Loading notifications...
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-6 text-center text-gray-500 dark:text-gray-400">
            <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No notifications</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors relative group ${
                  !notification.is_read ? 'bg-blue-50 dark:bg-blue-900/10' : ''
                }`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-1">
                    {getNotificationIcon(notification.type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${
                      notification.is_read 
                        ? 'text-gray-600 dark:text-gray-400' 
                        : 'text-gray-900 dark:text-white font-medium'
                    }`}>
                      {notification.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 line-clamp-2">
                      {notification.content}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {format(parseISO(notification.created_at), 'MMM dd, HH:mm')}
                    </p>
                  </div>

                  {/* Unread indicator */}
                  {!notification.is_read && (
                    <div className="flex-shrink-0 w-2 h-2 bg-blue-600 rounded-full mt-1"></div>
                  )}

                  {/* Delete button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteNotification(notification.id)
                    }}
                    className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-all"
                    title="Delete notification"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Load more */}
      {totalCount > 10 && notifications.length < totalCount && (
        <div className="p-3 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => {
              navigate('/notifications')
              onClose()
            }}
            className="w-full text-center text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-md py-2 transition-colors"
          >
            View All ({totalCount - notifications.length} more)
          </button>
        </div>
      )}
    </div>
  )
}