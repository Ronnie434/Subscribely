/**
 * Utility functions for extracting and managing company domains
 *
 * Note: This file now integrates with the intelligent domain discovery system.
 * The discovery service handles caching, verification, and pattern matching.
 */

import { domainDiscoveryService } from '../services/domainDiscoveryService';
import type { DomainSuggestion } from '../services/domainDiscoveryService';

// Export types for external use
export type { DomainSuggestion };

// Known domain mappings for popular services
// Note: This is also duplicated in domainDiscoveryService for performance
// Both should be kept in sync
export const DOMAIN_MAPPINGS: { [key: string]: string } = {
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
 * Get a list of all known company names for autocomplete
 *
 * @returns An array of company names sorted alphabetically
 */
export function getCompanyNames(): string[] {
  // Get all keys from the domain mappings and capitalize them properly
  const names = Object.keys(DOMAIN_MAPPINGS).map(name => {
    // Capitalize first letter of each word
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  });
  
  // Remove duplicates and sort alphabetically
  return [...new Set(names)].sort();
}

/**
 * Extracts a domain from a company name.
 * First checks known mappings, then falls back to simple domain construction.
 * 
 * @param companyName - The name of the company (e.g., "Netflix", "Apple Music")
 * @returns The domain name (e.g., "netflix.com", "apple.com")
 * 
 * @example
 * extractDomain("Netflix") // returns "netflix.com"
 * extractDomain("Apple Music") // returns "apple.com"
 * extractDomain("Disney+") // returns "disneyplus.com"
 */
export function extractDomain(companyName: string): string {
  if (!companyName || companyName.trim() === '') {
    return '';
  }

  // Normalize the company name
  const normalized = companyName.toLowerCase().trim();

  // Check if we have a known mapping
  if (DOMAIN_MAPPINGS[normalized]) {
    return DOMAIN_MAPPINGS[normalized];
  }

  // Try to match partial names (e.g., "Apple Music" should match "apple")
  for (const [key, domain] of Object.entries(DOMAIN_MAPPINGS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return domain;
    }
  }

  // No known mapping found - return empty string instead of auto-generating
  // This prevents creating invalid domains that fail when users try to redirect
  return '';
}

/**
 * Validates if a domain string is in a valid format
 *
 * @param domain - The domain to validate
 * @returns true if the domain appears valid
 */
export function isValidDomain(domain: string): boolean {
  if (!domain) return false;
  
  // Basic domain validation regex
  const domainRegex = /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/i;
  return domainRegex.test(domain);
}

/**
 * Get domain suggestion using the intelligent discovery system
 * This is an async version that uses caching and pattern matching
 *
 * @param companyName - The service name
 * @returns Promise<DomainSuggestion | null>
 */
export async function getDomainSuggestion(companyName: string): Promise<DomainSuggestion | null> {
  return domainDiscoveryService.discoverDomain(companyName);
}

/**
 * Get multiple domain suggestions for a service
 *
 * @param companyName - The service name
 * @returns Promise<DomainSuggestion[]>
 */
export async function getDomainSuggestions(companyName: string): Promise<DomainSuggestion[]> {
  return domainDiscoveryService.getSuggestions(companyName);
}

/**
 * Verify a domain and cache if successful
 * Used when saving a subscription with a guessed/unverified domain
 *
 * @param serviceName - The service name
 * @param domain - The domain to verify
 * @returns Promise<boolean> - True if verified
 */
export async function verifyAndCacheDomain(serviceName: string, domain: string): Promise<boolean> {
  return domainDiscoveryService.verifyAndCache(serviceName, domain);
}

/**
 * Cache a manually entered domain
 * Used when user provides their own domain
 *
 * @param serviceName - The service name
 * @param domain - The user-provided domain
 */
export async function cacheManualDomain(serviceName: string, domain: string): Promise<void> {
  return domainDiscoveryService.cacheManualDomain(serviceName, domain);
}

/**
 * Initialize the domain discovery system
 * Should be called on app startup
 */
export async function initializeDomainDiscovery(): Promise<void> {
  return domainDiscoveryService.initialize();
}