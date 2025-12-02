/**
 * Domain Discovery Service
 * 
 * Orchestrates multi-tier domain discovery:
 * 1. Check hardcoded DOMAIN_MAPPINGS (instant)
 * 2. Check AsyncStorage cache (~10ms)
 * 3. Intelligent pattern matching (~50ms)
 * 4. Optional: Verify on save (500-2000ms)
 */

import { domainCacheService } from './domainCacheService';
import { domainVerificationService } from './domainVerificationService';
import { isValidDomain } from '../utils/domainHelpers';

export type ConfidenceLevel = 'high' | 'medium' | 'low';
export type DomainSource = 'hardcoded' | 'cached' | 'guessed';

export interface DomainSuggestion {
  domain: string;
  confidence: ConfidenceLevel;
  source: DomainSource;
  verified: boolean;
}

class DomainDiscoveryService {
  // Hardcoded mappings for known services (imported from domainHelpers)
  private readonly DOMAIN_MAPPINGS: { [key: string]: string } = {
    'netflix': 'netflix.com',
    'spotify': 'spotify.com',
    'apple': 'apple.com',
    'icloud': 'icloud.com',
    'amazon': 'amazon.com',
    'prime video': 'amazon.com',
    'prime': 'amazon.com',
    'hulu': 'hulu.com',
    'disney+': 'disneyplus.com',
    'disney plus': 'disneyplus.com',
    'hbo max': 'hbomax.com',
    'youtube': 'youtube.com',
    'youtube premium': 'youtube.com',
    'google': 'google.com',
    'google one': 'google.com',
    'microsoft': 'microsoft.com',
    'microsoft 365': 'microsoft.com',
    'office 365': 'microsoft.com',
    'adobe': 'adobe.com',
    'dropbox': 'dropbox.com',
    'github': 'github.com',
    'linkedin': 'linkedin.com',
    'twitter': 'twitter.com',
    'x': 'twitter.com',
    'facebook': 'facebook.com',
    'instagram': 'instagram.com',
    'tiktok': 'tiktok.com',
    'zoom': 'zoom.us',
    'slack': 'slack.com',
    'notion': 'notion.so',
    'figma': 'figma.com',
    'canva': 'canva.com',
    'grammarly': 'grammarly.com',
    'evernote': 'evernote.com',
    'mailchimp': 'mailchimp.com',
    'shopify': 'shopify.com',
    'squarespace': 'squarespace.com',
    'wix': 'wix.com',
    'wordpress': 'wordpress.com',
    'medium': 'medium.com',
    'patreon': 'patreon.com',
    'substack': 'substack.com',
    'audible': 'audible.com',
    'kindle unlimited': 'amazon.com',
    'peloton': 'onepeloton.com',
    'headspace': 'headspace.com',
    'calm': 'calm.com',
    'duolingo': 'duolingo.com',
    'coursera': 'coursera.org',
    'udemy': 'udemy.com',
    'skillshare': 'skillshare.com',
    'masterclass': 'masterclass.com',
  };

  /**
   * Initialize the discovery service
   * Loads cache into memory for faster access
   */
  async initialize(): Promise<void> {
    await domainCacheService.initialize();
    console.log('[Discovery] Service initialized');
  }

  /**
   * Normalize service name for consistent lookups
   */
  private normalizeServiceName(serviceName: string): string {
    return serviceName.toLowerCase().trim();
  }

  /**
   * Check hardcoded mappings (Tier 1 - instant)
   */
  private checkHardcodedMapping(serviceName: string): string | null {
    const normalized = this.normalizeServiceName(serviceName);

    // Direct match
    if (this.DOMAIN_MAPPINGS[normalized]) {
      console.log(`[Discovery] Hardcoded match for ${serviceName}: ${this.DOMAIN_MAPPINGS[normalized]}`);
      return this.DOMAIN_MAPPINGS[normalized];
    }

    // Partial match (e.g., "Apple Music" matches "apple")
    for (const [key, domain] of Object.entries(this.DOMAIN_MAPPINGS)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        console.log(`[Discovery] Partial hardcoded match for ${serviceName}: ${domain}`);
        return domain;
      }
    }

    return null;
  }

  /**
   * Generate domain candidates using pattern matching (Tier 3)
   */
  private generateDomainCandidates(serviceName: string): string[] {
    const candidates: string[] = [];

    // Normalize: remove special characters, spaces, etc.
    const normalized = serviceName
      .toLowerCase()
      .trim()
      .replace(/['\s-]+/g, '') // Remove apostrophes, spaces, hyphens
      .replace(/[^a-z0-9]/g, ''); // Remove special chars

    if (!normalized || normalized.length < 2) {
      return candidates;
    }

    // Try common TLDs with full normalized name
    const tlds = ['.com', '.net', '.io', '.co', '.org'];
    tlds.forEach(tld => {
      candidates.push(normalized + tld);
    });

    // If multi-word, try first word only
    const words = serviceName.toLowerCase().trim().split(/\s+/);
    if (words.length > 1) {
      const firstWord = words[0].replace(/[^a-z0-9]/g, '');
      if (firstWord && firstWord.length >= 2) {
        tlds.forEach(tld => {
          const candidate = firstWord + tld;
          if (!candidates.includes(candidate)) {
            candidates.push(candidate);
          }
        });
      }
    }

    // Handle common patterns like "LA Fitness" -> "lafitness.com"
    const acronymWords = words.filter(w => w.length <= 3 && w.toUpperCase() === w);
    if (acronymWords.length > 0 && words.length > acronymWords.length) {
      const nonAcronyms = words.filter(w => !(w.length <= 3 && w.toUpperCase() === w));
      const combined = acronymWords.join('') + nonAcronyms.join('');
      const combinedNormalized = combined.replace(/[^a-z0-9]/g, '');
      
      if (combinedNormalized && combinedNormalized.length >= 2) {
        tlds.forEach(tld => {
          const candidate = combinedNormalized + tld;
          if (!candidates.includes(candidate)) {
            candidates.push(candidate);
          }
        });
      }
    }

    console.log(`[Discovery] Generated ${candidates.length} candidates for ${serviceName}: ${candidates.slice(0, 3).join(', ')}...`);
    return candidates;
  }

  /**
   * Find best domain candidate from pattern matching
   */
  private findBestCandidate(candidates: string[]): string | null {
    // Filter to valid domain format
    const validCandidates = candidates.filter(c => isValidDomain(c));

    if (validCandidates.length === 0) {
      return null;
    }

    // Prefer .com domains
    const comDomain = validCandidates.find(c => c.endsWith('.com'));
    if (comDomain) {
      return comDomain;
    }

    // Otherwise return first valid candidate
    return validCandidates[0];
  }

  /**
   * Discover domain for a service (main entry point)
   * Fast, synchronous discovery using all tiers except verification
   * 
   * @param serviceName - The service name (e.g., "Planet Fitness")
   * @returns Promise<DomainSuggestion | null>
   */
  async discoverDomain(serviceName: string): Promise<DomainSuggestion | null> {
    if (!serviceName || serviceName.trim().length === 0) {
      return null;
    }

    // Tier 1: Check hardcoded mappings (instant)
    const hardcoded = this.checkHardcodedMapping(serviceName);
    if (hardcoded) {
      return {
        domain: hardcoded,
        confidence: 'high',
        source: 'hardcoded',
        verified: true, // Hardcoded domains are trusted
      };
    }

    // Tier 2: Check cache (~10ms)
    const cached = await domainCacheService.getCachedDomain(serviceName);
    if (cached) {
      const cacheEntry = await domainCacheService.getCacheEntry(serviceName);
      return {
        domain: cached,
        confidence: 'medium',
        source: 'cached',
        verified: cacheEntry?.verified ?? true,
      };
    }

    // Tier 3: Pattern matching (~50ms)
    const candidates = this.generateDomainCandidates(serviceName);
    const bestCandidate = this.findBestCandidate(candidates);

    if (bestCandidate) {
      return {
        domain: bestCandidate,
        confidence: 'low',
        source: 'guessed',
        verified: false, // Not yet verified
      };
    }

    return null;
  }

  /**
   * Get multiple domain suggestions for user to choose from
   * 
   * @param serviceName - The service name
   * @returns Promise<DomainSuggestion[]>
   */
  async getSuggestions(serviceName: string): Promise<DomainSuggestion[]> {
    const suggestions: DomainSuggestion[] = [];

    if (!serviceName || serviceName.trim().length === 0) {
      return suggestions;
    }

    // Get primary suggestion
    const primary = await this.discoverDomain(serviceName);
    if (primary) {
      suggestions.push(primary);
    }

    // If primary is guessed, add more candidates
    if (primary?.source === 'guessed') {
      const candidates = this.generateDomainCandidates(serviceName);
      const validCandidates = candidates
        .filter(c => isValidDomain(c) && c !== primary.domain)
        .slice(0, 3); // Limit to 3 additional suggestions

      validCandidates.forEach(domain => {
        suggestions.push({
          domain,
          confidence: 'low',
          source: 'guessed',
          verified: false,
        });
      });
    }

    return suggestions;
  }

  /**
   * Verify a domain and cache if successful
   * Called on save to ensure domain quality
   * 
   * @param serviceName - The service name
   * @param domain - The domain to verify
   * @returns Promise<boolean>
   */
  async verifyAndCache(serviceName: string, domain: string): Promise<boolean> {
    if (!domain || !isValidDomain(domain)) {
      console.log(`[Discovery] Invalid domain format: ${domain}`);
      return false;
    }

    console.log(`[Discovery] Verifying ${domain} for ${serviceName}...`);
    
    const result = await domainVerificationService.verifyWithFallback(domain);

    if (result.verified) {
      // Cache the verified domain
      await domainCacheService.cacheDomain(
        serviceName,
        domain,
        true,
        result.method
      );
      console.log(`[Discovery] ✅ Verified and cached ${domain} (${result.responseTime}ms)`);
    } else {
      console.log(`[Discovery] ❌ Failed to verify ${domain}`);
    }

    return result.verified;
  }

  /**
   * Manual domain override - cache without verification
   * Used when user manually enters a domain
   * 
   * @param serviceName - The service name
   * @param domain - The domain provided by user
   */
  async cacheManualDomain(serviceName: string, domain: string): Promise<void> {
    if (!domain || !isValidDomain(domain)) {
      throw new Error('Invalid domain format');
    }

    await domainCacheService.cacheDomain(
      serviceName,
      domain,
      false, // Not verified through API
      'manual'
    );

    console.log(`[Discovery] Cached manual domain: ${serviceName} → ${domain}`);
  }

  /**
   * Get cache statistics (for debugging/admin)
   */
  async getCacheStats() {
    return domainCacheService.getCacheStats();
  }

  /**
   * Clear all cached domains
   */
  async clearCache(): Promise<void> {
    await domainCacheService.clearCache();
    console.log('[Discovery] Cache cleared');
  }
}

// Export singleton instance
export const domainDiscoveryService = new DomainDiscoveryService();