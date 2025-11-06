import React, { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/lib/auth'
import { useTheme } from '@/lib/theme'
import { useCompanyName } from '@/contexts/CompanyNameContext'
import { useNotificationContext } from '@/contexts/NotificationContext'
import { useNavigate } from 'react-router-dom'
import { Bell, Plus, Globe, Sun, Moon, Monitor, User, LogOut, Settings, ChevronDown, Menu } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { NotificationDropdown } from '@/components/NotificationDropdown'
import { useClickOutside } from '@/hooks/useClickOutside'
import { supabase } from '@/lib/supabase'

export function TopNavigation({ onMenuClick }: { onMenuClick: () => void }) {
  const { t, i18n } = useTranslation()
  const { user, profile, signOut, isAdmin } = useAuth()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const { companyName } = useCompanyName()
  const { unreadNotificationsCount: notificationCount } = useNotificationContext()
  const navigate = useNavigate()
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showLanguageMenu, setShowLanguageMenu] = useState(false)
  const [showThemeMenu, setShowThemeMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  
  // Refs for click outside detection
  const languageMenuRef = useRef<HTMLDivElement>(null)
  const themeMenuRef = useRef<HTMLDivElement>(null)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const notificationRef = useRef<HTMLDivElement>(null)
  
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

  // Close notifications when clicking outside
  useClickOutside(notificationRef, {
    onClickOutside: () => setShowNotifications(false)
  })

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

        {/* Center section: Search and quick actions - hidden on mobile */}
        <div className="hidden md:flex items-center space-x-4 flex-1 max-w-2xl mx-8">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder={t('nav.search')}
              className="w-full px-4 py-2 pl-10 pr-4 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
          
          <button className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Right section: Language, Theme, Notifications, Profile */}
        <div className="flex items-center space-x-2">
          {/* Language Selector - hidden on mobile */}
          <div className="hidden md:block" ref={languageMenuRef}>
            <button
              onClick={() => setShowLanguageMenu(!showLanguageMenu)}
              className="flex items-center space-x-1 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <Globe className="w-4 h-4" />
              <span className="uppercase">{i18n.language}</span>
              <ChevronDown className="w-4 h-4" />
            </button>
            
            {showLanguageMenu && (
              <div className="absolute right-0 mt-2 w-32 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                <div className="py-1">
                  {['en', 'fr', 'es'].map((lang) => (
                    <button
                      key={lang}
                      onClick={() => handleLanguageChange(lang)}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                        i18n.language === lang ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <span className="uppercase">{lang}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Theme Selector - hidden on mobile */}
          <div className="hidden md:block" ref={themeMenuRef}>
            <button
              onClick={() => setShowThemeMenu(!showThemeMenu)}
              className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              {React.createElement(themeIcon, { className: 'w-5 h-5' })}
            </button>
            
            {showThemeMenu && (
              <div className="absolute right-16 mt-2 w-36 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                <div className="py-1">
                  {[
                    { value: 'light', label: 'Light', icon: Sun },
                    { value: 'dark', label: 'Dark', icon: Moon },
                    { value: 'system', label: 'System', icon: Monitor },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleThemeChange(option.value as any)}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2 ${
                        theme === option.value ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {React.createElement(option.icon, { className: 'w-4 h-4' })}
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Notifications */}
          <div className="relative" ref={notificationRef}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <Bell className="w-5 h-5" />
              {notificationCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {notificationCount > 99 ? '99+' : notificationCount}
                </span>
              )}
            </button>
            
            <NotificationDropdown 
              isOpen={showNotifications} 
              onClose={() => setShowNotifications(false)} 
            />
          </div>

          {/* Profile Menu */}
          <div className="relative" ref={profileMenuRef}>
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center space-x-2 p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Profile" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <User className="w-4 h-4 text-white" />
                )}
              </div>
              {/* Username - hidden on mobile, still shows in dropdown */}
              <span className="hidden md:block text-sm font-medium">{profile?.full_name || user?.email}</span>
              <ChevronDown className="w-4 h-4 hidden md:block" />
            </button>
            
            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                <div className="py-1">
                  <button
                    onClick={() => {
                      navigate('/profile')
                      setShowProfileMenu(false)
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
                  >
                    <User className="w-4 h-4" />
                    <span>{t('nav.profile')}</span>
                  </button>
                  
                  {isAdmin && (
                    <button
                      onClick={() => {
                        navigate('/settings')
                        setShowProfileMenu(false)
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
                    >
                      <Settings className="w-4 h-4" />
                      <span>{t('nav.settings')}</span>
                    </button>
                  )}
                  
                  <hr className="my-1 border-gray-200 dark:border-gray-700" />
                  
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center space-x-2"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>{t('auth.signOut')}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}