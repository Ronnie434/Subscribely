/**
 * Domain Verification Service
 * 
 * Verifies that a domain exists and is accessible using multiple methods:
 * - Logo-based verification (primary, recommended)
 * - HTTP HEAD request (fallback)
 */

export type VerificationMethod = 'logo' | 'http' | 'manual';

export interface VerificationResult {
  verified: boolean;
  method: VerificationMethod;
  responseTime: number;
}

class DomainVerificationService {
  private readonly VERIFICATION_TIMEOUT = 5000; // 5 seconds

  /**
   * Verifies a domain by checking if its logo/favicon exists
   * Uses Google S2 Favicons API which is already integrated in the app
   * 
   * @param domain - The domain to verify (e.g., 'netflix.com')
   * @returns Promise<boolean> - True if logo exists and loads
   */
  async verifyDomainByLogo(domain: string): Promise<boolean> {
    if (!domain) return false;

    const logoUrl = `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.VERIFICATION_TIMEOUT);

      const response = await fetch(logoUrl, {
        method: 'HEAD',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Check if we got a valid image response
      const contentType = response.headers.get('content-type');
      const isImage = contentType?.includes('image');
      
      const responseTime = Date.now() - startTime;
      console.log(`[Verification] Logo check for ${domain}: ${response.ok && isImage ? 'SUCCESS' : 'FAILED'} (${responseTime}ms)`);

      return response.ok && !!isImage;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.log(`[Verification] Logo check for ${domain}: FAILED (${responseTime}ms)`, error);
      return false;
    }
  }

  /**
   * Verifies a domain by making an HTTP HEAD request
   * Fallback method when logo verification fails
   * 
   * @param domain - The domain to verify (e.g., 'netflix.com')
   * @returns Promise<boolean> - True if domain responds successfully
   */
  async verifyDomainByHTTP(domain: string): Promise<boolean> {
    if (!domain) return false;

    const url = `https://${domain}`;
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.VERIFICATION_TIMEOUT);

      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseTime = Date.now() - startTime;
      console.log(`[Verification] HTTP check for ${domain}: ${response.ok ? 'SUCCESS' : 'FAILED'} (${responseTime}ms)`);

      return response.ok;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.log(`[Verification] HTTP check for ${domain}: FAILED (${responseTime}ms)`, error);
      return false;
    }
  }

  /**
   * Verifies a domain using multiple methods with fallback
   * First tries logo verification (recommended), then HTTP if that fails
   * 
   * @param domain - The domain to verify
   * @returns Promise<VerificationResult> - Detailed verification result
   */
  async verifyWithFallback(domain: string): Promise<VerificationResult> {
    if (!domain) {
      return { verified: false, method: 'logo', responseTime: 0 };
    }

    const startTime = Date.now();

    // Try logo verification first (recommended)
    const logoVerified = await this.verifyDomainByLogo(domain);
    if (logoVerified) {
      return {
        verified: true,
        method: 'logo',
        responseTime: Date.now() - startTime,
      };
    }

    // Fallback to HTTP verification
    const httpVerified = await this.verifyDomainByHTTP(domain);
    return {
      verified: httpVerified,
      method: 'http',
      responseTime: Date.now() - startTime,
    };
  }

  /**
   * Batch verify multiple domains
   * Useful for pre-caching or validation
   * 
   * @param domains - Array of domains to verify
   * @returns Promise<Map<string, boolean>> - Map of domain to verification result
   */
  async batchVerify(domains: string[]): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    // Verify domains in parallel with Promise.all
    const verifications = domains.map(async (domain) => {
      const verified = await this.verifyDomainByLogo(domain);
      return { domain, verified };
    });

    const verificationResults = await Promise.all(verifications);

    verificationResults.forEach(({ domain, verified }) => {
      results.set(domain, verified);
    });

    return results;
  }
}

// Export singleton instance
export const domainVerificationService = new DomainVerificationService();