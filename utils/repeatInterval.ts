import { RepeatInterval, ChargeType, BillingCycle, REPEAT_INTERVAL_CONFIG } from '../types';

/**
 * Utility functions for repeat interval calculations and conversions
 * @since v3.0.0
 */

/**
 * Convert repeat interval to monthly cost multiplier
 * @param interval The repeat interval
 * @returns The monthly cost multiplier
 */
export function getMonthlyMultiplier(interval: RepeatInterval): number {
  return REPEAT_INTERVAL_CONFIG[interval].monthlyMultiplier;
}

/**
 * Get the number of days for a repeat interval
 * @param interval The repeat interval
 * @returns The number of days in the interval
 */
export function getIntervalDays(interval: RepeatInterval): number {
  return REPEAT_INTERVAL_CONFIG[interval].days;
}

/**
 * Get the display label for a repeat interval
 * @param interval The repeat interval
 * @returns The human-readable label
 */
export function getIntervalLabel(interval: RepeatInterval): string {
  return REPEAT_INTERVAL_CONFIG[interval].label;
}

/**
 * Calculate monthly cost from any repeat interval
 * @param cost The cost of the item
 * @param interval The repeat interval
 * @returns The monthly equivalent cost
 */
export function calculateMonthlyCost(cost: number, interval: RepeatInterval): number {
  if (interval === 'never') return 0;
  return cost * getMonthlyMultiplier(interval);
}

/**
 * Calculate yearly cost from any repeat interval
 * @param cost The cost of the item
 * @param interval The repeat interval
 * @returns The yearly equivalent cost
 */
export function calculateYearlyCost(cost: number, interval: RepeatInterval): number {
  if (interval === 'never') return 0;
  return calculateMonthlyCost(cost, interval) * 12;
}

/**
 * Calculate next renewal date based on interval
 * @param currentDate The current renewal date
 * @param interval The repeat interval
 * @returns The next renewal date
 */
export function calculateNextRenewal(currentDate: Date, interval: RepeatInterval): Date {
  if (interval === 'never') return currentDate;
  
  const days = getIntervalDays(interval);
  const next = new Date(currentDate);
  next.setDate(next.getDate() + days);
  return next;
}

/**
 * Convert old format (chargeType + billingCycle) to new RepeatInterval
 * Used for backward compatibility and data migration
 * @param chargeType The legacy charge type
 * @param billingCycle The legacy billing cycle
 * @returns The equivalent RepeatInterval
 */
export function convertToRepeatInterval(
  chargeType?: ChargeType,
  billingCycle?: BillingCycle
): RepeatInterval {
  // One-time charges always map to 'never'
  if (chargeType === 'one_time') return 'never';
  
  // Recurring charges map based on billing cycle
  if (chargeType === 'recurring' || !chargeType) {
    if (billingCycle === 'yearly') return 'yearly';
    return 'monthly'; // Default to monthly for recurring
  }
  
  // Fallback default
  return 'monthly';
}

/**
 * Convert new RepeatInterval to old format (chargeType + billingCycle)
 * Used for backward compatibility during transition period
 * @param interval The repeat interval
 * @returns Object with chargeType and billingCycle
 */
export function convertFromRepeatInterval(
  interval: RepeatInterval
): { chargeType: ChargeType; billingCycle: BillingCycle } {
  // 'never' maps to one-time charge
  if (interval === 'never') {
    return { chargeType: 'one_time', billingCycle: 'monthly' };
  }
  
  // 'yearly' maps to recurring yearly
  if (interval === 'yearly') {
    return { chargeType: 'recurring', billingCycle: 'yearly' };
  }
  
  // All other intervals map to recurring monthly (closest approximation)
  return { chargeType: 'recurring', billingCycle: 'monthly' };
}

/**
 * Check if an interval represents a recurring charge
 * @param interval The repeat interval
 * @returns True if the interval is recurring (not 'never')
 */
export function isRecurring(interval: RepeatInterval): boolean {
  return interval !== 'never';
}

/**
 * Get all available repeat interval options
 * @returns Array of all RepeatInterval values
 */
export function getAllIntervals(): RepeatInterval[] {
  return [
    'weekly',
    'biweekly',
    'semimonthly',
    'monthly',
    'bimonthly',
    'quarterly',
    'semiannually',
    'yearly',
    'never'
  ];
}

/**
 * Get repeat interval options grouped by frequency
 * Useful for UI dropdowns with sections
 */
export function getGroupedIntervals(): {
  frequent: RepeatInterval[];
  standard: RepeatInterval[];
  infrequent: RepeatInterval[];
  oneTime: RepeatInterval[];
} {
  return {
    frequent: ['weekly', 'biweekly', 'semimonthly'],
    standard: ['monthly', 'bimonthly', 'quarterly'],
    infrequent: ['semiannually', 'yearly'],
    oneTime: ['never']
  };
}

/**
 * Validate that a string is a valid RepeatInterval
 * @param value The value to validate
 * @returns True if value is a valid RepeatInterval
 */
export function isValidRepeatInterval(value: string): value is RepeatInterval {
  return getAllIntervals().includes(value as RepeatInterval);
}

/**
 * Calculate the total number of occurrences in a year for an interval
 * @param interval The repeat interval
 * @returns Number of times the interval occurs in a year
 */
export function getYearlyOccurrences(interval: RepeatInterval): number {
  if (interval === 'never') return 0;
  
  const days = getIntervalDays(interval);
  if (days === 0) return 0;
  
  return Math.round(365 / days);
}