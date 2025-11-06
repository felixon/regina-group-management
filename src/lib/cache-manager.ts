/**
 * Cache Manager for Regina Group Project Management System
 * Provides aggressive caching with instant retrieval and background refresh
 */

interface CacheEntry<T> {
  data: T
  timestamp: number
  version: string
  expiresAt: number
}

interface CacheConfig {
  duration: number // Cache duration in milliseconds
  version: string // Cache version for invalidation
}

// Cache configurations for different data types
const CACHE_CONFIGS: Record<string, CacheConfig> = {
  projects: { duration: 5 * 60 * 1000, version: '1.0' }, // 5 minutes
  dashboard: { duration: 5 * 60 * 1000, version: '1.0' }, // 5 minutes
  profile: { duration: 45 * 60 * 1000, version: '1.1' }, // 45 minutes, updated version for faster cache invalidation
  adminSettings: { duration: 30 * 60 * 1000, version: '1.0' }, // 30 minutes
  notifications: { duration: 2 * 60 * 1000, version: '1.0' }, // 2 minutes for real-time notifications
  domainExpiry: { duration: 1 * 60 * 1000, version: '1.0' }, // 1 minute for domain expiry data
}

class CacheManager {
  private static instance: CacheManager
  private readonly prefix = 'regina_cache_'

  private constructor() {}

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager()
    }
    return CacheManager.instance
  }

  /**
   * Set data in cache with automatic expiration
   */
  set<T>(key: string, data: T): void {
    try {
      const config = CACHE_CONFIGS[key] || { duration: 5 * 60 * 1000, version: '1.0' }
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        version: config.version,
        expiresAt: Date.now() + config.duration,
      }
      localStorage.setItem(this.prefix + key, JSON.stringify(entry))
      console.log(`Cache set: ${key}`)
    } catch (error) {
      console.error(`Error setting cache for ${key}:`, error)
      // If localStorage is full, try to clear old entries
      this.clearExpired()
    }
  }

  /**
   * Get data from cache if valid
   */
  get<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(this.prefix + key)
      if (!item) {
        console.log(`Cache miss: ${key}`)
        return null
      }

      const entry: CacheEntry<T> = JSON.parse(item)
      const config = CACHE_CONFIGS[key]

      // Check if cache is expired
      if (Date.now() > entry.expiresAt) {
        console.log(`Cache expired: ${key}`)
        this.invalidate(key)
        return null
      }

      // Check if cache version matches
      if (config && entry.version !== config.version) {
        console.log(`Cache version mismatch: ${key}`)
        this.invalidate(key)
        return null
      }

      console.log(`Cache hit: ${key}`)
      return entry.data
    } catch (error) {
      console.error(`Error getting cache for ${key}:`, error)
      this.invalidate(key)
      return null
    }
  }

  /**
   * Check if cache exists and is valid
   */
  has(key: string): boolean {
    return this.get(key) !== null
  }

  /**
   * Get cache age in milliseconds
   */
  getAge(key: string): number | null {
    try {
      const item = localStorage.getItem(this.prefix + key)
      if (!item) return null

      const entry: CacheEntry<any> = JSON.parse(item)
      return Date.now() - entry.timestamp
    } catch {
      return null
    }
  }

  /**
   * Check if cache should be refreshed (older than half its duration)
   */
  shouldRefresh(key: string): boolean {
    const age = this.getAge(key)
    if (age === null) return true

    const config = CACHE_CONFIGS[key] || { duration: 5 * 60 * 1000, version: '1.0' }
    return age > config.duration / 2
  }

  /**
   * Invalidate domain-related caches when domains change
   */
  invalidateDomainCaches(): void {
    try {
      // Invalidate project cache (contains domain data)
      this.invalidate('projects')
      // Invalidate dashboard cache (may contain domain summaries)
      this.invalidate('dashboard')
      // Invalidate notification caches
      this.invalidate('notifications')
      this.invalidate('domainExpiry')
      // Invalidate notification context caches
      this.invalidate('notification-domain-expiry')
      this.invalidate('notification-counts')
      this.invalidate('message-counts')
      console.log('All domain-related caches invalidated')
      
      // Dispatch global event to notify all components
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('domainDataChanged', {
          detail: {
            source: 'cache-manager',
            timestamp: Date.now(),
            type: 'cache-invalidation'
          }
        })
        window.dispatchEvent(event)
      }
    } catch (error) {
      console.error('Error invalidating domain caches:', error)
    }
  }

  /**
   * Smart cache invalidation based on data type changes
   */
  invalidateOnDataChange(tableName: string, operation: string): void {
    switch (tableName) {
      case 'domains':
        this.invalidateDomainCaches()
        break
      case 'projects':
        // Invalidate projects and related caches
        this.invalidate('projects')
        this.invalidate('dashboard')
        break
      case 'notifications':
        // Only invalidate notification caches
        this.invalidate('notifications')
        this.invalidate('domainExpiry')
        break
      default:
        // For other tables, invalidate related caches
        this.invalidate('projects')
        this.invalidate('dashboard')
        break
    }
  }

  /**
   * Invalidate specific cache entry
   */
  invalidate(key: string): void {
    try {
      localStorage.removeItem(this.prefix + key)
      console.log(`Cache invalidated: ${key}`)
    } catch (error) {
      console.error(`Error invalidating cache for ${key}:`, error)
    }
  }

  /**
   * Clear all cache entries
   */
  clearAll(): void {
    try {
      const keys = Object.keys(localStorage)
      keys.forEach(key => {
        if (key.startsWith(this.prefix)) {
          localStorage.removeItem(key)
        }
      })
      console.log('All cache cleared')
    } catch (error) {
      console.error('Error clearing cache:', error)
    }
  }

  /**
   * Clear expired cache entries
   */
  clearExpired(): void {
    try {
      const keys = Object.keys(localStorage)
      let cleared = 0
      
      keys.forEach(key => {
        if (key.startsWith(this.prefix)) {
          try {
            const item = localStorage.getItem(key)
            if (item) {
              const entry: CacheEntry<any> = JSON.parse(item)
              if (Date.now() > entry.expiresAt) {
                localStorage.removeItem(key)
                cleared++
              }
            }
          } catch {
            // Remove corrupted entries
            localStorage.removeItem(key)
            cleared++
          }
        }
      })
      
      if (cleared > 0) {
        console.log(`Cleared ${cleared} expired cache entries`)
      }
    } catch (error) {
      console.error('Error clearing expired cache:', error)
    }
  }

  /**
   * Pre-warm cache for critical data like profile
   */
  async preWarm(key: string, fetcher: () => Promise<any>): Promise<void> {
    try {
      const existing = this.get(key)
      if (existing) {
        console.log(`Cache pre-warm skipped for ${key} - data exists`)
        return
      }

      console.log(`Pre-warming cache for ${key}...`)
      const data = await fetcher()
      this.set(key, data)
      console.log(`Cache pre-warmed successfully for ${key}`)
    } catch (error) {
      console.error(`Error pre-warming cache for ${key}:`, error)
    }
  }

  /**
   * Check if cache is fresh (recently updated)
   */
  isFresh(key: string, freshnessThreshold = 5 * 60 * 1000): boolean {
    const age = this.getAge(key)
    return age !== null && age < freshnessThreshold
  }

  /**
   * Get cache statistics
   */
  getStats(): { totalEntries: number; totalSize: number; entries: Array<{ key: string; age: number; size: number }> } {
    const entries: Array<{ key: string; age: number; size: number }> = []
    let totalSize = 0

    try {
      const keys = Object.keys(localStorage)
      keys.forEach(key => {
        if (key.startsWith(this.prefix)) {
          const item = localStorage.getItem(key)
          if (item) {
            const size = new Blob([item]).size
            totalSize += size
            
            try {
              const entry: CacheEntry<any> = JSON.parse(item)
              entries.push({
                key: key.replace(this.prefix, ''),
                age: Date.now() - entry.timestamp,
                size,
              })
            } catch {
              // Skip corrupted entries
            }
          }
        }
      })
    } catch (error) {
      console.error('Error getting cache stats:', error)
    }

    return {
      totalEntries: entries.length,
      totalSize,
      entries,
    }
  }
}

export const cacheManager = CacheManager.getInstance()