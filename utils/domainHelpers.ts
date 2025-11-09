/**
 * Utility functions for extracting and managing company domains
 */

// Known domain mappings for popular services
const DOMAIN_MAPPINGS: { [key: string]: string } = {
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

  // Fall back to simple domain construction
  // Remove special characters and spaces, convert to lowercase
  const cleaned = normalized
    .replace(/[^a-z0-9\s]/g, '') // Remove special characters
    .replace(/\s+/g, '') // Remove spaces
    .trim();

  // If we have a valid cleaned name, append .com
  if (cleaned) {
    return `${cleaned}.com`;
  }

  // If all else fails, return empty string
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