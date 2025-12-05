import * as XLSX from 'xlsx';
import { File, Directory, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Subscription } from '../types';
import { calculations } from './calculations';
import { getIntervalLabel } from './repeatInterval';
import { parseLocalDate } from './dateHelpers';

/**
 * Export subscriptions to Excel file
 * @param subscriptions Array of subscriptions to export
 * @returns Promise<void>
 */
export async function exportSubscriptionsToExcel(subscriptions: Subscription[]): Promise<void> {
  try {
    // Prepare data for Excel
    const excelData = subscriptions.map((sub) => {
      const interval = sub.repeat_interval || 'monthly';
      const monthlyCost = calculations.getMonthlyCost(sub);
      const renewalDate = parseLocalDate(sub.renewalDate);
      
      return {
        'Name': sub.name,
        'Cost': `$${sub.cost.toFixed(2)}`,
        'Repeat Interval': getIntervalLabel(interval),
        'Monthly Equivalent': `$${monthlyCost.toFixed(2)}`,
        'Category': sub.category,
        'Renewal Date': renewalDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        }),
        'Status': sub.chargeType === 'one_time' ? 'One-Time' : 'Recurring',
        'Description': sub.description || ''
      };
    });

    // Add summary row
    const totalMonthly = calculations.getTotalMonthlyCost(subscriptions);
    const totalYearly = calculations.getTotalYearlyCost(subscriptions);
    
    excelData.push({
      'Name': '',
      'Cost': '',
      'Repeat Interval': '',
      'Monthly Equivalent': '',
      'Category': '',
      'Renewal Date': '',
      'Status': '',
      'Description': ''
    });
    
    excelData.push({
      'Name': 'SUMMARY',
      'Cost': '',
      'Repeat Interval': '',
      'Monthly Equivalent': `$${totalMonthly.toFixed(2)}`,
      'Category': 'Total Monthly',
      'Renewal Date': '',
      'Status': '',
      'Description': ''
    });
    
    excelData.push({
      'Name': '',
      'Cost': '',
      'Repeat Interval': '',
      'Monthly Equivalent': `$${totalYearly.toFixed(2)}`,
      'Category': 'Total Yearly',
      'Renewal Date': '',
      'Status': '',
      'Description': ''
    });

    // Create workbook and worksheet
    const ws = XLSX.utils.json_to_sheet(excelData);
    
    // Set column widths
    ws['!cols'] = [
      { wch: 25 }, // Name
      { wch: 10 }, // Cost
      { wch: 18 }, // Repeat Interval
      { wch: 18 }, // Monthly Equivalent
      { wch: 15 }, // Category
      { wch: 15 }, // Renewal Date
      { wch: 12 }, // Status
      { wch: 30 }  // Description
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Subscriptions');

    // Generate Excel file as base64
    const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    
    // Create file using new FileSystem API
    const fileName = `subscriptions_${new Date().toISOString().split('T')[0]}.xlsx`;
    const cacheDir = new Directory(Paths.cache);
    const file = new File(cacheDir, fileName);

    // Write base64 content to file
    await file.write(wbout, { encoding: 'base64' });

    // Share file
    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Export Subscriptions',
        UTI: 'com.microsoft.excel.xlsx'
      });
    } else {
      throw new Error('Sharing is not available on this device');
    }
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    throw error;
  }
}