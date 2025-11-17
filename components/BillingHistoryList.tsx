import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Linking,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../config/supabase';
import { formatDate } from '../utils/dateHelpers';
import EmptyState from './EmptyState';

interface Transaction {
  id: string;
  amount: number;
  currency: string;
  status: 'succeeded' | 'failed' | 'refunded';
  created_at: string;
  stripe_invoice_id?: string;
  stripe_payment_intent_id: string;
}

export default function BillingHistoryList() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async (isRefresh = false) => {
    if (!user) return;

    try {
      if (!isRefresh) setLoading(true);

      // Query payment_transactions table
      const { data, error } = await supabase
        .from('payment_transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      setTransactions(data || []);
    } catch (error) {
      console.error('Error loading transactions:', error);
      Alert.alert('Error', 'Failed to load billing history');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadTransactions(true);
  };

  const handleDownloadInvoice = async (transaction: Transaction) => {
    if (!transaction.stripe_invoice_id) {
      Alert.alert('Unavailable', 'Invoice not available for this transaction');
      return;
    }

    try {
      // In a real implementation, you would fetch the invoice URL from your backend
      // For now, we'll show a placeholder message
      Alert.alert(
        'Invoice Download',
        'Invoice download will be available soon. Please contact support if you need your invoice immediately.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error downloading invoice:', error);
      Alert.alert('Error', 'Failed to download invoice');
    }
  };

  const getStatusColor = (status: Transaction['status']) => {
    switch (status) {
      case 'succeeded':
        return theme.colors.success;
      case 'failed':
        return theme.colors.error;
      case 'refunded':
        return theme.colors.warning;
      default:
        return theme.colors.textSecondary;
    }
  };

  const getStatusIcon = (status: Transaction['status']) => {
    switch (status) {
      case 'succeeded':
        return 'checkmark-circle';
      case 'failed':
        return 'close-circle';
      case 'refunded':
        return 'arrow-undo-circle';
      default:
        return 'help-circle';
    }
  };

  const getStatusText = (status: Transaction['status']) => {
    switch (status) {
      case 'succeeded':
        return 'Paid';
      case 'failed':
        return 'Failed';
      case 'refunded':
        return 'Refunded';
      default:
        return 'Unknown';
    }
  };

  const renderTransaction = ({ item }: { item: Transaction }) => {
    return (
      <View style={styles.transactionCard}>
        <View style={styles.transactionHeader}>
          <View style={styles.transactionLeft}>
            <View
              style={[
                styles.statusIcon,
                { backgroundColor: `${getStatusColor(item.status)}20` },
              ]}>
              <Ionicons
                name={getStatusIcon(item.status) as any}
                size={24}
                color={getStatusColor(item.status)}
              />
            </View>
            <View style={styles.transactionInfo}>
              <Text style={styles.transactionAmount}>
                ${(item.amount / 100).toFixed(2)} {item.currency.toUpperCase()}
              </Text>
              <Text style={styles.transactionDate}>
                {formatDate(new Date(item.created_at))}
              </Text>
            </View>
          </View>
          <View style={styles.statusBadge}>
            <Text
              style={[
                styles.statusText,
                { color: getStatusColor(item.status) },
              ]}>
              {getStatusText(item.status)}
            </Text>
          </View>
        </View>

        {item.stripe_invoice_id && item.status === 'succeeded' && (
          <TouchableOpacity
            style={styles.downloadButton}
            onPress={() => handleDownloadInvoice(item)}
            activeOpacity={0.7}>
            <Ionicons
              name="download-outline"
              size={16}
              color={theme.colors.primary}
            />
            <Text style={styles.downloadButtonText}>Download Invoice</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const styles = StyleSheet.create({
    container: {
      marginTop: 16,
    },
    transactionCard: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
    },
    transactionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    transactionLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    statusIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    transactionInfo: {
      flex: 1,
    },
    transactionAmount: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 2,
    },
    transactionDate: {
      fontSize: 14,
      fontWeight: '400',
      color: theme.colors.textSecondary,
    },
    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: theme.isDark
        ? 'rgba(255, 255, 255, 0.05)'
        : 'rgba(0, 0, 0, 0.03)',
    },
    statusText: {
      fontSize: 13,
      fontWeight: '600',
    },
    downloadButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: `${theme.colors.primary}10`,
      marginTop: 8,
    },
    downloadButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.primary,
      marginLeft: 6,
    },
    emptyContainer: {
      paddingVertical: 40,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 16,
      fontWeight: '400',
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginTop: 12,
    },
    loadingContainer: {
      paddingVertical: 40,
      alignItems: 'center',
    },
  });

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (transactions.length === 0) {
    return (
      <View style={[styles.container, styles.emptyContainer]}>
        <Ionicons
          name="receipt-outline"
          size={48}
          color={theme.colors.textSecondary}
        />
        <Text style={styles.emptyText}>
          No billing history yet
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={renderTransaction}
        scrollEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
          />
        }
      />
    </View>
  );
}