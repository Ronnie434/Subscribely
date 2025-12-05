import { parseLocalDate } from './dateHelpers';
import { RepeatInterval, REPEAT_INTERVAL_CONFIG } from '../types';

/**
 * Calculate future renewal dates for a subscription based on its repeat interval
 * @param startDate The current renewal date (YYYY-MM-DD format)
 * @param repeatInterval The repeat interval
 * @param months Number of months to project forward (default: 12)
 * @returns Array of ISO date strings (YYYY-MM-DD) representing future renewals
 */
export function calculateFutureRenewals(
  startDate: string,
  repeatInterval: RepeatInterval,
  months: number = 12
): string[] {
  // One-time charges don't have future renewals
  if (repeatInterval === 'never') {
    return [startDate];
  }

  const renewalDates: string[] = [];
  
  // Calculate the end date (12 months from now)
  const start = parseLocalDate(startDate);
  const endDate = new Date(start);
  endDate.setMonth(endDate.getMonth() + months);
  
  let currentDate = new Date(start);
  
  // Generate renewal dates until we exceed the end date
  while (currentDate <= endDate) {
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    renewalDates.push(`${year}-${month}-${day}`);
    
    // Calculate next renewal date based on interval
    // Use calendar months/years for monthly+ intervals, fixed days for weekly
    const nextDate = new Date(currentDate);
    
    switch (repeatInterval) {
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'biweekly':
        nextDate.setDate(nextDate.getDate() + 14);
        break;
      case 'semimonthly':
        nextDate.setDate(nextDate.getDate() + 15);
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case 'bimonthly':
        nextDate.setMonth(nextDate.getMonth() + 2);
        break;
      case 'quarterly':
        nextDate.setMonth(nextDate.getMonth() + 3);
        break;
      case 'semiannually':
        nextDate.setMonth(nextDate.getMonth() + 6);
        break;
      case 'yearly':
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        break;
      default:
        // Fallback to fixed days for unknown intervals
        const intervalDays = REPEAT_INTERVAL_CONFIG[repeatInterval]?.days || 30;
        nextDate.setDate(nextDate.getDate() + intervalDays);
    }
    
    currentDate = nextDate;
  }
  
  return renewalDates;
}

/**
 * Get all days in a specific month
 * @param year The year
 * @param month The month (0-11, JavaScript convention)
 * @returns Array of Date objects for each day in the month
 */
export function getDaysInMonth(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days: Date[] = [];
  
  for (let day = 1; day <= lastDay.getDate(); day++) {
    days.push(new Date(year, month, day));
  }
  
  return days;
}

/**
 * Get the starting day of week offset for a month
 * @param year The year
 * @param month The month (0-11, JavaScript convention)
 * @returns Number of empty cells needed before the first day (0-6)
 */
export function getMonthStartOffset(year: number, month: number): number {
  const firstDay = new Date(year, month, 1);
  return firstDay.getDay(); // 0 = Sunday, 6 = Saturday
}

/**
 * Format a date to YYYY-MM-DD for comparison
 * @param date The date to format
 * @returns ISO date string (YYYY-MM-DD)
 */
export function formatDateToISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Check if two dates are the same day
 * @param date1 First date
 * @param date2 Second date
 * @returns True if dates are on the same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}