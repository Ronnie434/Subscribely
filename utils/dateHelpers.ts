import { format, parseISO, addMonths, addYears, isAfter, isBefore } from 'date-fns';

export const dateHelpers = {
  formatDate(date: string | Date): string {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return format(dateObj, 'MMM dd, yyyy');
  },

  formatShortDate(date: string | Date): string {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return format(dateObj, 'MMM dd');
  },

  formatFullDate(date: string | Date): string {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
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

