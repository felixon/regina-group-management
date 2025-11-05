import React, { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { cacheManager } from '@/lib/cache-manager'

interface Profile {
  id: string
  email: string
  full_name?: string
  role?: 'super_admin' | 'collaborator'
  active?: boolean
  avatar_url?: string
  is_online?: boolean
  last_seen?: string
  created_at?: string
  updated_at?: string
}

interface AuthContextType {
  user: User | null
  profile: Profile | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: any }>
  signOut: () => Promise<void>
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: any }>
  isAdmin: boolean
  isCollaborator: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function getInitialSession() {
      setLoading(true)
      try {
        console.log('Initializing auth session...')
        
        // Optimized timeout - reduced to 3 seconds for better UX
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Auth initialization timeout')), 3000)
        })
        
        const authPromise = async () => {
          const { data: { session }, error } = await supabase.auth.getSession()
          if (error) {
            console.error('Error getting session:', error)
            setSession(session)
            setUser(session?.user || null)
            setLoading(false)
            return
          } else {
            setSession(session)
            setUser(session?.user || null)
            
            // Load profile asynchronously with smart caching
            if (session?.user) {
              // Use cache-first approach with background refresh
              loadProfileWithCache(session.user.id).catch(error => {
                console.error('Profile loading failed:', error)
                // Don't block UI for profile loading failures
              })
              // Update online status when logging in
              updateUserOnlineStatus(session.user.id, true)
            }
          }
        }
        
        await Promise.race([authPromise(), timeoutPromise])
      } catch (error) {
        console.error('Error initializing auth:', error)
        // Always stop loading even on auth errors to prevent infinite loading states
      } finally {
        setLoading(false)
      }
    }

    getInitialSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        console.log('Auth state changed:', _event)
        setSession(session)
        setUser(session?.user || null)
        
        if (session?.user) {
          // Use cache-first profile loading for better performance
          loadProfileWithCache(session.user.id).catch(error => {
            console.error('Profile loading failed after auth change:', error)
          })
          // Update online status when auth state changes to logged in
          updateUserOnlineStatus(session.user.id, true)
        } else {
          setProfile(null)
        }
        setLoading(false)
      }
    )

    // Add visibility change listener to verify session when tab becomes visible
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        console.log('👁️ [VISIBILITY] Tab became visible, verifying session...')
        
        // Use a shorter timeout for visibility checks - 2 seconds max
        const visibilityTimeout = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Visibility check timeout')), 2000)
        })
        
        const visibilityCheck = async () => {
          try {
            const { data: { session }, error } = await supabase.auth.getSession()
            if (error) {
              console.error('Error verifying session:', error)
              return
            }
            
            if (session && user) {
              // Update session data quickly
              setSession(session)
              setUser(session.user)
              
              // Ensure online status is maintained when tab becomes visible again
              updateUserOnlineStatus(session.user.id, true)
              
              // Smart cache check - only reload if cache is expired or missing
              const cachedProfile = cacheManager.get('profile') as Profile | null
              const cacheAge = cacheManager.getAge('profile')
              const cacheExpired = !cachedProfile || 
                                 cachedProfile.id !== session.user.id || 
                                 cacheAge === null || 
                                 cacheAge > 15 * 60 * 1000 // 15 minutes max
              
              if (cacheExpired) {
                // Load profile in background with optimized timeout
                loadProfileWithCache(session.user.id).catch(error => {
                  console.error('Profile refresh failed during visibility check:', error)
                  // Don't block UI for profile refresh failures
                })
              }
            } else if (!session && user) {
              // Session lost, clear user state
              console.log('⚠️ [VISIBILITY] Session lost, logging out...')
              setSession(null)
              setUser(null)
              setProfile(null)
              // Clear profile cache
              cacheManager.invalidate('profile')
            }
          } catch (error) {
            console.error('Error in visibility change handler:', error)
            // Don't throw - visibility changes should be non-blocking
          }
        }
        
        // Race against timeout to prevent hanging
        Promise.race([visibilityCheck(), visibilityTimeout]).catch(error => {
          console.log('Visibility check failed or timed out:', error.message)
        })
      } else if (document.visibilityState === 'hidden') {
        console.log('👁️ [VISIBILITY] Tab became hidden - NOT changing online status (should persist)')
        // Do NOT change online status when tab becomes hidden - status should persist
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  // Enhanced profile loading with smart caching and optimized timeouts
  async function loadProfileWithCache(userId: string, retryCount = 0): Promise<void> {
    const maxRetries = 2 // Reduced from 3 for faster failure
    const baseTimeout = 4000 // Reduced to 4 seconds for better UX
    const retryDelay = Math.min(500 * Math.pow(2, retryCount), 2000) // Faster backoff, max 2s
    
    try {
      // Smart cache check first
      const cachedProfile = cacheManager.get('profile') as Profile | null
      const cacheAge = cacheManager.getAge('profile')
      const isCacheValid = cachedProfile && 
                          cachedProfile.id === userId && 
                          cacheAge !== null && 
                          cacheAge < 10 * 60 * 1000 // 10 minutes max
      
      if (isCacheValid) {
        console.log('Loading profile from cache (age:', Math.round((cacheAge || 0) / 60000), 'min)')
        setProfile(cachedProfile)
        return
      }
      
      // AbortController for timeout management
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), baseTimeout)
      
      try {
        // Optimized profile query - select only needed fields
        const { data, error } = await supabase
          .from('profiles')
          .select('id, email, full_name, role, active, avatar_url, is_online, last_seen, created_at, updated_at')
          .eq('id', userId)
          .maybeSingle()

        clearTimeout(timeoutId)
        
        if (error) {
          console.error('Error loading profile:', error)
          
          // Handle specific error cases with better error messages
          if (error.code === 'PGRST116') {
            throw new Error('Profile not found - please contact support')
          }
          
          if (error.code === 'PGRST301') {
            throw new Error('Unable to connect to database')
          }
          
          if (error.code === '42501') {
            throw new Error('Insufficient permissions to load profile')
          }
          
          throw error
        } else if (data) {
          // Cache the profile for 30 minutes
          cacheManager.set('profile', data)
          setProfile(data)
          console.log('Profile loaded and cached successfully')
        } else {
          throw new Error('No profile data received')
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId)
        
        if (fetchError.name === 'AbortError') {
          throw new Error('Profile load timeout')
        }
        throw fetchError
      }
    } catch (error: any) {
      console.error(`Profile loading failed (attempt ${retryCount + 1}):`, error)
      
      // Smart retry logic for transient errors only
      const isTransientError = 
        error.message.includes('timeout') || 
        error.message.includes('connection') ||
        error.message.includes('fetch') ||
        error.message.includes('network')
      
      if (retryCount < maxRetries && isTransientError) {
        console.log(`Retrying profile load in ${retryDelay}ms...`)
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        return loadProfileWithCache(userId, retryCount + 1)
      }
      
      // If cache exists, use it as fallback instead of failing completely
      const fallbackCache = cacheManager.get('profile') as Profile | null
      if (fallbackCache && fallbackCache.id === userId) {
        console.log('Using cached profile as fallback')
        setProfile(fallbackCache)
        // Don't throw error - we have valid cached data
        return
      }
      
      throw error
    }
  }
  
  // Legacy function for backward compatibility
  async function loadProfile(userId: string, retryCount = 0): Promise<void> {
    return loadProfileWithCache(userId, retryCount)
  }

  // Global online status management
  async function updateUserOnlineStatus(userId: string, isOnline: boolean) {
    try {
      console.log(`🔄 [ONLINE STATUS UPDATE] User ${userId} → ${isOnline ? 'ONLINE' : 'OFFLINE'} (at ${new Date().toISOString()})`)
      
      await supabase
        .from('profiles')
        .update({ 
          is_online: isOnline, 
          last_seen: new Date().toISOString() 
        })
        .eq('id', userId)
      
      console.log(`✅ [ONLINE STATUS] Successfully updated user ${userId} status to ${isOnline ? 'ONLINE' : 'OFFLINE'}`)
    } catch (error) {
      console.error('❌ [ONLINE STATUS ERROR] Error updating user online status:', error)
    }
  }

  // Set up global online status tracking
  useEffect(() => {
    if (!user) return

    // Update user status to online on mount
    updateUserOnlineStatus(user.id, true)

    // Set up periodic updates every 30 seconds to keep status fresh and update last_seen
    const presenceInterval = setInterval(() => {
      console.log(`🔄 [PRESENCE] Periodic status refresh for user ${user.id}`)
      updateUserOnlineStatus(user.id, true)
    }, 30000)

    // Only set user offline when they explicitly log out
    // Browser refresh/close will NOT change online status - it persists until logout
    // This ensures is_online stays true even when tab is closed and reopened

    return () => {
      clearInterval(presenceInterval)
      // DO NOT set offline on component unmount (tab close/refresh)
      // Online status should persist until user explicitly logs out
    }
  }, [user])

  async function signIn(email: string, password: string) {
    try {
      setLoading(true)
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        // Enhanced error handling for different authentication failures
        if (error.message.includes('Invalid login credentials')) {
          return { error: { message: 'Invalid email or password. Please check your credentials and try again.' } }
        } else if (error.message.includes('Email not confirmed')) {
          return { error: { message: 'Please check your email and click the verification link to activate your account before signing in.' } }
        } else if (error.message.includes('User not found')) {
          return { error: { message: 'No account found with this email address. Please sign up first.' } }
        } else if (error.message.includes('Email link is invalid or has expired')) {
          return { error: { message: 'Email verification link has expired. Please request a new verification email.' } }
        }
        return { error }
      }

      if (!data.user) {
        return { error: { message: 'Authentication failed. Please try again.' } }
      }

      // Check if email is confirmed
      if (!data.user.email_confirmed_at) {
        await supabase.auth.signOut()
        return { error: { message: 'Please verify your email address before signing in. Check your inbox for the verification link.' } }
      }

      // Check if user is active before allowing login
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('active')
        .eq('id', data.user.id)
        .single()

      if (profileError) {
        console.error('Profile check error:', profileError)
        await supabase.auth.signOut()
        return { error: { message: 'Unable to verify account status. Please contact support.' } }
      }

      if (!profile) {
        await supabase.auth.signOut()
        return { error: { message: 'User profile not found. Please contact support.' } }
      }

      if (!profile.active) {
        await supabase.auth.signOut()
        return { error: { message: 'Your account has been deactivated. Please contact your administrator for assistance.' } }
      }

      // Set user online immediately upon successful authentication
      await updateUserOnlineStatus(data.user.id, true)
      
      // Load profile with smart caching strategy
      loadProfileWithCache(data.user.id).catch(error => {
        console.error('Profile loading failed after sign in:', error)
        // Don't block sign in for profile loading failures
      })

      return { error: null }
    } catch (error) {
      console.error('Sign in error:', error)
      return { error: { message: 'An unexpected error occurred during sign in. Please try again.' } }
    } finally {
      setLoading(false)
    }
  }

  async function signUp(email: string, password: string, fullName?: string) {
    try {
      setLoading(true)
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (!error && data.user) {
        // Create profile record in background
        supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            email: data.user.email!,
            full_name: fullName,
            role: 'collaborator', // Default role
            active: true // Default to active
          })
          .then(({ error: profileError }) => {
            if (profileError) {
              console.error('Error creating profile:', profileError)
            }
          })
      }

      return { error }
    } catch (error) {
      return { error }
    } finally {
      setLoading(false)
    }
  }

  async function signOut() {
    // Set user offline before signing out
    if (user) {
      await updateUserOnlineStatus(user.id, false)
    }
    
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Error signing out:', error)
    }
    setProfile(null)
    // Clear all cached data on logout including profile cache
    cacheManager.invalidate('profile')
    cacheManager.clearAll()
  }

  async function updateProfile(updates: Partial<Profile>) {
    if (!user) return { error: new Error('No user logged in') }

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select('id, email, full_name, role, active, avatar_url, is_online, last_seen, created_at, updated_at')
      .maybeSingle()

    if (!error && data) {
      // Update both state and cache
      setProfile(data)
      cacheManager.set('profile', data)
    }

    return { error }
  }

  const isAdmin = profile?.role === 'super_admin'
  const isCollaborator = profile?.role === 'collaborator'

  const value = {
    user,
    profile,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    updateProfile,
    isAdmin,
    isCollaborator,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}