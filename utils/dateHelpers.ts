import { format, parseISO, addMonths, addYears, isAfter, isBefore } from 'date-fns';

/**
 * Parses an ISO date string (YYYY-MM-DD) as a local date, not UTC.
 *
 * This prevents timezone conversion issues where "2025-12-13" would
 * become Dec 12 in Pacific Time due to UTC midnight parsing.
 *
 * Standard Date constructor behavior:
 * - new Date("2025-12-13") → Parses as UTC midnight, converts to local timezone
 *   In Pacific Time: Dec 12, 2024 4:00 PM (PST is UTC-8)
 *
 * This function's behavior:
 * - parseLocalDate("2025-12-13") → Parses as local midnight
 *   In Pacific Time: Dec 13, 2024 12:00 AM (PST)
 *
 * @param dateString ISO date string in format "YYYY-MM-DD"
 * @returns Date object set to local midnight of the specified date
 *
 * @example
 * // In Pacific Time (UTC-8):
 * const date1 = new Date("2025-12-13"); // Dec 12, 2024 4:00 PM PST
 * const date2 = parseLocalDate("2025-12-13"); // Dec 13, 2024 12:00 AM PST
 */
export function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export const dateHelpers = {
  formatDate(date: string | Date): string {
    const dateObj = typeof date === 'string' ? parseLocalDate(date) : date;
    return format(dateObj, 'MMM dd, yyyy');
  },

  formatShortDate(date: string | Date): string {
    const dateObj = typeof date === 'string' ? parseLocalDate(date) : date;
    return format(dateObj, 'MMM dd');
  },

  formatFullDate(date: string | Date): string {
    const dateObj = typeof date === 'string' ? parseLocalDate(date) : date;
    return format(dateObj, 'MMMM d, yyyy');
  },

  getNextRenewalDate(renewalDate: string, billingCycle: 'monthly' | 'yearly'): string {
    const date = parseISO(renewalDate);
    const nextDate = billingCycle === 'monthly' ? addMonths(date, 1) : addYears(date, 1);
    return nextDate.toISOString();
  },

  isUpcoming(date: string, days: number = 7): boolean {
    const renewalDate = parseISO(date);
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + days);
    
    return isAfter(renewalDate, today) && isBefore(renewalDate, futureDate);
  },

  isPast(date: string): boolean {
    const renewalDate = parseISO(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    renewalDate.setHours(0, 0, 0, 0);
    
    return isBefore(renewalDate, today);
  },
};

/**
 * Converts a UTC timestamp to a local Date representing the same calendar date.
 *
 * Example:
 * - Input: "2025-11-27T00:00:00.000Z" (Nov 27 UTC)
 * - Output: Date object for Nov 27 at local midnight
 *
 * @param utcTimestamp ISO 8601 UTC timestamp
 * @returns Date object in local timezone with the same calendar date
 */
export function utcTimestampToLocalDate(utcTimestamp: string): Date {
  const utcDate = new Date(utcTimestamp);
  
  // Extract date components in UTC
  const year = utcDate.getUTCFullYear();
  const month = utcDate.getUTCMonth() + 1; // Convert to 1-indexed
  const day = utcDate.getUTCDate();
  
  // Create ISO date string
  const isoDateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  
  // Use existing parseLocalDate helper
  return parseLocalDate(isoDateString);
}

