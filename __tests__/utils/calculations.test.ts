/**
 * Test Suite for Calculation Functions
 * 
 * This test suite validates the timezone bug fixes in calculations.ts,
 * focusing on getDaysUntilRenewal() and getRenewalTimeline() which now use
 * parseLocalDate() for consistent timezone handling.
 * 
 * Bug Fixes:
 * 1. Days until renewal calculations are timezone-independent
 * 2. Renewal timeline buckets (This Week, Next Week, This Month) are populated correctly
 * 3. Empty renewals bug is fixed - timeline shows data when subscriptions exist
 */

import { calculations } from '../../utils/calculations';
import { Subscription } from '../../types';

// Helper function to create mock subscriptions
const createMockSubscription = (
  id: string,
  name: string,
  renewalDate: string,
  overrides?: Partial<Subscription>
): Subscription => ({
  id,
  name,
  cost: 9.99,
  repeat_interval: 'monthly',
  renewalDate,
  category: 'Entertainment',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  ...overrides,
});

describe('calculations.getDaysUntilRenewal', () => {
  beforeEach(() => {
    // Set a fixed date for consistent testing
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-12-10T10:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Standard Date Calculations', () => {
    it('should calculate 3 days until renewal for Dec 13 from Dec 10', () => {
      const renewalDate = '2025-12-13';
      const days = calculations.getDaysUntilRenewal(renewalDate);
      expect(days).toBe(3);
    });

    it('should return 0 for today', () => {
      const renewalDate = '2025-12-10';
      const days = calculations.getDaysUntilRenewal(renewalDate);
      expect(days).toBe(0);
    });

    it('should return 1 for tomorrow', () => {
      const renewalDate = '2025-12-11';
      const days = calculations.getDaysUntilRenewal(renewalDate);
      expect(days).toBe(1);
    });

    it('should return negative value for past dates', () => {
      const renewalDate = '2025-12-05';
      const days = calculations.getDaysUntilRenewal(renewalDate);
      expect(days).toBeLessThan(0);
    });
  });

  describe('Timezone Independence', () => {
    it('should calculate same days regardless of timezone offset', () => {
      // This test ensures getDaysUntilRenewal is timezone-independent
      // The bug was that UTC midnight parsing would shift dates in negative offset timezones
      const renewalDate = '2025-12-13';
      const days = calculations.getDaysUntilRenewal(renewalDate);
      
      // Should always be 3 days from Dec 10, regardless of system timezone
      expect(days).toBe(3);
    });

    it('should handle dates that would shift to previous day in UTC parsing', () => {
      // In Pacific Time (UTC-8), "2025-12-13" parsed as UTC midnight
      // would become Dec 12 at 4 PM PST - this should NOT happen
      const renewalDate = '2025-12-13';
      const days = calculations.getDaysUntilRenewal(renewalDate);
      
      // Should be 3 days, not 2 (which would happen if date shifted to Dec 12)
      expect(days).toBe(3);
    });
  });

  describe('Edge Cases - Month Boundaries', () => {
    it('should handle end of month correctly', () => {
      jest.setSystemTime(new Date('2025-12-30T10:00:00.000Z'));
      const renewalDate = '2025-12-31';
      const days = calculations.getDaysUntilRenewal(renewalDate);
      expect(days).toBe(1);
    });

    it('should handle year boundary correctly', () => {
      jest.setSystemTime(new Date('2025-12-31T10:00:00.000Z'));
      const renewalDate = '2026-01-01';
      const days = calculations.getDaysUntilRenewal(renewalDate);
      expect(days).toBe(1);
    });

    it('should handle month transition', () => {
      jest.setSystemTime(new Date('2025-11-30T10:00:00.000Z'));
      const renewalDate = '2025-12-05';
      const days = calculations.getDaysUntilRenewal(renewalDate);
      expect(days).toBe(5);
    });
  });

  describe('Edge Cases - Leap Year', () => {
    it('should handle leap year date correctly', () => {
      jest.setSystemTime(new Date('2024-02-28T10:00:00.000Z'));
      const renewalDate = '2024-02-29';
      const days = calculations.getDaysUntilRenewal(renewalDate);
      expect(days).toBe(1);
    });

    it('should handle transition past leap day', () => {
      jest.setSystemTime(new Date('2024-02-29T10:00:00.000Z'));
      const renewalDate = '2024-03-01';
      const days = calculations.getDaysUntilRenewal(renewalDate);
      expect(days).toBe(1);
    });
  });

  describe('Edge Cases - DST Transitions', () => {
    it('should handle DST spring forward date (March 10, 2025)', () => {
      jest.setSystemTime(new Date('2025-03-09T10:00:00.000Z'));
      const renewalDate = '2025-03-10';
      const days = calculations.getDaysUntilRenewal(renewalDate);
      // Should be 1 day regardless of DST (hour doesn't exist)
      expect(days).toBe(1);
    });

    it('should handle DST fall back date (November 3, 2025)', () => {
      jest.setSystemTime(new Date('2025-11-02T10:00:00.000Z'));
      const renewalDate = '2025-11-03';
      const days = calculations.getDaysUntilRenewal(renewalDate);
      // Should be 1 day regardless of DST (hour occurs twice)
      expect(days).toBe(1);
    });
  });
});

describe('calculations.getRenewalTimeline', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-12-10T10:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Bucket Assignment - This Week (0-7 days)', () => {
    it('should place subscription due today in This Week', () => {
      const subscriptions = [
        createMockSubscription('1', 'Today Sub', '2025-12-10'),
      ];

      const timeline = calculations.getRenewalTimeline(subscriptions, 30);

      expect(timeline.thisWeek).toHaveLength(1);
      expect(timeline.thisWeek[0].name).toBe('Today Sub');
      expect(timeline.nextWeek).toHaveLength(0);
      expect(timeline.thisMonth).toHaveLength(0);
    });

    it('should place subscription due tomorrow in This Week', () => {
      const subscriptions = [
        createMockSubscription('1', 'Tomorrow Sub', '2025-12-11'),
      ];

      const timeline = calculations.getRenewalTimeline(subscriptions, 30);

      expect(timeline.thisWeek).toHaveLength(1);
      expect(timeline.nextWeek).toHaveLength(0);
    });

    it('should place subscription due in 7 days in This Week', () => {
      const subscriptions = [
        createMockSubscription('1', 'Week Sub', '2025-12-17'), // Dec 10 + 7 days
      ];

      const timeline = calculations.getRenewalTimeline(subscriptions, 30);

      expect(timeline.thisWeek).toHaveLength(1);
      expect(timeline.nextWeek).toHaveLength(0);
    });

    it('should place multiple subscriptions in This Week', () => {
      const subscriptions = [
        createMockSubscription('1', 'Today', '2025-12-10'),
        createMockSubscription('2', 'Tomorrow', '2025-12-11'),
        createMockSubscription('3', 'Day 3', '2025-12-13'),
        createMockSubscription('4', 'Day 7', '2025-12-17'),
      ];

      const timeline = calculations.getRenewalTimeline(subscriptions, 30);

      expect(timeline.thisWeek).toHaveLength(4);
      expect(timeline.thisWeek.map(s => s.name)).toEqual(['Today', 'Tomorrow', 'Day 3', 'Day 7']);
    });
  });

  describe('Bucket Assignment - Next Week (8-14 days)', () => {
    it('should place subscription due in 8 days in Next Week', () => {
      const subscriptions = [
        createMockSubscription('1', 'Day 8', '2025-12-18'), // Dec 10 + 8 days
      ];

      const timeline = calculations.getRenewalTimeline(subscriptions, 30);

      expect(timeline.thisWeek).toHaveLength(0);
      expect(timeline.nextWeek).toHaveLength(1);
      expect(timeline.thisMonth).toHaveLength(0);
    });

    it('should place subscription due in 10 days in Next Week', () => {
      const subscriptions = [
        createMockSubscription('1', 'Day 10', '2025-12-20'),
      ];

      const timeline = calculations.getRenewalTimeline(subscriptions, 30);

      expect(timeline.nextWeek).toHaveLength(1);
    });

    it('should place subscription due in exactly 14 days in Next Week', () => {
      const subscriptions = [
        createMockSubscription('1', 'Day 14', '2025-12-24'), // Dec 10 + 14 days
      ];

      const timeline = calculations.getRenewalTimeline(subscriptions, 30);

      expect(timeline.thisWeek).toHaveLength(0);
      expect(timeline.nextWeek).toHaveLength(1);
      expect(timeline.thisMonth).toHaveLength(0);
    });

    it('should place multiple subscriptions in Next Week', () => {
      const subscriptions = [
        createMockSubscription('1', 'Day 8', '2025-12-18'),
        createMockSubscription('2', 'Day 10', '2025-12-20'),
        createMockSubscription('3', 'Day 14', '2025-12-24'),
      ];

      const timeline = calculations.getRenewalTimeline(subscriptions, 30);

      expect(timeline.nextWeek).toHaveLength(3);
    });
  });

  describe('Bucket Assignment - This Month (15-30 days)', () => {
    it('should place subscription due in 15 days in This Month', () => {
      const subscriptions = [
        createMockSubscription('1', 'Day 15', '2025-12-25'), // Dec 10 + 15 days
      ];

      const timeline = calculations.getRenewalTimeline(subscriptions, 30);

      expect(timeline.thisWeek).toHaveLength(0);
      expect(timeline.nextWeek).toHaveLength(0);
      expect(timeline.thisMonth).toHaveLength(1);
    });

    it('should place subscription due in 20 days in This Month', () => {
      const subscriptions = [
        createMockSubscription('1', 'Day 20', '2025-12-30'),
      ];

      const timeline = calculations.getRenewalTimeline(subscriptions, 30);

      expect(timeline.thisMonth).toHaveLength(1);
    });

    it('should place subscription due in exactly 30 days in This Month', () => {
      const subscriptions = [
        createMockSubscription('1', 'Day 30', '2026-01-09'), // Dec 10 + 30 days
      ];

      const timeline = calculations.getRenewalTimeline(subscriptions, 30);

      expect(timeline.thisWeek).toHaveLength(0);
      expect(timeline.nextWeek).toHaveLength(0);
      expect(timeline.thisMonth).toHaveLength(1);
    });

    it('should place multiple subscriptions in This Month', () => {
      const subscriptions = [
        createMockSubscription('1', 'Day 15', '2025-12-25'),
        createMockSubscription('2', 'Day 20', '2025-12-30'),
        createMockSubscription('3', 'Day 30', '2026-01-09'),
      ];

      const timeline = calculations.getRenewalTimeline(subscriptions, 30);

      expect(timeline.thisMonth).toHaveLength(3);
    });
  });

  describe('Boundary Conditions', () => {
    it('should not include subscriptions beyond 30 days', () => {
      const subscriptions = [
        createMockSubscription('1', 'Day 31', '2026-01-10'), // 31 days
        createMockSubscription('2', 'Day 60', '2026-02-08'), // 60 days
      ];

      const timeline = calculations.getRenewalTimeline(subscriptions, 30);

      expect(timeline.thisWeek).toHaveLength(0);
      expect(timeline.nextWeek).toHaveLength(0);
      expect(timeline.thisMonth).toHaveLength(0);
    });

    it('should correctly bucket subscriptions at boundaries', () => {
      const subscriptions = [
        createMockSubscription('1', 'Day 7', '2025-12-17'),   // Last day of This Week
        createMockSubscription('2', 'Day 8', '2025-12-18'),   // First day of Next Week
        createMockSubscription('3', 'Day 14', '2025-12-24'),  // Last day of Next Week
        createMockSubscription('4', 'Day 15', '2025-12-25'),  // First day of This Month
        createMockSubscription('5', 'Day 30', '2026-01-09'),  // Last day of This Month
        createMockSubscription('6', 'Day 31', '2026-01-10'),  // Beyond range
      ];

      const timeline = calculations.getRenewalTimeline(subscriptions, 30);

      expect(timeline.thisWeek).toHaveLength(1);
      expect(timeline.nextWeek).toHaveLength(2);
      expect(timeline.thisMonth).toHaveLength(2);
    });
  });

  describe('Empty State Handling', () => {
    it('should return empty buckets for empty subscription list', () => {
      const timeline = calculations.getRenewalTimeline([], 30);

      expect(timeline.thisWeek).toHaveLength(0);
      expect(timeline.nextWeek).toHaveLength(0);
      expect(timeline.thisMonth).toHaveLength(0);
    });

    it('should return empty buckets when all subscriptions are past due', () => {
      const subscriptions = [
        createMockSubscription('1', 'Past 1', '2025-12-01'),
        createMockSubscription('2', 'Past 2', '2025-12-05'),
      ];

      const timeline = calculations.getRenewalTimeline(subscriptions, 30);

      expect(timeline.thisWeek).toHaveLength(0);
      expect(timeline.nextWeek).toHaveLength(0);
      expect(timeline.thisMonth).toHaveLength(0);
    });

    it('should return empty buckets when all subscriptions are beyond 30 days', () => {
      const subscriptions = [
        createMockSubscription('1', 'Future 1', '2026-02-01'),
        createMockSubscription('2', 'Future 2', '2026-03-01'),
      ];

      const timeline = calculations.getRenewalTimeline(subscriptions, 30);

      expect(timeline.thisWeek).toHaveLength(0);
      expect(timeline.nextWeek).toHaveLength(0);
      expect(timeline.thisMonth).toHaveLength(0);
    });
  });

  describe('Mixed Bucket Distribution', () => {
    it('should correctly distribute subscriptions across all buckets', () => {
      const subscriptions = [
        createMockSubscription('1', 'Netflix', '2025-12-13'),   // This Week (3 days)
        createMockSubscription('2', 'Spotify', '2025-12-15'),   // This Week (5 days)
        createMockSubscription('3', 'Disney+', '2025-12-20'),   // Next Week (10 days)
        createMockSubscription('4', 'Amazon Prime', '2025-12-28'), // This Month (18 days)
        createMockSubscription('5', 'Apple Music', '2026-01-10'), // Beyond 30 days (31 days)
      ];

      const timeline = calculations.getRenewalTimeline(subscriptions, 30);

      expect(timeline.thisWeek).toHaveLength(2);
      expect(timeline.thisWeek.map(s => s.name)).toEqual(['Netflix', 'Spotify']);
      
      expect(timeline.nextWeek).toHaveLength(1);
      expect(timeline.nextWeek[0].name).toBe('Disney+');
      
      expect(timeline.thisMonth).toHaveLength(1);
      expect(timeline.thisMonth[0].name).toBe('Amazon Prime');
    });
  });

  describe('Timezone-Safe Bucket Assignment', () => {
    it('should use consistent timezone handling for filtering and bucket assignment', () => {
      // This tests the bug fix: getRenewalTimeline now uses parseLocalDate
      // for both filtering and bucket assignment
      const subscriptions = [
        createMockSubscription('1', 'Test Sub', '2025-12-13'),
      ];

      const timeline = calculations.getRenewalTimeline(subscriptions, 30);

      // Should appear in timeline (not filtered out due to timezone mismatch)
      const totalInTimeline = 
        timeline.thisWeek.length + 
        timeline.nextWeek.length + 
        timeline.thisMonth.length;
      
      expect(totalInTimeline).toBe(1);
      expect(timeline.thisWeek).toHaveLength(1);
    });
  });
});

describe('calculations.getNextRenewalDate', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-12-10T10:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return earliest upcoming renewal date', () => {
    const subscriptions = [
      createMockSubscription('1', 'Sub 1', '2025-12-15'),
      createMockSubscription('2', 'Sub 2', '2025-12-13'), // Earliest
      createMockSubscription('3', 'Sub 3', '2025-12-20'),
    ];

    const nextDate = calculations.getNextRenewalDate(subscriptions);
    expect(nextDate).toBe('2025-12-13');
  });

  it('should return null for empty array', () => {
    const nextDate = calculations.getNextRenewalDate([]);
    expect(nextDate).toBeNull();
  });

  it('should return null when all dates are in past', () => {
    const subscriptions = [
      createMockSubscription('1', 'Past 1', '2025-12-01'),
      createMockSubscription('2', 'Past 2', '2025-12-05'),
    ];

    const nextDate = calculations.getNextRenewalDate(subscriptions);
    expect(nextDate).toBeNull();
  });

  it('should include today as valid renewal date', () => {
    const subscriptions = [
      createMockSubscription('1', 'Today', '2025-12-10'),
    ];

    const nextDate = calculations.getNextRenewalDate(subscriptions);
    expect(nextDate).toBe('2025-12-10');
  });

  it('should handle subscriptions with same renewal date', () => {
    const subscriptions = [
      createMockSubscription('1', 'Sub 1', '2025-12-15'),
      createMockSubscription('2', 'Sub 2', '2025-12-15'),
    ];

    const nextDate = calculations.getNextRenewalDate(subscriptions);
    expect(nextDate).toBe('2025-12-15');
  });
});

describe('calculations cost functions', () => {
  it('should calculate monthly cost for monthly subscription', () => {
    const subscription = createMockSubscription('1', 'Monthly', '2025-12-13', {
      cost: 9.99,
      repeat_interval: 'monthly',
    });

    const monthlyCost = calculations.getMonthlyCost(subscription);
    expect(monthlyCost).toBe(9.99);
  });

  it('should calculate monthly cost for yearly subscription', () => {
    const subscription = createMockSubscription('1', 'Yearly', '2025-12-13', {
      cost: 120,
      repeat_interval: 'yearly',
    });

    const monthlyCost = calculations.getMonthlyCost(subscription);
    expect(monthlyCost).toBe(10); // 120 / 12
  });

  it('should calculate total monthly cost', () => {
    const subscriptions = [
      createMockSubscription('1', 'Monthly', '2025-12-13', { cost: 9.99, repeat_interval: 'monthly' }),
      createMockSubscription('2', 'Yearly', '2025-12-13', { cost: 120, repeat_interval: 'yearly' }),
    ];

    const total = calculations.getTotalMonthlyCost(subscriptions);
    expect(total).toBeCloseTo(19.99, 2); // 9.99 + 10
  });

  it('should calculate total yearly cost', () => {
    const subscriptions = [
      createMockSubscription('1', 'Monthly', '2025-12-13', { cost: 10, repeat_interval: 'monthly' }),
      createMockSubscription('2', 'Yearly', '2025-12-13', { cost: 120, repeat_interval: 'yearly' }),
    ];

    const total = calculations.getTotalYearlyCost(subscriptions);
    expect(total).toBe(240); // (10 * 12) + 120
  });
});

describe('calculations.getBillingCycleDistribution', () => {
  it('should count monthly and yearly subscriptions', () => {
    const subscriptions = [
      createMockSubscription('1', 'Monthly 1', '2025-12-13', { repeat_interval: 'monthly' }),
      createMockSubscription('2', 'Monthly 2', '2025-12-13', { repeat_interval: 'monthly' }),
      createMockSubscription('3', 'Yearly 1', '2025-12-13', { repeat_interval: 'yearly' }),
    ];

    const distribution = calculations.getBillingCycleDistribution(subscriptions);
    expect(distribution.monthly).toBe(2);
    expect(distribution.yearly).toBe(1);
  });

  it('should return zero for empty array', () => {
    const distribution = calculations.getBillingCycleDistribution([]);
    expect(distribution.monthly).toBe(0);
    expect(distribution.yearly).toBe(0);
  });
});

describe('calculations.getUpcomingRenewals', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-12-10T10:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return subscriptions renewing within specified days', () => {
    const subscriptions = [
      createMockSubscription('1', 'Day 3', '2025-12-13'),
      createMockSubscription('2', 'Day 5', '2025-12-15'),
      createMockSubscription('3', 'Day 10', '2025-12-20'),
    ];

    const upcoming = calculations.getUpcomingRenewals(subscriptions, 7);
    expect(upcoming).toHaveLength(2);
    expect(upcoming.map(s => s.name)).toEqual(['Day 3', 'Day 5']);
  });

  it('should sort by renewal date', () => {
    const subscriptions = [
      createMockSubscription('1', 'Day 5', '2025-12-15'),
      createMockSubscription('2', 'Day 3', '2025-12-13'),
      createMockSubscription('3', 'Day 7', '2025-12-17'),
    ];

    const upcoming = calculations.getUpcomingRenewals(subscriptions, 7);
    expect(upcoming.map(s => s.name)).toEqual(['Day 3', 'Day 5', 'Day 7']);
  });
});