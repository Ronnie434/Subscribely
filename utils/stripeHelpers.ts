/**
 * Stripe Helper Utilities
 * 
 * Helper functions for Stripe operations including formatting,
 * calculations, and validation
 */

import { REFUND_POLICY } from '../config/stripe';

/**
 * Format amount in cents to dollar string
 * 
 * @param cents - Amount in cents
 * @param currency - Currency code (default: 'USD')
 * @returns Formatted dollar string (e.g., "$4.99")
 * 
 * @example
 * formatAmount(499) // Returns "$4.99"
 * formatAmount(3900) // Returns "$39.00"
 */
export function formatAmount(cents: number, currency: string = 'USD'): string {
  const dollars = cents / 100;
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}

/**
 * Format dollar amount to cents
 * 
 * @param dollars - Amount in dollars
 * @returns Amount in cents
 * 
 * @example
 * formatToCents(4.99) // Returns 499
 * formatToCents(39) // Returns 3900
 */
export function formatToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/**
 * Calculate refund amount based on days elapsed
 * Currently implements full refund within 7-day window
 * 
 * @param originalAmount - Original payment amount in dollars
 * @param daysElapsed - Days since subscription started
 * @returns Refund amount in dollars
 * 
 * @example
 * calculateRefundAmount(4.99, 3) // Returns 4.99 (within 7 days)
 * calculateRefundAmount(4.99, 10) // Returns 0 (outside 7 days)
 */
export function calculateRefundAmount(
  originalAmount: number,
  daysElapsed: number
): number {
  // Full refund within 7-day window
  if (daysElapsed <= REFUND_POLICY.windowDays) {
    return originalAmount;
  }
  
  // No refund after window expires
  return 0;
}

/**
 * Check if subscription is eligible for refund based on date
 * 
 * @param subscriptionDate - Date when subscription was created
 * @returns Whether refund is eligible
 * 
 * @example
 * const subDate = new Date('2024-01-01');
 * isRefundEligible(subDate) // Returns true if within 7 days
 */
export function isRefundEligible(subscriptionDate: Date): boolean {
  const now = new Date();
  const daysSinceSubscription = getDaysBetween(subscriptionDate, now);
  
  return daysSinceSubscription <= REFUND_POLICY.windowDays;
}

/**
 * Get number of days between two dates
 * 
 * @param startDate - Start date
 * @param endDate - End date
 * @returns Number of days between dates
 */
export function getDaysBetween(startDate: Date, endDate: Date): number {
  const milliseconds = endDate.getTime() - startDate.getTime();
  return Math.floor(milliseconds / (1000 * 60 * 60 * 24));
}

/**
 * Get remaining days in refund window
 * 
 * @param subscriptionDate - Date when subscription was created
 * @returns Number of days remaining in refund window, or 0 if expired
 * 
 * @example
 * const subDate = new Date('2024-01-01');
 * getRemainingRefundDays(subDate) // Returns number of days left
 */
export function getRemainingRefundDays(subscriptionDate: Date): number {
  const daysSince = getDaysBetween(subscriptionDate, new Date());
  const remaining = REFUND_POLICY.windowDays - daysSince;
  
  return Math.max(0, remaining);
}

/**
 * Calculate subscription period dates based on billing cycle
 * 
 * @param cycle - Billing cycle ('monthly' or 'yearly')
 * @param startDate - Optional start date (defaults to now)
 * @returns Object with start and end dates
 * 
 * @example
 * const { start, end } = getSubscriptionPeriodDates('monthly');
 */
export function getSubscriptionPeriodDates(
  cycle: 'monthly' | 'yearly',
  startDate: Date = new Date()
): { start: Date; end: Date } {
  const start = new Date(startDate);
  const end = new Date(start);
  
  if (cycle === 'monthly') {
    // Add 1 month
    end.setMonth(end.getMonth() + 1);
  } else {
    // Add 1 year
    end.setFullYear(end.getFullYear() + 1);
  }
  
  return { start, end };
}

/**
 * Calculate days until subscription renewal
 * 
 * @param renewalDate - Renewal date
 * @returns Number of days until renewal
 * 
 * @example
 * const renewalDate = new Date('2024-02-01');
 * getDaysUntilRenewal(renewalDate) // Returns days until renewal
 */
export function getDaysUntilRenewal(renewalDate: Date): number {
  const now = new Date();
  const days = getDaysBetween(now, renewalDate);
  
  return Math.max(0, days);
}

/**
 * Format date to readable string
 * 
 * @param date - Date to format
 * @returns Formatted date string
 * 
 * @example
 * formatDate(new Date('2024-01-15')) // Returns "January 15, 2024"
 */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

/**
 * Format date to short string
 * 
 * @param date - Date to format
 * @returns Formatted date string
 * 
 * @example
 * formatDateShort(new Date('2024-01-15')) // Returns "Jan 15, 2024"
 */
export function formatDateShort(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

/**
 * Get subscription status display text
 * 
 * @param status - Subscription status
 * @returns Human-readable status text
 */
export function getStatusDisplayText(
  status: 'active' | 'canceled' | 'past_due' | 'grace_period' | 'trialing'
): string {
  const statusMap: Record<string, string> = {
    active: 'Active',
    canceled: 'Canceled',
    past_due: 'Payment Failed',
    grace_period: 'Grace Period',
    trialing: 'Trial',
  };
  
  return statusMap[status] || status;
}

/**
 * Get subscription status color
 * 
 * @param status - Subscription status
 * @returns Color code for status
 */
export function getStatusColor(
  status: 'active' | 'canceled' | 'past_due' | 'grace_period' | 'trialing'
): string {
  const colorMap: Record<string, string> = {
    active: '#10b981', // Green
    trialing: '#3b82f6', // Blue
    grace_period: '#f59e0b', // Amber
    past_due: '#ef4444', // Red
    canceled: '#6b7280', // Gray
  };
  
  return colorMap[status] || '#6b7280';
}

/**
 * Validate Stripe Price ID format
 * 
 * @param priceId - Stripe Price ID to validate
 * @returns Whether the Price ID is valid
 * 
 * @example
 * validatePriceId('price_1234567890abcdef') // Returns true
 * validatePriceId('invalid') // Returns false
 */
export function validatePriceId(priceId: string): boolean {
  // Stripe Price IDs start with 'price_'
  return /^price_[a-zA-Z0-9]{24,}$/.test(priceId);
}

/**
 * Validate Stripe Customer ID format
 * 
 * @param customerId - Stripe Customer ID to validate
 * @returns Whether the Customer ID is valid
 * 
 * @example
 * validateCustomerId('cus_1234567890abcdef') // Returns true
 * validateCustomerId('invalid') // Returns false
 */
export function validateCustomerId(customerId: string): boolean {
  // Stripe Customer IDs start with 'cus_'
  return /^cus_[a-zA-Z0-9]{14,}$/.test(customerId);
}

/**
 * Validate Stripe Subscription ID format
 * 
 * @param subscriptionId - Stripe Subscription ID to validate
 * @returns Whether the Subscription ID is valid
 * 
 * @example
 * validateSubscriptionId('sub_1234567890abcdef') // Returns true
 * validateSubscriptionId('invalid') // Returns false
 */
export function validateSubscriptionId(subscriptionId: string): boolean {
  // Stripe Subscription IDs start with 'sub_'
  return /^sub_[a-zA-Z0-9]{14,}$/.test(subscriptionId);
}

/**
 * Calculate monthly cost from yearly plan
 * 
 * @param yearlyAmount - Yearly subscription amount
 * @returns Monthly equivalent cost
 * 
 * @example
 * calculateMonthlyFromYearly(39) // Returns 3.25
 */
export function calculateMonthlyFromYearly(yearlyAmount: number): number {
  return Number((yearlyAmount / 12).toFixed(2));
}

/**
 * Calculate savings percentage
 * 
 * @param originalPrice - Original price (e.g., monthly * 12)
 * @param discountedPrice - Discounted price (e.g., yearly)
 * @returns Savings percentage
 * 
 * @example
 * calculateSavingsPercentage(59.88, 39) // Returns 34.78
 */
export function calculateSavingsPercentage(
  originalPrice: number,
  discountedPrice: number
): number {
  const savings = originalPrice - discountedPrice;
  const percentage = (savings / originalPrice) * 100;
  
  return Math.round(percentage * 100) / 100; // Round to 2 decimal places
}

/**
 * Get error message from Stripe error
 * 
 * @param error - Error object
 * @returns User-friendly error message
 */
export function getStripeErrorMessage(error: any): string {
  if (typeof error === 'string') {
    return error;
  }
  
  if (error?.message) {
    return error.message;
  }
  
  // Common Stripe error codes
  const errorMessages: Record<string, string> = {
    card_declined: 'Your card was declined. Please try another payment method.',
    expired_card: 'Your card has expired. Please use a different card.',
    incorrect_cvc: 'The security code is incorrect. Please check and try again.',
    processing_error: 'An error occurred while processing your card. Please try again.',
    rate_limit: 'Too many requests. Please try again in a moment.',
  };
  
  if (error?.code && errorMessages[error.code]) {
    return errorMessages[error.code];
  }
  
  return 'An unexpected error occurred. Please try again.';
}