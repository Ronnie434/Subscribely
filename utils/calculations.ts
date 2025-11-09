import { Subscription } from '../types';

export const calculations = {
  getMonthlyCost(subscription: Subscription): number {
    if (subscription.billingCycle === 'monthly') {
      return subscription.cost;
    }
    return subscription.cost / 12;
  },

  getTotalMonthlyCost(subscriptions: Subscription[]): number {
    return subscriptions.reduce((total, sub) => {
      return total + this.getMonthlyCost(sub);
    }, 0);
  },

  getTotalYearlyCost(subscriptions: Subscription[]): number {
    return subscriptions.reduce((total, sub) => {
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
    
    const renewal = new Date(renewalDate);
    renewal.setHours(0, 0, 0, 0);
    
    const diffTime = renewal.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  },

  getUpcomingRenewals(subscriptions: Subscription[], days: number = 7): Subscription[] {
    return subscriptions
      .filter((sub) => {
        const daysUntil = this.getDaysUntilRenewal(sub.renewalDate);
        return daysUntil >= 0 && daysUntil <= days;
      })
      .sort((a, b) => {
        return this.getDaysUntilRenewal(a.renewalDate) - this.getDaysUntilRenewal(b.renewalDate);
      });
  },
};

