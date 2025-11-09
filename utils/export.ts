import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Subscription } from '../types';
import { calculations } from './calculations';
import { dateHelpers } from './dateHelpers';

export const exportUtils = {
  async generateCSV(subscriptions: Subscription[]): Promise<string> {
    const headers = ['Name', 'Category', 'Cost', 'Billing Cycle', 'Monthly Cost', 'Renewal Date', 'Days Until Renewal'];
    const rows = subscriptions.map((sub) => {
      const monthlyCost = calculations.getMonthlyCost(sub);
      const daysUntil = calculations.getDaysUntilRenewal(sub.renewalDate);
      return [
        sub.name,
        sub.category,
        `$${sub.cost.toFixed(2)}`,
        sub.billingCycle,
        `$${monthlyCost.toFixed(2)}`,
        dateHelpers.formatDate(sub.renewalDate),
        daysUntil.toString(),
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
      '',
      `Total Monthly Cost,$${calculations.getTotalMonthlyCost(subscriptions).toFixed(2)}`,
      `Total Yearly Cost,$${calculations.getTotalYearlyCost(subscriptions).toFixed(2)}`,
    ].join('\n');

    return csvContent;
  },

  async exportToFile(subscriptions: Subscription[]): Promise<string | null> {
    try {
      const csvContent = await this.generateCSV(subscriptions);
      const fileName = `subscriptions_${new Date().toISOString().split('T')[0]}.csv`;
      // @ts-ignore - cacheDirectory exists in expo-file-system at runtime
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
      
      await FileSystem.writeAsStringAsync(fileUri, csvContent);
      
      return fileUri;
    } catch (error) {
      console.error('Error exporting to file:', error);
      return null;
    }
  },

  async shareCSV(subscriptions: Subscription[]): Promise<boolean> {
    try {
      const fileUri = await this.exportToFile(subscriptions);
      if (!fileUri) {
        return false;
      }

      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        console.error('Sharing is not available on this platform');
        return false;
      }

      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: 'Export Subscriptions',
      });

      return true;
    } catch (error) {
      console.error('Error sharing CSV:', error);
      return false;
    }
  },
};

