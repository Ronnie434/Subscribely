/**
 * Domain Cache Service
 * 
 * Manages AsyncStorage cache for verified domains
 * Provides fast offline access to previously discovered domains
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { VerificationMethod } from './domainVerificationService';

export interface DomainCacheEntry {
  domain: string;
  serviceName: string;
  verified: boolean;
  timestamp: number;
  verificationMethod: VerificationMethod;
}

interface DomainCache {
  [serviceName: string]: DomainCacheEntry;
}

class DomainCacheService {
  private readonly CACHE_KEY = '@domain_cache';
  private readonly MAX_CACHE_SIZE = 500;
  private readonly CACHE_EXPIRY_DAYS = 90;
  
  // In-memory cache for faster access
  private memoryCache: Map<string, DomainCacheEntry> | null = null;

  /**
   * Initialize the cache by loading from AsyncStorage into memory
   * Called on app startup for better performance
   */
  async initialize(): Promise<void> {
    try {
      const cached = await AsyncStorage.getItem(this.CACHE_KEY);
      if (cached) {
        const cacheData: DomainCache = JSON.parse(cached);
        this.memoryCache = new Map(Object.entries(cacheData).map(([key, value]) => [key, value]));
        console.log(`[Cache] Initialized with ${this.memoryCache.size} entries`);
      } else {
        this.memoryCache = new Map();
        console.log('[Cache] Initialized empty cache');
      }
    } catch (error) {
      console.error('[Cache] Failed to initialize:', error);
      this.memoryCache = new Map();
    }
  }

  /**
   * Ensure memory cache is loaded
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.memoryCache) {
      await this.initialize();
    }
  }

  /**
   * Normalize service name for consistent cache keys
   */
  private normalizeServiceName(serviceName: string): string {
    return serviceName.toLowerCase().trim();
  }

  /**
   * Get cached domain for a service
   * 
   * @param serviceName - The service name to look up
   * @returns Promise<string | null> - The cached domain or null
   */
  async getCachedDomain(serviceName: string): Promise<string | null> {
    await this.ensureInitialized();
    
    const normalized = this.normalizeServiceName(serviceName);
    const entry = this.memoryCache!.get(normalized);

    if (!entry) {
      return null;
    }

    // Check if entry is expired
    const age = Date.now() - entry.timestamp;
    const maxAge = this.CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

    if (age > maxAge) {
      console.log(`[Cache] Entry expired for ${serviceName}`);
      await this.removeCacheEntry(serviceName);
      return null;
    }

    console.log(`[Cache] Hit for ${serviceName}: ${entry.domain}`);
    return entry.domain;
  }

  /**
   * Get full cache entry with metadata
   * 
   * @param serviceName - The service name to look up
   * @returns Promise<DomainCacheEntry | null>
   */
  async getCacheEntry(serviceName: string): Promise<DomainCacheEntry | null> {
    await this.ensureInitialized();
    
    const normalized = this.normalizeServiceName(serviceName);
    const entry = this.memoryCache!.get(normalized);

    if (!entry) {
      return null;
    }

    // Check if entry is expired
    const age = Date.now() - entry.timestamp;
    const maxAge = this.CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

    if (age > maxAge) {
      await this.removeCacheEntry(serviceName);
      return null;
    }

    return entry;
  }

  /**
   * Cache a verified domain for a service
   * 
   * @param serviceName - The service name
   * @param domain - The verified domain
   * @param verified - Whether the domain was verified
   * @param verificationMethod - How the domain was verified
   */
  async cacheDomain(
    serviceName: string,
    domain: string,
    verified: boolean = true,
    verificationMethod: VerificationMethod = 'manual'
  ): Promise<void> {
    await this.ensureInitialized();

    const normalized = this.normalizeServiceName(serviceName);
    const entry: DomainCacheEntry = {
      domain,
      serviceName: normalized,
      verified,
      timestamp: Date.now(),
      verificationMethod,
    };

    this.memoryCache!.set(normalized, entry);
    console.log(`[Cache] Cached ${serviceName} → ${domain} (${verificationMethod})`);

    // Check if we need to prune the cache
    if (this.memoryCache!.size > this.MAX_CACHE_SIZE) {
      await this.pruneCache();
    }

    // Persist to AsyncStorage
    await this.persistCache();
  }

  /**
   * Remove a cache entry
   * 
   * @param serviceName - The service name to remove
   */
  async removeCacheEntry(serviceName: string): Promise<void> {
    await this.ensureInitialized();

    const normalized = this.normalizeServiceName(serviceName);
    this.memoryCache!.delete(normalized);
    
    await this.persistCache();
    console.log(`[Cache] Removed ${serviceName}`);
  }

  /**
   * Persist memory cache to AsyncStorage
   */
  private async persistCache(): Promise<void> {
    try {
      const cacheData: DomainCache = {};
      this.memoryCache!.forEach((entry, key) => {
        cacheData[key] = entry;
      });

      await AsyncStorage.setItem(this.CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.error('[Cache] Failed to persist cache:', error);
    }
  }

  /**
   * Remove old cache entries to keep cache size manageable
   * Removes oldest entries when cache exceeds MAX_CACHE_SIZE
   */
  async pruneCache(): Promise<void> {
    await this.ensureInitialized();

    if (this.memoryCache!.size <= this.MAX_CACHE_SIZE) {
      return;
    }

    // Sort entries by timestamp (oldest first)
    const entries = Array.from(this.memoryCache!.entries()).sort(
      ([, a], [, b]) => a.timestamp - b.timestamp
    );

    // Remove oldest entries until we're under the limit
    const entriesToRemove = this.memoryCache!.size - this.MAX_CACHE_SIZE;
    for (let i = 0; i < entriesToRemove; i++) {
      this.memoryCache!.delete(entries[i][0]);
    }

    console.log(`[Cache] Pruned ${entriesToRemove} old entries`);
    await this.persistCache();
  }

  /**
   * Clear all cache entries
   */
  async clearCache(): Promise<void> {
    await this.ensureInitialized();
    
    this.memoryCache!.clear();
    await AsyncStorage.removeItem(this.CACHE_KEY);
    
    console.log('[Cache] Cleared all entries');
  }

  /**
   * Get cache statistics
   * 
   * @returns Promise<{ size: number; oldestEntry: number }>
   */
  async getCacheStats(): Promise<{ size: number; oldestEntry: number; newestEntry: number }> {
    await this.ensureInitialized();

    const entries = Array.from(this.memoryCache!.values());
    
    if (entries.length === 0) {
      return { size: 0, oldestEntry: 0, newestEntry: 0 };
    }

    const timestamps = entries.map(e => e.timestamp);
    
    return {
      size: entries.length,
      oldestEntry: Math.min(...timestamps),
      newestEntry: Math.max(...timestamps),
    };
  }

  /**
   * Get all cache entries (for debugging)
   * 
   * @returns Promise<DomainCacheEntry[]>
   */
  async getAllEntries(): Promise<DomainCacheEntry[]> {
    await this.ensureInitialized();
    return Array.from(this.memoryCache!.values());
  }

  /**
   * Export cache data (for backup/migration)
   * 
   * @returns Promise<string> - JSON string of cache data
   */
  async exportCache(): Promise<string> {
    await this.ensureInitialized();
    
    const cacheData: DomainCache = {};
    this.memoryCache!.forEach((entry, key) => {
      cacheData[key] = entry;
    });

    return JSON.stringify(cacheData, null, 2);
  }

  /**
   * Import cache data (for backup/migration)
   * 
   * @param cacheJson - JSON string of cache data
   */
  async importCache(cacheJson: string): Promise<void> {
    try {
      const cacheData: DomainCache = JSON.parse(cacheJson);
      this.memoryCache = new Map(Object.entries(cacheData).map(([key, value]) => [key, value]));
      
      await this.persistCache();
      console.log(`[Cache] Imported ${this.memoryCache.size} entries`);
    } catch (error) {
      console.error('[Cache] Failed to import cache:', error);
      throw new Error('Invalid cache data format');
    }
  }
}

// Export singleton instance
export const domainCacheService = new DomainCacheService();