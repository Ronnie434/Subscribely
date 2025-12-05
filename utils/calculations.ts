import { Subscription } from '../types';
import { parseLocalDate } from './dateHelpers';
import {
  calculateMonthlyCost as getMonthlyFromInterval,
  calculateYearlyCost as getYearlyFromInterval,
  isRecurring,
  convertToRepeatInterval
} from './repeatInterval';

export const calculations = {
  getMonthlyCost(subscription: Subscription): number {
    // Use new repeat_interval if available, otherwise fall back to legacy fields
    if (subscription.repeat_interval) {
      return getMonthlyFromInterval(subscription.cost, subscription.repeat_interval);
    }
    
    // LEGACY: Support old charge_type and billing_cycle fields
    // One-time charges don't contribute to monthly recurring costs
    if (subscription.chargeType === 'one_time') {
      return 0;
    }
    
    if (subscription.billingCycle === 'monthly') {
      return subscription.cost;
    }
    return subscription.cost / 12;
  },

  getDisplayCost(subscription: Subscription): number {
    // Use new repeat_interval if available
    if (subscription.repeat_interval) {
      return subscription.repeat_interval === 'never'
        ? subscription.cost
        : getMonthlyFromInterval(subscription.cost, subscription.repeat_interval);
    }
    
    // LEGACY: Support old charge_type field
    // For one-time charges, show the actual cost
    if (subscription.chargeType === 'one_time') {
      return subscription.cost;
    }
    // For recurring charges, show monthly equivalent
    return this.getMonthlyCost(subscription);
  },

  getTotalMonthlyCost(subscriptions: Subscription[]): number {
    return subscriptions.reduce((total, sub) => {
      return total + this.getMonthlyCost(sub);
    }, 0);
  },

  getTotalYearlyCost(subscriptions: Subscription[]): number {
    return subscriptions.reduce((total, sub) => {
      // One-time charges don't contribute to yearly recurring costs
      if (sub.chargeType === 'one_time') {
        return total;
      }
      
      if (sub.billingCycle === 'yearly') {
        return total + sub.cost;
      }
      return total + sub.cost * 12;
    }, 0);
  },

  getCategoryBreakdown(subscriptions: Subscription[]): Record<string, number> {
    const breakdown: Record<string, number> = {};
    
    subscriptions.forEach((sub) => {
      const monthlyCost = this.getMonthlyCost(sub);
      breakdown[sub.category] = (breakdown[sub.category] || 0) + monthlyCost;
    });
    
    return breakdown;
  },

  getDaysUntilRenewal(renewalDate: string): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Use parseLocalDate to prevent timezone conversion issues
    // "2025-12-13" should be treated as Dec 13 local time, not UTC midnight
    const renewal = parseLocalDate(renewalDate);
    renewal.setHours(0, 0, 0, 0);
    
    const diffTime = renewal.getTime() - today.getTime();
    // Use Math.round instead of Math.ceil to handle DST transitions correctly
    // During DST fall back, there are 25 hours between two midnights, not 24
    // Math.round(25/24) = 1 (correct), Math.ceil(25/24) = 2 (incorrect)
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  },

  getUpcomingRenewals(subscriptions: Subscription[], days: number = 7): Subscription[] {
    return subscriptions
      .filter((sub) => {
        // Only include recurring charges in upcoming renewals
        if (sub.chargeType === 'one_time') {
          return false;
        }
        const daysUntil = this.getDaysUntilRenewal(sub.renewalDate);
        return daysUntil >= 0 && daysUntil <= days;
      })
      .sort((a, b) => {
        return this.getDaysUntilRenewal(a.renewalDate) - this.getDaysUntilRenewal(b.renewalDate);
      });
  },

  // New utility functions for Statistics screen

  getBillingCycleDistribution(subscriptions: Subscription[]): { monthly: number; yearly: number } {
    return subscriptions.reduce(
      (acc, sub) => {
        // Use repeat_interval if available, otherwise fall back to legacy billingCycle
        const interval = sub.repeat_interval || convertToRepeatInterval(sub.chargeType, sub.billingCycle);
        
        if (interval === 'yearly') {
          acc.yearly += 1;
        } else if (interval !== 'never') {
          acc.monthly += 1;
        }
        return acc;
      },
      { monthly: 0, yearly: 0 }
    );
  },

  getRepeatIntervalDistribution(subscriptions: Subscription[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    
    subscriptions.forEach((sub) => {
      // Use repeat_interval if available, otherwise fall back to legacy fields
      const interval = sub.repeat_interval || convertToRepeatInterval(sub.chargeType, sub.billingCycle);
      distribution[interval] = (distribution[interval] || 0) + 1;
    });
    
    return distribution;
  },

  getRecurringVsOneTimeCount(subscriptions: Subscription[]): { recurring: number; oneTime: number } {
    return subscriptions.reduce(
      (acc, sub) => {
        // Use repeat_interval if available, otherwise fall back to legacy chargeType
        const interval = sub.repeat_interval || convertToRepeatInterval(sub.chargeType, sub.billingCycle);
        
        if (interval === 'never') {
          acc.oneTime += 1;
        } else {
          acc.recurring += 1;
        }
        return acc;
      },
      { recurring: 0, oneTime: 0 }
    );
  },

  getAverageMonthlyCost(subscriptions: Subscription[]): number {
    if (subscriptions.length === 0) return 0;
    const total = this.getTotalMonthlyCost(subscriptions);
    return total / subscriptions.length;
  },

  getNextRenewalDate(subscriptions: Subscription[]): string | null {
    if (subscriptions.length === 0) return null;
    
    const upcoming = subscriptions
      .filter((sub) => this.getDaysUntilRenewal(sub.renewalDate) >= 0)
      .sort((a, b) => this.getDaysUntilRenewal(a.renewalDate) - this.getDaysUntilRenewal(b.renewalDate));
    
    return upcoming.length > 0 ? upcoming[0].renewalDate : null;
  },

  getRenewalTimeline(subscriptions: Subscription[], days: number = 30): {
    thisWeek: Subscription[];
    nextWeek: Subscription[];
    thisMonth: Subscription[];
  } {
    const now = new Date();
    const thisWeekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const nextWeekEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const thisMonthEnd = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    // Filter subscriptions within the time window using getDaysUntilRenewal
    // which now uses parseLocalDate for consistent timezone handling
    const upcoming = subscriptions.filter((sub) => {
      const daysUntil = this.getDaysUntilRenewal(sub.renewalDate);
      return daysUntil >= 0 && daysUntil <= days;
    });

    return {
      thisWeek: upcoming.filter((sub) => {
        // Use parseLocalDate for consistent timezone handling in bucket assignment
        const renewalDate = parseLocalDate(sub.renewalDate);
        return renewalDate <= thisWeekEnd;
      }),
      nextWeek: upcoming.filter((sub) => {
        const renewalDate = parseLocalDate(sub.renewalDate);
        return renewalDate > thisWeekEnd && renewalDate <= nextWeekEnd;
      }),
      thisMonth: upcoming.filter((sub) => {
        const renewalDate = parseLocalDate(sub.renewalDate);
        return renewalDate > nextWeekEnd && renewalDate <= thisMonthEnd;
      }),
    };
  },

  getCategorySorted(subscriptions: Subscription[]): Array<{ category: string; total: number; percentage: number }> {
    const breakdown = this.getCategoryBreakdown(subscriptions);
    const totalCost = this.getTotalMonthlyCost(subscriptions);
    
    return Object.entries(breakdown)
      .map(([category, total]) => ({
        category,
        total,
        percentage: totalCost > 0 ? (total / totalCost) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  },

  calculatePotentialSavings(subscriptions: Subscription[]): number {
    // Calculate potential savings by switching shorter intervals to yearly (assuming 15% discount)
    const eligibleSubs = subscriptions.filter((sub) => {
      const interval = sub.repeat_interval || convertToRepeatInterval(sub.chargeType, sub.billingCycle);
      // Only include recurring items that aren't already yearly
      return interval !== 'never' && interval !== 'yearly';
    });
    
    const yearlyEquivalentCost = eligibleSubs.reduce((total, sub) => {
      const interval = sub.repeat_interval || convertToRepeatInterval(sub.chargeType, sub.billingCycle);
      return total + getYearlyFromInterval(sub.cost, interval);
    }, 0);
    
    const potentialYearlyCost = yearlyEquivalentCost * 0.85; // 15% discount
    return yearlyEquivalentCost - potentialYearlyCost;
  },

  getNextRenewalCost(subscriptions: Subscription[]): number {
    if (subscriptions.length === 0) return 0;
    
    // Find the subscription with the nearest renewal date
    const upcoming = subscriptions
      .filter((sub) => {
        const interval = sub.repeat_interval || convertToRepeatInterval(sub.chargeType, sub.billingCycle);
        return this.getDaysUntilRenewal(sub.renewalDate) >= 0 && interval !== 'never';
      })
      .sort((a, b) => this.getDaysUntilRenewal(a.renewalDate) - this.getDaysUntilRenewal(b.renewalDate));
    
    return upcoming.length > 0 ? upcoming[0].cost : 0;
  },

  generateInsights(subscriptions: Subscription[]): Array<{ type: string; message: string; priority: 'high' | 'medium' | 'low' }> {
    const insights: Array<{ type: string; message: string; priority: 'high' | 'medium' | 'low' }> = [];
    
    if (subscriptions.length === 0) {
      return insights;
    }

    // Check for potential yearly savings
    const eligibleForYearlySavings = subscriptions.filter((sub) => {
      const interval = sub.repeat_interval || convertToRepeatInterval(sub.chargeType, sub.billingCycle);
      return interval !== 'never' && interval !== 'yearly';
    });
    
    if (eligibleForYearlySavings.length > 0) {
      const savings = this.calculatePotentialSavings(subscriptions);
      if (savings > 10) {
        insights.push({
          type: 'savings',
          message: `Switch ${eligibleForYearlySavings.length} item${eligibleForYearlySavings.length > 1 ? 's' : ''} to yearly billing and save up to $${savings.toFixed(2)}/year`,
          priority: 'high',
        });
      }
    }

    // Check for high spending categories
    const categorySorted = this.getCategorySorted(subscriptions);
    if (categorySorted.length > 0 && categorySorted[0].percentage > 40) {
      insights.push({
        type: 'spending',
        message: `${categorySorted[0].category} accounts for ${categorySorted[0].percentage.toFixed(0)}% of your spending`,
        priority: 'medium',
      });
    }

    // Check for upcoming renewals
    const upcomingRenewals = this.getUpcomingRenewals(subscriptions, 7);
    if (upcomingRenewals.length > 0) {
      const totalRenewalCost = upcomingRenewals.reduce((sum, sub) => sum + sub.cost, 0);
      insights.push({
        type: 'renewal',
        message: `${upcomingRenewals.length} renewal${upcomingRenewals.length > 1 ? 's' : ''} coming up this week ($${totalRenewalCost.toFixed(2)})`,
        priority: 'high',
      });
    }

    // Check for high number of recurring items
    const recurringCount = this.getRecurringVsOneTimeCount(subscriptions).recurring;
    if (recurringCount > 10) {
      insights.push({
        type: 'count',
        message: `You have ${recurringCount} recurring items - consider reviewing for unused services`,
        priority: 'low',
      });
    }

    // Check for frequent short-interval subscriptions
    const intervalDist = this.getRepeatIntervalDistribution(subscriptions);
    const shortIntervalCount = (intervalDist.weekly || 0) + (intervalDist.biweekly || 0);
    if (shortIntervalCount >= 3) {
      insights.push({
        type: 'info',
        message: `You have ${shortIntervalCount} weekly/biweekly items. Consider if consolidation could save time`,
        priority: 'low',
      });
    }

    return insights.slice(0, 4); // Return top 4 insights
  },
};

