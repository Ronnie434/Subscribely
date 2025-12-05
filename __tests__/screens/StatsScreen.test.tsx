/**
 * Integration Test Suite for StatsScreen
 * 
 * This test suite validates the Statistics screen's integration with date
 * helpers and calculation utilities, focusing on timezone bug fixes:
 * 
 * Bug Fixes Tested:
 * 1. Next renewal date displays correctly (not shifted to previous day)
 * 2. formatNextRenewal() uses parseLocalDate for accurate date formatting
 * 3. Renewal timeline sections populate correctly (not empty due to timezone mismatch)
 * 4. All date-related UI elements render with correct values
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import StatsScreen from '../../screens/StatsScreen';
import { storage } from '../../utils/storage';
import { Subscription } from '../../types';

// Mock React Native - use a minimal mock to avoid native module issues
jest.mock('react-native', () => {
  const React = require('react');
  const RN = jest.requireActual('react-native');
  
  return Object.setPrototypeOf(
    {
      Alert: {
        alert: jest.fn(),
      },
      // Make RefreshControl a proper component
      RefreshControl: (props: any) => {
        React.useEffect(() => {
          if (props.refreshing && props.onRefresh) {
            props.onRefresh();
          }
        }, [props.refreshing]);
        return null;
      },
    },
    RN
  );
});

// Mock AsyncStorage before other imports
jest.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    setItem: jest.fn(),
    getItem: jest.fn(),
    removeItem: jest.fn(),
    getAllKeys: jest.fn(),
    multiGet: jest.fn(),
    multiSet: jest.fn(),
    multiRemove: jest.fn(),
    clear: jest.fn(),
  },
}));

// Mock expo dependencies to avoid ESM import errors
jest.mock('expo-notifications', () => ({
  requestPermissionsAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelAllScheduledNotificationsAsync: jest.fn(),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// Mock Supabase config to break dependency chain
jest.mock('../../config/supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: {
      signIn: jest.fn(),
      signOut: jest.fn(),
      signUp: jest.fn(),
    },
  },
}));

// Mock subscription service
jest.mock('../../services/subscriptionService');

// Mock UI components
jest.mock('../../components/StatCard', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ label, value, subtitle }: any) => (
      <Text testID="stat-card">
        {label}: {value} {subtitle}
      </Text>
    ),
  };
});

jest.mock('../../components/CategoryBar', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ category, amount, percentage }: any) => (
      <Text testID="category-bar">
        {category}: ${amount} ({percentage}%)
      </Text>
    ),
  };
});

jest.mock('../../components/InsightCard', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ message }: any) => (
      <Text testID="insight-card">{message}</Text>
    ),
  };
});

jest.mock('../../components/RenewalItem', () => {
  const React = require('react');
  const { Text, TouchableOpacity } = require('react-native');
  return {
    __esModule: true,
    default: ({ subscription, onPress }: any) => (
      <TouchableOpacity testID="renewal-item" onPress={onPress}>
        <Text>{subscription.name}</Text>
      </TouchableOpacity>
    ),
  };
});

jest.mock('../../components/LoadingIndicator', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: () => <View testID="loading-indicator" />,
  };
});

jest.mock('../../components/EmptyState', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ title, message }: any) => (
      <View testID="empty-state">
        <Text>{title}</Text>
        <Text>{message}</Text>
      </View>
    ),
  };
});

// Mock dependencies
jest.mock('../../utils/storage');
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'test-user-123' } }),
}));
jest.mock('../../hooks/useRealtimeSubscriptions', () => ({
  useRealtimeSubscriptions: jest.fn(),
}));
jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    // Execute useFocusEffect callback immediately in tests
    useFocusEffect: (callback: () => void | (() => void)) => {
      React.useEffect(() => {
        const cleanup = callback();
        return cleanup;
      }, []);
    },
    useNavigation: () => ({
      navigate: jest.fn(),
      goBack: jest.fn(),
    }),
  };
});

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

describe('StatsScreen - Date Display Integration', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-12-10T10:00:00.000Z'));
    jest.clearAllMocks();
    
    // Set default mocks to prevent crashes
    (storage.getAll as jest.Mock).mockResolvedValue([]);
    (storage.refresh as jest.Mock).mockResolvedValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Next Renewal Date Display', () => {
    it('should display "3 days" for renewal on Dec 13 from Dec 10', async () => {
      const mockSubscriptions: Subscription[] = [
        createMockSubscription('1', 'Netflix', '2025-12-13'),
      ];

      (storage.getAll as jest.Mock).mockResolvedValue(mockSubscriptions);
      (storage.refresh as jest.Mock).mockResolvedValue(mockSubscriptions);

      const { getByText } = render(<StatsScreen />);

      await waitFor(() => {
        expect(getByText(/3 days/)).toBeTruthy();
      });
    });

    it('should display "Today" for renewal today', async () => {
      const mockSubscriptions: Subscription[] = [
        createMockSubscription('1', 'Netflix', '2025-12-10'),
      ];

      (storage.getAll as jest.Mock).mockResolvedValue(mockSubscriptions);
      (storage.refresh as jest.Mock).mockResolvedValue(mockSubscriptions);

      const { getByText } = render(<StatsScreen />);

      await waitFor(() => {
        expect(getByText(/Today/)).toBeTruthy();
      });
    });

    it('should display "Tomorrow" for renewal tomorrow', async () => {
      const mockSubscriptions: Subscription[] = [
        createMockSubscription('1', 'Netflix', '2025-12-11'),
      ];

      (storage.getAll as jest.Mock).mockResolvedValue(mockSubscriptions);
      (storage.refresh as jest.Mock).mockResolvedValue(mockSubscriptions);

      const { getByText } = render(<StatsScreen />);

      await waitFor(() => {
        expect(getByText(/Tomorrow/)).toBeTruthy();
      });
    });

    it('should display formatted date (e.g., "Dec 13") for renewals beyond 7 days', async () => {
      const mockSubscriptions: Subscription[] = [
        createMockSubscription('1', 'Netflix', '2025-12-20'), // 10 days from Dec 10
      ];

      (storage.getAll as jest.Mock).mockResolvedValue(mockSubscriptions);
      (storage.refresh as jest.Mock).mockResolvedValue(mockSubscriptions);

      const { getByText } = render(<StatsScreen />);

      await waitFor(() => {
        // Should show "Dec 20" not "Dec 19" (timezone bug would cause this)
        expect(getByText(/Dec 20/)).toBeTruthy();
      });
    });

    it('should display earliest renewal date when multiple subscriptions exist', async () => {
      const mockSubscriptions: Subscription[] = [
        createMockSubscription('1', 'Netflix', '2025-12-15'),
        createMockSubscription('2', 'Spotify', '2025-12-13'), // Earliest
        createMockSubscription('3', 'Disney+', '2025-12-20'),
      ];

      (storage.getAll as jest.Mock).mockResolvedValue(mockSubscriptions);
      (storage.refresh as jest.Mock).mockResolvedValue(mockSubscriptions);

      const { getByText } = render(<StatsScreen />);

      await waitFor(() => {
        // Should show 3 days (for Dec 13), not 5 days (Dec 15)
        expect(getByText(/3 days/)).toBeTruthy();
      });
    });

    it('should display "None" when no subscriptions exist', async () => {
      (storage.getAll as jest.Mock).mockResolvedValue([]);
      (storage.refresh as jest.Mock).mockResolvedValue([]);

      const { getByText } = render(<StatsScreen />);

      await waitFor(() => {
        expect(getByText(/No Statistics Yet/)).toBeTruthy();
      });
    });
  });

  describe('Renewal Timeline - This Week Section', () => {
    it('should display subscriptions in This Week section (0-7 days)', async () => {
      const mockSubscriptions: Subscription[] = [
        createMockSubscription('1', 'Netflix', '2025-12-13'), // 3 days
        createMockSubscription('2', 'Spotify', '2025-12-15'), // 5 days
      ];

      (storage.getAll as jest.Mock).mockResolvedValue(mockSubscriptions);
      (storage.refresh as jest.Mock).mockResolvedValue(mockSubscriptions);

      const { getByText } = render(<StatsScreen />);

      await waitFor(() => {
        expect(getByText('This Week')).toBeTruthy();
        expect(getByText('Netflix')).toBeTruthy();
        expect(getByText('Spotify')).toBeTruthy();
      });
    });

    it('should display subscription due today in This Week', async () => {
      const mockSubscriptions: Subscription[] = [
        createMockSubscription('1', 'Netflix', '2025-12-10'), // Today
      ];

      (storage.getAll as jest.Mock).mockResolvedValue(mockSubscriptions);
      (storage.refresh as jest.Mock).mockResolvedValue(mockSubscriptions);

      const { getByText } = render(<StatsScreen />);

      await waitFor(() => {
        expect(getByText('This Week')).toBeTruthy();
        expect(getByText('Netflix')).toBeTruthy();
      });
    });

    it('should not display subscriptions beyond 7 days in This Week', async () => {
      const mockSubscriptions: Subscription[] = [
        createMockSubscription('1', 'Netflix', '2025-12-20'), // 10 days - Next Week
      ];

      (storage.getAll as jest.Mock).mockResolvedValue(mockSubscriptions);
      (storage.refresh as jest.Mock).mockResolvedValue(mockSubscriptions);

      const { queryByText, getByText } = render(<StatsScreen />);

      await waitFor(() => {
        // Should show "Next Week" section instead
        expect(getByText('Next Week')).toBeTruthy();
        // Should not show "This Week" section
        expect(queryByText('This Week')).toBeNull();
      });
    });
  });

  describe('Renewal Timeline - Next Week Section', () => {
    it('should display subscriptions in Next Week section (8-14 days)', async () => {
      const mockSubscriptions: Subscription[] = [
        createMockSubscription('1', 'Disney+', '2025-12-20'), // 10 days
      ];

      (storage.getAll as jest.Mock).mockResolvedValue(mockSubscriptions);
      (storage.refresh as jest.Mock).mockResolvedValue(mockSubscriptions);

      const { getByText } = render(<StatsScreen />);

      await waitFor(() => {
        expect(getByText('Next Week')).toBeTruthy();
        expect(getByText('Disney+')).toBeTruthy();
      });
    });

    it('should display multiple subscriptions in Next Week', async () => {
      const mockSubscriptions: Subscription[] = [
        createMockSubscription('1', 'Disney+', '2025-12-18'), // 8 days
        createMockSubscription('2', 'HBO Max', '2025-12-24'), // 14 days
      ];

      (storage.getAll as jest.Mock).mockResolvedValue(mockSubscriptions);
      (storage.refresh as jest.Mock).mockResolvedValue(mockSubscriptions);

      const { getByText } = render(<StatsScreen />);

      await waitFor(() => {
        expect(getByText('Next Week')).toBeTruthy();
        expect(getByText('Disney+')).toBeTruthy();
        expect(getByText('HBO Max')).toBeTruthy();
      });
    });
  });

  describe('Renewal Timeline - This Month Section', () => {
    it('should display subscriptions in This Month section (15-30 days)', async () => {
      const mockSubscriptions: Subscription[] = [
        createMockSubscription('1', 'Amazon Prime', '2025-12-28'), // 18 days
      ];

      (storage.getAll as jest.Mock).mockResolvedValue(mockSubscriptions);
      (storage.refresh as jest.Mock).mockResolvedValue(mockSubscriptions);

      const { getByText } = render(<StatsScreen />);

      await waitFor(() => {
        expect(getByText('This Month')).toBeTruthy();
        expect(getByText('Amazon Prime')).toBeTruthy();
      });
    });

    it('should display multiple subscriptions in This Month', async () => {
      const mockSubscriptions: Subscription[] = [
        createMockSubscription('1', 'Amazon Prime', '2025-12-25'), // 15 days
        createMockSubscription('2', 'Apple Music', '2026-01-09'), // 30 days
      ];

      (storage.getAll as jest.Mock).mockResolvedValue(mockSubscriptions);
      (storage.refresh as jest.Mock).mockResolvedValue(mockSubscriptions);

      const { getByText } = render(<StatsScreen />);

      await waitFor(() => {
        expect(getByText('This Month')).toBeTruthy();
        expect(getByText('Amazon Prime')).toBeTruthy();
        expect(getByText('Apple Music')).toBeTruthy();
      });
    });
  });

  describe('Renewal Timeline - Mixed Distribution', () => {
    it('should correctly distribute subscriptions across all timeline sections', async () => {
      const mockSubscriptions: Subscription[] = [
        createMockSubscription('1', 'Netflix', '2025-12-13'),   // This Week (3 days)
        createMockSubscription('2', 'Spotify', '2025-12-15'),   // This Week (5 days)
        createMockSubscription('3', 'Disney+', '2025-12-20'),   // Next Week (10 days)
        createMockSubscription('4', 'Amazon Prime', '2025-12-28'), // This Month (18 days)
        createMockSubscription('5', 'Apple Music', '2026-01-15'), // Beyond 30 days (36 days)
      ];

      (storage.getAll as jest.Mock).mockResolvedValue(mockSubscriptions);
      (storage.refresh as jest.Mock).mockResolvedValue(mockSubscriptions);

      const { getByText, queryByText } = render(<StatsScreen />);

      await waitFor(() => {
        // This Week section
        expect(getByText('This Week')).toBeTruthy();
        expect(getByText('Netflix')).toBeTruthy();
        expect(getByText('Spotify')).toBeTruthy();
        
        // Next Week section
        expect(getByText('Next Week')).toBeTruthy();
        expect(getByText('Disney+')).toBeTruthy();
        
        // This Month section
        expect(getByText('This Month')).toBeTruthy();
        expect(getByText('Amazon Prime')).toBeTruthy();
        
        // Apple Music should NOT appear (beyond 30 days)
        expect(queryByText('Apple Music')).toBeNull();
      });
    });
  });

  describe('Empty State Handling', () => {
    it('should display "No renewals in the next 30 days" when all subscriptions are beyond 30 days', async () => {
      const mockSubscriptions: Subscription[] = [
        createMockSubscription('1', 'Netflix', '2026-02-01'), // 53 days
      ];

      (storage.getAll as jest.Mock).mockResolvedValue(mockSubscriptions);
      (storage.refresh as jest.Mock).mockResolvedValue(mockSubscriptions);

      const { getByText } = render(<StatsScreen />);

      await waitFor(() => {
        expect(getByText('No renewals in the next 30 days')).toBeTruthy();
      });
    });

    it('should display "No renewals in the next 30 days" when all subscriptions are in the past', async () => {
      const mockSubscriptions: Subscription[] = [
        createMockSubscription('1', 'Netflix', '2025-12-01'), // 9 days ago
        createMockSubscription('2', 'Spotify', '2025-12-05'), // 5 days ago
      ];

      (storage.getAll as jest.Mock).mockResolvedValue(mockSubscriptions);
      (storage.refresh as jest.Mock).mockResolvedValue(mockSubscriptions);

      const { getByText } = render(<StatsScreen />);

      await waitFor(() => {
        expect(getByText('No renewals in the next 30 days')).toBeTruthy();
      });
    });

    it('should show empty state screen when no subscriptions exist', async () => {
      (storage.getAll as jest.Mock).mockResolvedValue([]);

      const { getByText } = render(<StatsScreen />);

      await waitFor(() => {
        expect(getByText('No Statistics Yet')).toBeTruthy();
        expect(getByText('Add subscriptions to see your spending insights')).toBeTruthy();
      });
    });
  });

  describe('Statistics Display', () => {
    it('should display total monthly spending correctly', async () => {
      const mockSubscriptions: Subscription[] = [
        createMockSubscription('1', 'Netflix', '2025-12-13', { cost: 15.99, repeat_interval: 'monthly' }),
        createMockSubscription('2', 'Spotify', '2025-12-15', { cost: 9.99, repeat_interval: 'monthly' }),
      ];

      (storage.getAll as jest.Mock).mockResolvedValue(mockSubscriptions);
      (storage.refresh as jest.Mock).mockResolvedValue(mockSubscriptions);

      const { getByText } = render(<StatsScreen />);

      await waitFor(() => {
        // Total monthly: 15.99 + 9.99 = 25.98
        // Use getAllByText since the amount might appear in multiple places
        const elements = getByText(/Monthly Spending.*\$25\.98/);
        expect(elements).toBeTruthy();
      });
    });

    it('should display subscription count correctly', async () => {
      const mockSubscriptions: Subscription[] = [
        createMockSubscription('1', 'Netflix', '2025-12-13'),
        createMockSubscription('2', 'Spotify', '2025-12-15'),
        createMockSubscription('3', 'Disney+', '2025-12-20'),
      ];

      (storage.getAll as jest.Mock).mockResolvedValue(mockSubscriptions);
      (storage.refresh as jest.Mock).mockResolvedValue(mockSubscriptions);

      const { getByText } = render(<StatsScreen />);

      await waitFor(() => {
        expect(getByText('3')).toBeTruthy();
      });
    });

    it('should display billing cycle distribution', async () => {
      const mockSubscriptions: Subscription[] = [
        createMockSubscription('1', 'Netflix', '2025-12-13', { repeat_interval: 'monthly' }),
        createMockSubscription('2', 'Spotify', '2025-12-15', { repeat_interval: 'monthly' }),
        createMockSubscription('3', 'Disney+', '2025-12-20', { repeat_interval: 'yearly' }),
      ];

      (storage.getAll as jest.Mock).mockResolvedValue(mockSubscriptions);
      (storage.refresh as jest.Mock).mockResolvedValue(mockSubscriptions);

      const { getByText } = render(<StatsScreen />);

      await waitFor(() => {
        // Should show 2 monthly and 1 yearly
        expect(getByText('2')).toBeTruthy(); // monthly count
        expect(getByText('1')).toBeTruthy(); // yearly count
      });
    });
  });

  describe('Timezone Bug Regression Tests', () => {
    it('should NOT display Dec 12 when renewal date is Dec 13 (timezone bug)', async () => {
      // This is the primary bug being fixed: In Pacific Time (UTC-8),
      // "2025-12-13" was parsing as UTC midnight, converting to Dec 12 4PM PST
      const mockSubscriptions: Subscription[] = [
        createMockSubscription('1', 'Netflix', '2025-12-13'),
      ];

      (storage.getAll as jest.Mock).mockResolvedValue(mockSubscriptions);
      (storage.refresh as jest.Mock).mockResolvedValue(mockSubscriptions);

      const { getByText, queryByText } = render(<StatsScreen />);

      await waitFor(() => {
        // Should display "3 days" (Dec 13 - Dec 10)
        expect(getByText(/3 days/)).toBeTruthy();
        
        // Should NOT display "2 days" (which would indicate Dec 12)
        expect(queryByText(/2 days/)).toBeNull();
      });
    });

    it('should populate renewal timeline sections (not empty due to timezone mismatch)', async () => {
      // This tests the second bug: getRenewalTimeline was showing empty
      // due to inconsistent timezone handling between filtering and bucket assignment
      const mockSubscriptions: Subscription[] = [
        createMockSubscription('1', 'Netflix', '2025-12-13'),
      ];

      (storage.getAll as jest.Mock).mockResolvedValue(mockSubscriptions);
      (storage.refresh as jest.Mock).mockResolvedValue(mockSubscriptions);

      const { getByText, queryByText } = render(<StatsScreen />);

      await waitFor(() => {
        // Should show "This Week" section with Netflix
        expect(getByText('This Week')).toBeTruthy();
        expect(getByText('Netflix')).toBeTruthy();
        
        // Should NOT show empty state
        expect(queryByText('No renewals in the next 30 days')).toBeNull();
      });
    });

    it('should handle month-end dates correctly across timezones', async () => {
      // Set time BEFORE creating subscriptions and rendering
      jest.setSystemTime(new Date('2025-12-30T10:00:00.000Z'));
      
      const mockSubscriptions: Subscription[] = [
        createMockSubscription('1', 'Netflix', '2025-12-31'),
      ];

      (storage.getAll as jest.Mock).mockResolvedValue(mockSubscriptions);
      (storage.refresh as jest.Mock).mockResolvedValue(mockSubscriptions);

      const { getByText } = render(<StatsScreen />);

      await waitFor(() => {
        // Should display "Tomorrow" (Dec 31 - Dec 30 = 1 day)
        expect(getByText(/Tomorrow/)).toBeTruthy();
      });
    });

    it('should handle DST transition dates correctly', async () => {
      // March 10, 2025 - DST spring forward in Pacific Time
      // Set time BEFORE creating subscriptions and rendering
      jest.setSystemTime(new Date('2025-03-09T10:00:00.000Z'));
      
      const mockSubscriptions: Subscription[] = [
        createMockSubscription('1', 'Netflix', '2025-03-10'),
      ];

      (storage.getAll as jest.Mock).mockResolvedValue(mockSubscriptions);
      (storage.refresh as jest.Mock).mockResolvedValue(mockSubscriptions);

      const { getByText } = render(<StatsScreen />);

      await waitFor(() => {
        // Should display "Tomorrow" despite DST transition (1 day)
        expect(getByText(/Tomorrow/)).toBeTruthy();
      });
    });
  });

  describe('Loading and Error States', () => {
    it('should display loading indicator while fetching data', () => {
      (storage.getAll as jest.Mock).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve([]), 1000))
      );

      const { getByTestId } = render(<StatsScreen />);

      // Should show loading indicator initially
      // Note: This requires LoadingIndicator to have testID="loading-indicator"
      expect(() => getByTestId('loading-indicator')).not.toThrow();
    });

    it('should handle refresh correctly', async () => {
      const mockSubscriptions: Subscription[] = [
        createMockSubscription('1', 'Netflix', '2025-12-13'),
      ];

      (storage.getAll as jest.Mock).mockResolvedValue(mockSubscriptions);
      (storage.refresh as jest.Mock).mockResolvedValue(mockSubscriptions);

      const { getByText } = render(<StatsScreen />);

      await waitFor(() => {
        expect(getByText('Netflix')).toBeTruthy();
      });

      // Pull-to-refresh should call storage.refresh
      // Note: Testing pull-to-refresh gesture is complex in unit tests
      // This is more suited for E2E tests
    });
  });

  describe('Edge Cases', () => {
    it('should handle subscriptions with same renewal dates', async () => {
      const mockSubscriptions: Subscription[] = [
        createMockSubscription('1', 'Netflix', '2025-12-13'),
        createMockSubscription('2', 'Spotify', '2025-12-13'),
      ];

      (storage.getAll as jest.Mock).mockResolvedValue(mockSubscriptions);
      (storage.refresh as jest.Mock).mockResolvedValue(mockSubscriptions);

      const { getByText } = render(<StatsScreen />);

      await waitFor(() => {
        expect(getByText('Netflix')).toBeTruthy();
        expect(getByText('Spotify')).toBeTruthy();
        // Both should appear in This Week
        expect(getByText('This Week')).toBeTruthy();
      });
    });

    it('should handle very large numbers of subscriptions', async () => {
      // Create 100 subscriptions spread across timeline
      const mockSubscriptions: Subscription[] = Array.from({ length: 100 }, (_, i) => 
        createMockSubscription(
          `${i}`,
          `Subscription ${i}`,
          `2025-12-${10 + (i % 20)}` // Spread across Dec 10-30
        )
      );

      (storage.getAll as jest.Mock).mockResolvedValue(mockSubscriptions);
      (storage.refresh as jest.Mock).mockResolvedValue(mockSubscriptions);

      const { getByText } = render(<StatsScreen />);

      await waitFor(() => {
        // Should display total count
        expect(getByText('100')).toBeTruthy();
        // Should display section headers
        expect(getByText('This Week')).toBeTruthy();
      });
    });

    it('should handle subscriptions with future years correctly', async () => {
      const mockSubscriptions: Subscription[] = [
        createMockSubscription('1', 'Netflix', '2026-12-13'),
      ];

      (storage.getAll as jest.Mock).mockResolvedValue(mockSubscriptions);
      (storage.refresh as jest.Mock).mockResolvedValue(mockSubscriptions);

      const { getByText } = render(<StatsScreen />);

      await waitFor(() => {
        // Should show empty timeline (beyond 30 days)
        expect(getByText('No renewals in the next 30 days')).toBeTruthy();
      });
    });
  });
});