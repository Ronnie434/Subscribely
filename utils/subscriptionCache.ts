/**
 * Subscription Cache
 * 
 * Simple in-memory caching system for subscription-related data.
 * Reduces database queries for frequently accessed information.
 */

import { CacheError } from './paywallErrors';

/**
 * Cache entry with data, timestamp, and TTL
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

/**
 * Simple in-memory cache for subscription data
 */
class SubscriptionCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  
  /**
   * Store data in cache with TTL
   * @param key - Cache key
   * @param data - Data to cache
   * @param ttl - Time to live in milliseconds (default: 5 minutes)
   */
  set<T>(key: string, data: T, ttl: number = 300000): void {
    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl,
      };
      
      this.cache.set(key, entry);
    } catch (error) {
      console.error('Cache set error:', error);
      throw new CacheError(
        `Failed to set cache for key: ${key}`,
        'set',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Retrieve data from cache if not expired
   * @param key - Cache key
   * @returns Cached data or null if not found/expired
   */
  get<T>(key: string): T | null {
    try {
      const entry = this.cache.get(key);
      
      if (!entry) {
        return null;
      }

      // Check if entry has expired
      const age = Date.now() - entry.timestamp;
      if (age > entry.ttl) {
        // Entry expired, remove it
        this.cache.delete(key);
        return null;
      }

      return entry.data as T;
    } catch (error) {
      console.error('Cache get error:', error);
      // On error, return null to fallback to database
      return null;
    }
  }

  /**
   * Check if a key exists and is not expired
   * @param key - Cache key
   * @returns True if key exists and is valid
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }

    const age = Date.now() - entry.timestamp;
    if (age > entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Remove a specific cache entry
   * @param key - Cache key to invalidate
   */
  invalidate(key: string): void {
    try {
      this.cache.delete(key);
    } catch (error) {
      console.error('Cache invalidate error:', error);
      throw new CacheError(
        `Failed to invalidate cache for key: ${key}`,
        'invalidate',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    try {
      this.cache.clear();
    } catch (error) {
      console.error('Cache clear error:', error);
      throw new CacheError(
        'Failed to clear cache',
        'clear',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get current cache size
   * @returns Number of entries in cache
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Remove all expired entries (garbage collection)
   */
  cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      const age = now - entry.timestamp;
      if (age > entry.ttl) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Get cache statistics
   * @returns Object with cache statistics
   */
  getStats(): {
    size: number;
    entries: Array<{ key: string; age: number; ttl: number }>;
  } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      age: now - entry.timestamp,
      ttl: entry.ttl,
    }));

    return {
      size: this.cache.size,
      entries,
    };
  }
}

// Export singleton instance
export const subscriptionCache = new SubscriptionCache();

// Export class for testing
export default SubscriptionCache;

/**
 * Cache key generators for consistent key naming
 */
export const CacheKeys = {
  /**
   * Key for user's subscription limit status
   */
  limitStatus: (userId: string) => `limit_status:${userId}`,

  /**
   * Key for user's current tier
   */
  currentTier: (userId: string) => `current_tier:${userId}`,

  /**
   * Key for user's subscription count
   */
  subscriptionCount: (userId: string) => `subscription_count:${userId}`,

  /**
   * Key for available tiers
   */
  availableTiers: () => 'available_tiers',

  /**
   * Key for premium status check
   */
  isPremium: (userId: string) => `is_premium:${userId}`,

  /**
   * Key for user subscription status
   */
  subscriptionStatus: (userId: string) => `subscription_status:${userId}`,
};

/**
 * Cache TTL constants (in milliseconds)
 */
export const CacheTTL = {
  /**
   * Short TTL for frequently changing data (1 minute)
   */
  SHORT: 60000,

  /**
   * Medium TTL for moderately stable data (5 minutes)
   */
  MEDIUM: 300000,

  /**
   * Long TTL for rarely changing data (15 minutes)
   */
  LONG: 900000,

  /**
   * Very long TTL for static data (1 hour)
   */
  VERY_LONG: 3600000,
};