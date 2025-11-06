import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/lib/auth'
import { ThemeProvider } from '@/lib/theme'
import { AnalyticsProvider } from '@/lib/analytics'
import { CompanyNameProvider } from '@/contexts/CompanyNameContext'
import { NotificationProvider } from '@/contexts/NotificationContext'
import { useToast } from '@/components/Toast'
import { AuthForm } from '@/components/AuthForm'
import { TopNavigation } from '@/components/TopNavigation'
import { Sidebar } from '@/components/Sidebar'
import { Dashboard } from '@/components/Dashboard'
import { Projects } from '@/components/Projects'
import { Settings } from '@/components/Settings'
import { ProfilePage } from '@/components/ProfilePage'
import { NotificationsPage } from '@/components/NotificationsPage'
import { MessagesPage } from '@/components/MessagesPage'
import { Analytics } from '@/components/Analytics'
import { Reports } from '@/components/Reports'
import { GlobalNotifications } from '@/components/GlobalNotifications'
import { Footer } from '@/components/Footer'
import { CheckCircle } from 'lucide-react'
import { useFavicon } from '@/hooks/useFavicon'
import '@/lib/i18n'

// Toast Container Component
function ToastContainerWrapper() {
  const { ToastContainer } = useToast()
  return <ToastContainer />
}

function AppContent() {
  const { user, loading } = useAuth()
  const [sidebarOpen, setSidebarOpen] = React.useState(false)

  // Initialize favicon management
  useFavicon()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="text-gray-600 dark:text-gray-400">Loading...</span>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <AuthForm />
        {/* Footer - visible on login page too */}
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Top Navigation */}
      <TopNavigation onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
      
      {/* Main Layout */}
      <div className="flex h-[calc(100vh-64px)]">
        {/* Sidebar */}
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        
        {/* Backdrop for mobile */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        
        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/projects" element={<Projects onCreateProject={() => {}} />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
      
      {/* Global Notifications - visible from any page */}
      <GlobalNotifications />
      
      {/* Footer - visible on all authenticated pages */}
      <Footer />
    </div>
  )
}

// Placeholder components for sections not yet implemented

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AnalyticsProvider>
          <CompanyNameProvider>
            <NotificationProvider>
              <Router>
                <AppContent />
                <ToastContainerWrapper />
              </Router>
            </NotificationProvider>
          </CompanyNameProvider>
        </AnalyticsProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App