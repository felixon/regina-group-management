import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/lib/auth'
import { useCompanyName } from '@/contexts/CompanyNameContext'
import { useNotificationContext } from '@/contexts/NotificationContext'
import { 
  LayoutDashboard, 
  FolderOpen, 
  BarChart3, 
  FileText, 
  Settings, 
  MessageCircle,
  Bell,
  User,
  X
} from 'lucide-react'
import { Logo } from '@/components/Logo'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { t } = useTranslation()
  const { isAdmin } = useAuth()
  const { companyName } = useCompanyName()
  const { 
    unreadNotificationsCount: notificationCount, 
    unreadMessagesCount: messageCount,
    expiringDomainsCount,
    refreshDomainExpiryData,
    loading 
  } = useNotificationContext()
  const location = useLocation()

  const navigationItems = [
    {
      id: 'dashboard',
      label: t('nav.dashboard'),
      icon: LayoutDashboard,
      path: '/dashboard',
      available: true,
    },
    {
      id: 'projects',
      label: t('nav.projects'),
      icon: FolderOpen,
      path: '/projects',
      available: true,
    },
    {
      id: 'analytics',
      label: t('nav.analytics'),
      icon: BarChart3,
      path: '/analytics',
      available: true,
    },
    {
      id: 'reports',
      label: t('nav.reports'),
      icon: FileText,
      path: '/reports',
      available: true,
    },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: Bell,
      path: '/notifications',
      available: true,
      badge: notificationCount,
    },
    {
      id: 'messages',
      label: 'Messages',
      icon: MessageCircle,
      path: '/messages',
      available: true,
      badge: messageCount,
    },
    {
      id: 'settings',
      label: t('nav.settings'),
      icon: Settings,
      path: '/settings',
      available: isAdmin, // Only available for admins
    },
  ]

  // Company name is now managed by CompanyNameContext
  // Notification counts are now managed by NotificationContext
  
  // Set up manual refresh when sidebar becomes visible
  useEffect(() => {
    if (isOpen && !loading) {
      // Refresh data when sidebar opens if it's been a while
      const lastRefresh = localStorage.getItem('sidebarLastRefresh')
      const now = Date.now()
      
      if (!lastRefresh || (now - parseInt(lastRefresh)) > 60000) { // 1 minute
        refreshDomainExpiryData()
        localStorage.setItem('sidebarLastRefresh', now.toString())
      }
    }
  }, [isOpen, loading, refreshDomainExpiryData])

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return location.pathname === '/' || location.pathname === '/dashboard'
    }
    return location.pathname.startsWith(path)
  }

  return (
    <aside className={`
      fixed lg:relative inset-y-0 left-0 z-30
      w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 
      h-full flex flex-col
      transform transition-transform duration-300 ease-in-out
      ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
    `}>
      {/* Header for mobile - Logo, App Name, and Close button */}
      <div className="lg:hidden flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          <Logo size="sm" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {companyName}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navigationItems.map((item) => {
          if (!item.available) return null
          
          const Icon = item.icon
          const active = isActive(item.path)
          
          return (
            <Link
              key={item.id}
              to={item.path}
              onClick={() => onClose()} // Close sidebar on mobile when link is clicked
              className={`w-full flex items-center justify-between space-x-3 px-4 py-3 text-left rounded-lg transition-colors ${
                active
                  ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`w-5 h-5 ${active ? 'text-blue-600 dark:text-blue-400' : ''}`} />
                <span className="font-medium">{item.label}</span>
              </div>
              
              {item.badge && item.badge > 0 && (
                <span className={`px-2 py-1 text-xs rounded-full ${
                  active 
                    ? 'bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200' 
                    : 'bg-red-500 text-white'
                }`}>
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>


    </aside>
  )
}