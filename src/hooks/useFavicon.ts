import { useEffect, useRef, useCallback } from 'react'
import { useCompanyName } from '@/contexts/CompanyNameContext'

export function useFavicon() {
  const { logoUrl, loading } = useCompanyName()
  const isInitialized = useRef(false)
  const lastLogoUrl = useRef<string | null>(null)

  const updateFavicon = useCallback(async (logoUrl: string | null, skipCheck = false) => {
    // Skip update if logo hasn't changed (unless skipCheck is true)
    if (!skipCheck && logoUrl === lastLogoUrl.current) {
      return
    }

    try {
      // Remove existing favicon links
      const existingLinks = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]')
      existingLinks.forEach(link => link.remove())

      // Function to create and append favicon links
      const createFaviconLink = (href: string, rel: string) => {
        const link = document.createElement('link')
        link.rel = rel
        link.type = 'image/png'
        link.href = href
        document.head.appendChild(link)
      }

      if (logoUrl) {
        // Use uploaded logo
        const faviconUrl = `${logoUrl}?t=${Date.now()}`
        createFaviconLink(faviconUrl, 'icon')
        createFaviconLink(faviconUrl, 'shortcut icon')
        
        lastLogoUrl.current = logoUrl
        console.log('Favicon updated to uploaded logo:', faviconUrl)
      } else {
        // Use default favicon
        const defaultHref = '/temp-favicon.png?v=1'
        createFaviconLink(defaultHref, 'icon')
        createFaviconLink(defaultHref, 'shortcut icon')
        
        lastLogoUrl.current = null
        console.log('Favicon updated to default:', defaultHref)
      }
    } catch (error) {
      console.error('Failed to update favicon:', error)
    }
  }, [])

  // Handle logo changes from the context
  useEffect(() => {
    // Skip first load initialization
    if (isInitialized.current) {
      updateFavicon(logoUrl)
    }
  }, [logoUrl, updateFavicon])

  // Handle initial load
  useEffect(() => {
    if (!loading && !isInitialized.current) {
      updateFavicon(logoUrl, true) // Skip check on initial load
      isInitialized.current = true
    }
  }, [loading, logoUrl, updateFavicon])

  // Listen for logo-updated events from anywhere in the app
  useEffect(() => {
    const handleLogoUpdate = (event: CustomEvent) => {
      const { logoUrl: newLogoUrl } = event.detail
      console.log('Favicon: Logo update event received:', newLogoUrl)
      updateFavicon(newLogoUrl, true) // Skip check when receiving events
    }

    window.addEventListener('logo-updated', handleLogoUpdate as EventListener)
    
    return () => {
      window.removeEventListener('logo-updated', handleLogoUpdate as EventListener)
    }
  }, [updateFavicon])
}