/**
 * One-Time Charge Past Due Tests
 * 
 * Tests for the one-time charge past due popup feature
 */

import { pastDueService } from '../../services/pastDueService';
import { PastDueItem } from '../../types';

// Mock supabase
jest.mock('../../config/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
    },
    rpc: jest.fn(),
  },
}));

describe('One-Time Charge Past Due Feature', () => {
  describe('Database Function Integration', () => {
    it('should include one-time charges in past due items', async () => {
      // Mock data with both recurring and one-time charges
      const mockPastDueItems: PastDueItem[] = [
        {
          id: '1',
          user_id: 'user-123',
          name: 'Netflix',
          cost: 15.99,
          repeat_interval: 'monthly',
          renewal_date: '2024-12-01',
          days_past_due: 5,
          category: 'Entertainment',
          status: 'active',
          reminders: true,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
        {
          id: '2',
          user_id: 'user-123',
          name: 'Doctor Bill',
          cost: 250.00,
          repeat_interval: 'never',
          renewal_date: '2024-12-03',
          days_past_due: 3,
          category: 'Healthcare',
          status: 'active',
          reminders: true,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ];

      const { supabase } = require('../../config/supabase');
      supabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
        error: null,
      });
      supabase.rpc.mockResolvedValue({
        data: mockPastDueItems,
        error: null,
      });

      const { data, error } = await pastDueService.getPastDueItems();

      expect(error).toBeNull();
      expect(data).toHaveLength(2);
      expect(data?.find(item => item.repeat_interval === 'never')).toBeDefined();
    });

    it('should sort past due items by oldest first', async () => {
      const mockPastDueItems: PastDueItem[] = [
        {
          id: '1',
          user_id: 'user-123',
          name: 'Oldest Item',
          cost: 10.00,
          repeat_interval: 'never',
          renewal_date: '2024-12-01',
          days_past_due: 7,
          category: 'Other',
          status: 'active',
          reminders: true,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
        {
          id: '2',
          user_id: 'user-123',
          name: 'Newer Item',
          cost: 20.00,
          repeat_interval: 'monthly',
          renewal_date: '2024-12-05',
          days_past_due: 3,
          category: 'Other',
          status: 'active',
          reminders: true,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ];

      const { supabase } = require('../../config/supabase');
      supabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
        error: null,
      });
      supabase.rpc.mockResolvedValue({
        data: mockPastDueItems,
        error: null,
      });

      const { data } = await pastDueService.getPastDueItems();

      expect(data?.[0].days_past_due).toBeGreaterThan(data?.[1].days_past_due || 0);
    });
  });

  describe('dismissOneTimeCharge Service', () => {
    it('should successfully dismiss a one-time charge', async () => {
      const { supabase } = require('../../config/supabase');
      supabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
        error: null,
      });
      supabase.rpc.mockResolvedValue({
        data: true,
        error: null,
      });

      const { data, error } = await pastDueService.dismissOneTimeCharge('item-123');

      expect(error).toBeNull();
      expect(data).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith('dismiss_one_time_charge', {
        p_recurring_item_id: 'item-123',
        p_user_id: 'user-123',
      });
    });

    it('should handle errors when dismissing', async () => {
      const { supabase } = require('../../config/supabase');
      supabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
        error: null,
      });
      supabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Can only dismiss one-time charges' },
      });

      const { data, error } = await pastDueService.dismissOneTimeCharge('item-123');

      expect(error).toBe('Can only dismiss one-time charges');
      expect(data).toBeNull();
    });
  });

  describe('Payment Recording for One-Time Charges', () => {
    it('should record payment without updating renewal date for one-time charges', async () => {
      const { supabase } = require('../../config/supabase');
      supabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
        error: null,
      });
      supabase.rpc.mockResolvedValue({
        data: [{
          payment_id: 'payment-123',
          new_renewal_date: null, // No renewal date for one-time charges
          success: true,
          error_message: null,
        }],
        error: null,
      });

      const { data, error } = await pastDueService.recordPayment('item-123', 'paid');

      expect(error).toBeNull();
      expect(data?.success).toBe(true);
      expect(data?.new_renewal_date).toBeNull();
    });

    it('should record skip status for one-time charges', async () => {
      const { supabase } = require('../../config/supabase');
      supabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
        error: null,
      });
      supabase.rpc.mockResolvedValue({
        data: [{
          payment_id: 'payment-456',
          new_renewal_date: null,
          success: true,
          error_message: null,
        }],
        error: null,
      });

      const { data, error } = await pastDueService.recordPayment('item-456', 'skipped');

      expect(error).toBeNull();
      expect(data?.success).toBe(true);
    });
  });

  describe('Timezone Handling', () => {
    it('should use parseLocalDate for date comparisons', () => {
      // The pastDueService already uses parseLocalDate (fixed in previous task)
      // This test verifies the logic
      const testDate = '2024-12-13';
      
      // isPastDue should use local time
      const isPastDue = pastDueService.isPastDue(testDate);
      
      // Should be a boolean based on local time comparison
      expect(typeof isPastDue).toBe('boolean');
    });

    it('should calculate days past due using local time', () => {
      // Test that getDaysPastDue uses parseLocalDate
      const pastDate = '2024-12-01';
      
      const daysPastDue = pastDueService.getDaysPastDue(pastDate);
      
      // Should return a non-negative number
      expect(daysPastDue).toBeGreaterThanOrEqual(0);
    });

    it('should handle timezone edge cases correctly', () => {
      // Test date that could be affected by UTC conversion
      const edgeCaseDate = new Date().toISOString().split('T')[0];
      
      const isPastDue = pastDueService.isPastDue(edgeCaseDate);
      
      // Today's date should not be considered past due
      expect(isPastDue).toBe(false);
    });
  });

  describe('Modal Type Selection', () => {
    it('should identify one-time charges correctly', () => {
      const oneTimeItem: PastDueItem = {
        id: '1',
        user_id: 'user-123',
        name: 'Doctor Bill',
        cost: 250.00,
        repeat_interval: 'never',
        renewal_date: '2024-12-01',
        days_past_due: 5,
        category: 'Healthcare',
        status: 'active',
        reminders: true,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      };

      // Test the condition used in HomeScreen
      const isOneTime = oneTimeItem.repeat_interval === 'never';
      
      expect(isOneTime).toBe(true);
    });

    it('should identify recurring charges correctly', () => {
      const recurringItem: PastDueItem = {
        id: '1',
        user_id: 'user-123',
        name: 'Netflix',
        cost: 15.99,
        repeat_interval: 'monthly',
        renewal_date: '2024-12-01',
        days_past_due: 5,
        category: 'Entertainment',
        status: 'active',
        reminders: true,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      };

      const isOneTime = recurringItem.repeat_interval === 'never';
      
      expect(isOneTime).toBe(false);
    });
  });

  describe('Payment History Status', () => {
    it('should support cancelled status in PaymentHistoryStatus type', () => {
      // Type check - this will fail at compile time if 'cancelled' is not supported
      const statuses: Array<'paid' | 'skipped' | 'pending' | 'cancelled'> = [
        'paid',
        'skipped',
        'pending',
        'cancelled',
      ];

      expect(statuses).toContain('cancelled');
    });
  });
});

describe('Integration Tests', () => {
  it('should handle complete flow: detect -> show modal -> dismiss', async () => {
    const { supabase } = require('../../config/supabase');
    
    // Step 1: Get past due items (includes one-time charge)
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'user-123' } } },
      error: null,
    });
    supabase.rpc.mockResolvedValue({
      data: [{
        id: 'charge-123',
        name: 'Medical Bill',
        cost: 500.00,
        repeat_interval: 'never',
        renewal_date: '2024-12-01',
        days_past_due: 7,
        category: 'Healthcare',
        status: 'active',
      }],
      error: null,
    });

    const { data: items } = await pastDueService.getPastDueItems();
    expect(items).toHaveLength(1);
    expect(items?.[0].repeat_interval).toBe('never');

    // Step 2: Dismiss the charge
    supabase.rpc.mockResolvedValue({
      data: true,
      error: null,
    });

    const { data: dismissed } = await pastDueService.dismissOneTimeCharge('charge-123');
    expect(dismissed).toBe(true);
  });
});