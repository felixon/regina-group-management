import React, { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/lib/auth'
import { useTheme } from '@/lib/theme'
import { useCompanyName } from '@/contexts/CompanyNameContext'
import { useNotificationContext } from '@/contexts/NotificationContext'
import { useNavigate } from 'react-router-dom'
import { Bell, Plus, Globe, Sun, Moon, Monitor, User, LogOut, Settings, ChevronDown, Menu, AlertTriangle } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { NotificationDropdown } from '@/components/NotificationDropdown'
import { DomainExpiryNotification } from '@/components/DomainExpiryNotification'
import { useClickOutside } from '@/hooks/useClickOutside'
import { supabase } from '@/lib/supabase'

export function TopNavigation({ onMenuClick }: { onMenuClick: () => void }) {
  const { t, i18n } = useTranslation()
  const { user, profile, signOut, isAdmin } = useAuth()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const { companyName } = useCompanyName()
  const { unreadNotificationsCount: notificationCount, expiringDomainsCount } = useNotificationContext()
  const navigate = useNavigate()
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showLanguageMenu, setShowLanguageMenu] = useState(false)
  const [showThemeMenu, setShowThemeMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showDomainExpiryNotifications, setShowDomainExpiryNotifications] = useState(false)
  
  // Refs for click outside detection
  const languageMenuRef = useRef<HTMLDivElement>(null)
  const themeMenuRef = useRef<HTMLDivElement>(null)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const notificationRef = useRef<HTMLDivElement>(null)
  const domainExpiryNotificationRef = useRef<HTMLDivElement>(null)
  
  // Click outside handlers
  useClickOutside(languageMenuRef, {
    onClickOutside: () => setShowLanguageMenu(false)
  })
  
  useClickOutside(themeMenuRef, {
    onClickOutside: () => setShowThemeMenu(false)
  })
  
  useClickOutside(profileMenuRef, {
    onClickOutside: () => setShowProfileMenu(false)
  })

  const handleLanguageChange = (language: string) => {
    i18n.changeLanguage(language)
    setShowLanguageMenu(false)
  }

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme)
    setShowThemeMenu(false)
  }

  const handleSignOut = async () => {
    await signOut()
    setShowProfileMenu(false)
  }

  const themeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor

  const handleClickOutside = (ref: React.RefObject<HTMLDivElement>, handler: () => void) => {
    useClickOutside(ref, { onClickOutside: handler })
  }

  // Close notifications when clicking outside
  useClickOutside(notificationRef, {
    onClickOutside: () => setShowNotifications(false)
  })

  useClickOutside(domainExpiryNotificationRef, {
    onClickOutside: () => setShowDomainExpiryNotifications(false)
  })

  // Company name is now managed by CompanyNameContext
  // Notification counts are now managed by NotificationContext

  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Left section: Menu button (mobile), Logo and title */}
        <div className="flex items-center space-x-4">
          {/* Hamburger menu for mobile */}
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Toggle menu"
          >
            <Menu className="w-6 h-6" />
          </button>
          
          {/* Logo and title - hidden on mobile, shown on desktop */}
          <div className="hidden lg:flex items-center space-x-2">
            <Logo size="sm" />
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              {companyName}
            </h1>
          </div>
        </div>

        {/* Right section: Actions and user menu */}
        <div className="flex items-center space-x-4">
          {/* Domain Expiry Notifications */}
          <div className="relative" ref={domainExpiryNotificationRef}>
            <button
              onClick={() => setShowDomainExpiryNotifications(!showDomainExpiryNotifications)}
              className="relative p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="Domain Expiry Alerts"
            >
              <AlertTriangle className="w-5 h-5" />
              {/* Domain expiry badge with count */}
              {expiringDomainsCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-orange-500 text-white text-xs rounded-full flex items-center justify-center font-semibold">
                  {expiringDomainsCount > 99 ? '99+' : expiringDomainsCount}
                </span>
              )}
            </button>
            
            {/* Domain Expiry Notification Dropdown */}
            <DomainExpiryNotification 
              isOpen={showDomainExpiryNotifications}
              onClose={() => setShowDomainExpiryNotifications(false)}
            />
          </div>

          {/* General Notifications */}
          <div className="relative" ref={notificationRef}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title={t('nav.notifications')}
            >
              <Bell className="w-5 h-5" />
              {/* Notification badge with count */}
              {notificationCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-semibold">
                  {notificationCount > 99 ? '99+' : notificationCount}
                </span>
              )}
            </button>
            
            {/* Notification Dropdown */}
            <NotificationDropdown 
              isOpen={showNotifications}
              onClose={() => setShowNotifications(false)}
            />
          </div>

          {/* Language Selector */}
          <div className="relative" ref={languageMenuRef}>
            <button
              onClick={() => setShowLanguageMenu(!showLanguageMenu)}
              className="flex items-center space-x-1 p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <Globe className="w-5 h-5" />
              <ChevronDown className="w-3 h-3" />
            </button>
            
            {showLanguageMenu && (
              <div className="absolute right-0 mt-2 w-32 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                <button
                  onClick={() => handleLanguageChange('en')}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 first:rounded-t-lg ${
                    i18n.language === 'en' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {t('language.english')}
                </button>
                <button
                  onClick={() => handleLanguageChange('fr')}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 last:rounded-b-lg ${
                    i18n.language === 'fr' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {t('language.french')}
                </button>
              </div>
            )}
          </div>

          {/* Theme Toggle */}
          <div className="relative" ref={themeMenuRef}>
            <button
              onClick={() => setShowThemeMenu(!showThemeMenu)}
              className="flex items-center space-x-1 p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              {React.createElement(themeIcon, { className: "w-5 h-5" })}
              <ChevronDown className="w-3 h-3" />
            </button>
            
            {showThemeMenu && (
              <div className="absolute right-0 mt-2 w-36 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                <button
                  onClick={() => handleThemeChange('light')}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 first:rounded-t-lg flex items-center space-x-2 ${
                    theme === 'light' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <Sun className="w-4 h-4" />
                  <span>{t('theme.light')}</span>
                </button>
                <button
                  onClick={() => handleThemeChange('dark')}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2 ${
                    theme === 'dark' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <Moon className="w-4 h-4" />
                  <span>{t('theme.dark')}</span>
                </button>
                <button
                  onClick={() => handleThemeChange('system')}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 last:rounded-b-lg flex items-center space-x-2 ${
                    theme === 'system' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <Monitor className="w-4 h-4" />
                  <span>{t('theme.system')}</span>
                </button>
              </div>
            )}
          </div>

          {/* User Profile Menu */}
          {user && (
            <div className="relative" ref={profileMenuRef}>
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center space-x-2 p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt={profile.full_name} className="w-8 h-8 rounded-full" />
                  ) : (
                    <User className="w-4 h-4" />
                  )}
                </div>
                {/* Hide username on mobile, show on desktop */}
                <span className="hidden md:block text-sm font-medium">{profile?.full_name || user.email}</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                  <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {profile?.full_name || user.email}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {t(`role.${profile?.role || 'collaborator'}`)}
                    </p>
                  </div>
                  
                  <button
                    onClick={() => {
                      navigate('/profile')
                      setShowProfileMenu(false)
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
                  >
                    <Settings className="w-4 h-4" />
                    <span>{t('nav.profile')}</span>
                  </button>
                  
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 last:rounded-b-lg flex items-center space-x-2"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>{t('nav.logout')}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}

// Close dropdowns when clicking outside
if (typeof window !== 'undefined') {
  document.addEventListener('click', (e) => {
    const target = e.target as Element
    if (!target.closest('[data-dropdown]')) {
      // Close all dropdowns
      // This would be handled by state management in a real app
    }
  })
}