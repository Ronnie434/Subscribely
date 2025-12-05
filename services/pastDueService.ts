/**
 * Past Due Service
 * 
 * Service for detecting and managing past due recurring items.
 * Handles payment confirmation and renewal date updates.
 * 
 * @since v3.1.0
 */

import { supabase } from '../config/supabase';
import {
  PastDueItem,
  RecordPaymentResult,
  PaymentHistory,
  PaymentStats,
  PaymentHistoryStatus,
} from '../types';

/**
 * Get all past due recurring items for the current user
 * 
 * @returns Promise with past due items or error
 */
export async function getPastDueItems(): Promise<{
  data: PastDueItem[] | null;
  error: string | null;
}> {
  try {
    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      return { data: null, error: sessionError.message };
    }
    
    if (!session) {
      return { data: null, error: 'No active session' };
    }

    // Call database function to get past due items
    const { data, error } = await supabase
      .rpc('get_past_due_items', { p_user_id: session.user.id });

    if (error) {
      console.error('Error fetching past due items:', error);
      return { data: null, error: error.message };
    }

    return { data: data || [], error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch past due items';
    console.error('Error in getPastDueItems:', err);
    return { data: null, error: message };
  }
}

/**
 * Record payment status and update renewal date
 * 
 * @param recurringItemId - ID of the recurring item
 * @param status - Payment status ('paid' or 'skipped')
 * @param paymentDate - Date when payment was made (defaults to today)
 * @param notes - Optional notes about the payment
 * @returns Promise with result of payment recording
 */
export async function recordPayment(
  recurringItemId: string,
  status: Extract<PaymentHistoryStatus, 'paid' | 'skipped'>,
  paymentDate?: string,
  notes?: string
): Promise<{
  data: RecordPaymentResult | null;
  error: string | null;
}> {
  try {
    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      return { data: null, error: sessionError.message };
    }
    
    if (!session) {
      return { data: null, error: 'No active session' };
    }

    // Default to today if no payment date provided
    const actualPaymentDate = paymentDate || new Date().toISOString().split('T')[0];

    // Call database function to record payment and update renewal
    const { data, error } = await supabase
      .rpc('record_payment_and_update_renewal', {
        p_recurring_item_id: recurringItemId,
        p_user_id: session.user.id,
        p_status: status,
        p_payment_date: actualPaymentDate,
        p_notes: notes || null,
      });

    if (error) {
      console.error('Error recording payment:', error);
      return { data: null, error: error.message };
    }

    // The function returns an array with a single row
    const result = Array.isArray(data) && data.length > 0 ? data[0] : data;

    if (!result || !result.success) {
      return {
        data: null,
        error: result?.error_message || 'Failed to record payment',
      };
    }

    return { data: result, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to record payment';
    console.error('Error in recordPayment:', err);
    return { data: null, error: message };
  }
}

/**
 * Get payment history for a specific recurring item
 * 
 * @param recurringItemId - ID of the recurring item
 * @param limit - Maximum number of records to return (default: 10)
 * @returns Promise with payment history or error
 */
export async function getPaymentHistory(
  recurringItemId: string,
  limit: number = 10
): Promise<{
  data: PaymentHistory[] | null;
  error: string | null;
}> {
  try {
    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      return { data: null, error: sessionError.message };
    }
    
    if (!session) {
      return { data: null, error: 'No active session' };
    }

    // Call database function to get payment history
    const { data, error } = await supabase
      .rpc('get_payment_history_for_item', {
        p_recurring_item_id: recurringItemId,
        p_user_id: session.user.id,
        p_limit: limit,
      });

    if (error) {
      console.error('Error fetching payment history:', error);
      return { data: null, error: error.message };
    }

    return { data: data || [], error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch payment history';
    console.error('Error in getPaymentHistory:', err);
    return { data: null, error: message };
  }
}

/**
 * Get payment statistics for the current user
 * 
 * @returns Promise with payment stats or error
 */
export async function getPaymentStats(): Promise<{
  data: PaymentStats | null;
  error: string | null;
}> {
  try {
    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      return { data: null, error: sessionError.message };
    }
    
    if (!session) {
      return { data: null, error: 'No active session' };
    }

    // Call database function to get payment stats
    const { data, error } = await supabase
      .rpc('get_payment_stats_for_user', { p_user_id: session.user.id });

    if (error) {
      console.error('Error fetching payment stats:', error);
      return { data: null, error: error.message };
    }

    // The function returns an array with a single row
    const stats = Array.isArray(data) && data.length > 0 ? data[0] : data;

    return { data: stats, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch payment stats';
    console.error('Error in getPaymentStats:', err);
    return { data: null, error: message };
  }
}

/**
 * Check if a recurring item is past due
 * 
 * @param renewalDate - ISO date string (YYYY-MM-DD)
 * @returns True if the renewal date is before today
 */
export function isPastDue(renewalDate: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const renewal = new Date(renewalDate);
  renewal.setHours(0, 0, 0, 0);
  
  return renewal < today;
}

/**
 * Calculate days past due
 * 
 * @param renewalDate - ISO date string (YYYY-MM-DD)
 * @returns Number of days past due (0 if not past due)
 */
export function getDaysPastDue(renewalDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const renewal = new Date(renewalDate);
  renewal.setHours(0, 0, 0, 0);
  
  if (renewal >= today) {
    return 0;
  }
  
  const diffTime = today.getTime() - renewal.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

/**
 * Export all service functions as a single object
 */
export const pastDueService = {
  getPastDueItems,
  recordPayment,
  getPaymentHistory,
  getPaymentStats,
  isPastDue,
  getDaysPastDue,
};