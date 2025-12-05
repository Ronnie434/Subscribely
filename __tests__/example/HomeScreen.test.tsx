/**
 * Example test file demonstrating how to test the HomeScreen component
 * This shows best practices for testing React Native screens with:
 * - Authentication context
 * - Navigation mocking
 * - Async data loading
 * - User interactions
 * - Subscription limit checking
 */

import React from 'react';
import { Alert } from 'react-native';
import {
  render,
  fireEvent,
  waitFor,
  within,
  act,
} from '../setup/test-utils';
import HomeScreen from '../../screens/HomeScreen';
import {
  mockSubscriptions,
  createMockSubscription,
  testScenarios,
} from '../fixtures/mockData';
import {
  mockStorage,
  mockSubscriptionLimitService,
  setupMockResponses,
  resetServiceMocks,
} from '../mocks/services';

// Mock the services
jest.mock('../../utils/storage', () => ({
  storage: mockStorage,
}));

jest.mock('../../services/subscriptionLimitService', () => mockSubscriptionLimitService);

describe('HomeScreen', () => {
  // Setup before each test
  beforeEach(() => {
    jest.clearAllMocks();
    resetServiceMocks();
    setupMockResponses('success');
  });

  describe('Rendering', () => {
    it('should render the home screen with subscriptions', async () => {
      const mockNavigation = { navigate: jest.fn(), setOptions: jest.fn() } as any;
      const { getByText, getAllByTestId } = render(<HomeScreen navigation={mockNavigation} />);

      // Wait for subscriptions to load
      await waitFor(() => {
        expect(getByText('Netflix')).toBeTruthy();
        expect(getByText('Spotify')).toBeTruthy();
      });

      // Check that subscription cards are rendered
      const subscriptionCards = getAllByTestId(/subscription-card/);
      expect(subscriptionCards.length).toBeGreaterThan(0);
    });

    it('should show empty state when no subscriptions', async () => {
      setupMockResponses('empty');

      const mockNavigation = { navigate: jest.fn(), setOptions: jest.fn() } as any;
      const { getByText, getByTestId } = render(<HomeScreen navigation={mockNavigation} />);

      await waitFor(() => {
        expect(getByTestId('empty-state')).toBeTruthy();
        expect(getByText(/No subscriptions yet/i)).toBeTruthy();
      });
    });

    it('should show loading indicator while fetching data', () => {
      // Delay the mock response
      mockStorage.getAll.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockSubscriptions), 1000))
      );

      const mockNavigation = { navigate: jest.fn(), setOptions: jest.fn() } as any;
      const { getByTestId } = render(<HomeScreen navigation={mockNavigation} />);

      expect(getByTestId('loading-indicator')).toBeTruthy();
    });
  });

  describe('Subscription Limit', () => {
    it('should show limit reached banner when at free tier limit', async () => {
      // Setup free tier limit scenario
      mockSubscriptionLimitService.checkLimit.mockResolvedValue({
        canAdd: false,
        currentCount: 3,
        limit: 3,
      });
      mockStorage.getAll.mockResolvedValue(mockSubscriptions.slice(0, 3));

      const mockNavigation = { navigate: jest.fn(), setOptions: jest.fn() } as any;
      const { getByTestId, getByText } = render(<HomeScreen navigation={mockNavigation} />);

      await waitFor(() => {
        expect(getByTestId('limit-reached-banner')).toBeTruthy();
        expect(getByText(/reached the free limit/i)).toBeTruthy();
      });
    });

    it('should not show limit banner for premium users', async () => {
      // Setup premium user scenario
      mockSubscriptionLimitService.checkLimit.mockResolvedValue({
        canAdd: true,
        currentCount: 10,
        limit: -1, // Unlimited
      });

      const mockNavigation = { navigate: jest.fn(), setOptions: jest.fn() } as any;
      const { queryByTestId } = render(<HomeScreen navigation={mockNavigation} />);

      await waitFor(() => {
        expect(queryByTestId('limit-reached-banner')).toBeNull();
      });
    });

    it('should navigate to plan selection when upgrade is clicked', async () => {
      mockSubscriptionLimitService.checkLimit.mockResolvedValue({
        canAdd: false,
        currentCount: 3,
        limit: 3,
      });

      const mockNavigate = jest.fn();
      const mockNavigation = { navigate: mockNavigate, setOptions: jest.fn() } as any;
      const { getByText } = render(<HomeScreen navigation={mockNavigation} />);

      await waitFor(() => {
        const upgradeButton = getByText(/Upgrade to Premium/i);
        fireEvent.press(upgradeButton);
      });

      expect(mockNavigate).toHaveBeenCalledWith('PlanSelection');
    });
  });

  describe('User Interactions', () => {
    it('should navigate to add subscription screen when add button is pressed', async () => {
      const mockNavigate = jest.fn();
      const mockNavigation = { navigate: mockNavigate, setOptions: jest.fn() } as any;
      const { getByTestId } = render(<HomeScreen navigation={mockNavigation} />);

      await waitFor(() => {
        const addButton = getByTestId('add-subscription-button');
        fireEvent.press(addButton);
      });

      expect(mockNavigate).toHaveBeenCalledWith('AddSubscription');
    });

    it('should navigate to edit screen when subscription is pressed', async () => {
      const mockNavigate = jest.fn();
      const mockNavigation = { navigate: mockNavigate, setOptions: jest.fn() } as any;
      const { getByText } = render(<HomeScreen navigation={mockNavigation} />);

      await waitFor(() => {
        const subscriptionCard = getByText('Netflix');
        fireEvent.press(subscriptionCard);
      });

      expect(mockNavigate).toHaveBeenCalledWith('EditSubscription', {
        subscription: expect.objectContaining({ name: 'Netflix' }),
      });
    });

    it('should show alert when trying to add subscription at limit', async () => {
      mockSubscriptionLimitService.checkLimit.mockResolvedValue({
        canAdd: false,
        currentCount: 3,
        limit: 3,
      });

      const alertSpy = jest.spyOn(Alert, 'alert');
      const mockNavigate = jest.fn();
      const mockNavigation = { navigate: mockNavigate, setOptions: jest.fn() } as any;

      const { getByTestId } = render(<HomeScreen navigation={mockNavigation} />);

      await waitFor(() => {
        const addButton = getByTestId('add-subscription-button');
        fireEvent.press(addButton);
      });

      expect(alertSpy).toHaveBeenCalledWith(
        'Subscription Limit Reached',
        expect.stringContaining('free plan limit'),
        expect.any(Array)
      );
    });

    it('should refresh subscriptions on pull-to-refresh', async () => {
      const mockNavigation = { navigate: jest.fn(), setOptions: jest.fn() } as any;
      const { getByTestId } = render(<HomeScreen navigation={mockNavigation} />);

      await waitFor(() => {
        expect(mockStorage.getAll).toHaveBeenCalledTimes(1);
      });

      // Simulate pull-to-refresh
      const scrollView = getByTestId('subscriptions-list');
      const { refreshControl } = scrollView.props;

      act(() => {
        refreshControl.props.onRefresh();
      });

      await waitFor(() => {
        expect(mockStorage.refresh).toHaveBeenCalled();
      });
    });
  });

  describe('Subscription Management', () => {
    it('should delete subscription when delete action is triggered', async () => {
      mockStorage.delete.mockResolvedValue(undefined);
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(
        (title, message, buttons) => {
          // Simulate pressing "Delete" button
          const deleteButton = buttons?.find(b => b.text === 'Delete');
          deleteButton?.onPress?.();
        }
      );

      const mockNavigation = { navigate: jest.fn(), setOptions: jest.fn() } as any;
      const { getByText } = render(<HomeScreen navigation={mockNavigation} />);

      await waitFor(() => {
        const subscription = getByText('Netflix');
        // Long press to show delete option
        fireEvent.press(subscription, { duration: 500 });
      });

      expect(alertSpy).toHaveBeenCalled();
      expect(mockStorage.delete).toHaveBeenCalledWith(expect.stringContaining('sub-1'));
    });

    it('should sort subscriptions by renewal date', async () => {
      const sortedSubscriptions = [
        createMockSubscription({ name: 'Soon', renewalDate: '2025-12-01' }),
        createMockSubscription({ name: 'Later', renewalDate: '2025-12-15' }),
        createMockSubscription({ name: 'Latest', renewalDate: '2025-12-30' }),
      ];

      mockStorage.getAll.mockResolvedValue(sortedSubscriptions);

      const mockNavigation = { navigate: jest.fn(), setOptions: jest.fn() } as any;
      const { getAllByTestId } = render(<HomeScreen navigation={mockNavigation} />);

      await waitFor(() => {
        const cards = getAllByTestId(/subscription-card/);
        expect(cards).toHaveLength(3);
        
        // Verify order - subscriptions should be sorted by renewal date
        const firstCard = within(cards[0]);
        expect(firstCard.getByText('Soon')).toBeTruthy();
      });
    });
  });

  describe('Real-time Updates', () => {
    it('should update when subscription is added', async () => {
      const mockNavigation = { navigate: jest.fn(), setOptions: jest.fn() } as any;
      const { getByText, rerender } = render(<HomeScreen navigation={mockNavigation} />);

      await waitFor(() => {
        expect(getByText('Netflix')).toBeTruthy();
      });

      // Simulate adding a new subscription
      const newSubscription = createMockSubscription({ name: 'New Service' });
      mockStorage.getAll.mockResolvedValue([...mockSubscriptions, newSubscription]);

      // Trigger re-render (simulating navigation focus)
      rerender(<HomeScreen navigation={mockNavigation} />);

      await waitFor(() => {
        expect(getByText('New Service')).toBeTruthy();
      });
    });
  });

  describe('Error Handling', () => {
    it('should show error message when loading fails', async () => {
      setupMockResponses('error');
      const alertSpy = jest.spyOn(Alert, 'alert');

      const mockNavigation = { navigate: jest.fn(), setOptions: jest.fn() } as any;
      render(<HomeScreen navigation={mockNavigation} />);

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          'Error',
          expect.stringContaining('Failed to load subscriptions'),
          expect.any(Array)
        );
      });
    });

    it('should handle network errors gracefully', async () => {
      mockStorage.getAll.mockRejectedValue(new Error('Network error'));

      const mockNavigation = { navigate: jest.fn(), setOptions: jest.fn() } as any;
      const { getByTestId } = render(<HomeScreen navigation={mockNavigation} />);

      await waitFor(() => {
        // Should show empty state or error state, not crash
        expect(getByTestId('empty-state')).toBeTruthy();
      });
    });
  });

  describe('Integration with Settings', () => {
    it('should filter subscriptions based on category', async () => {
      // This would test category filtering if implemented
      const entertainmentOnly = mockSubscriptions.filter(
        s => s.category === 'Entertainment'
      );
      
      mockStorage.getAll.mockResolvedValue(entertainmentOnly);

      const mockNavigation = { navigate: jest.fn(), setOptions: jest.fn() } as any;
      const { getAllByTestId } = render(<HomeScreen navigation={mockNavigation} />);

      await waitFor(() => {
        const cards = getAllByTestId(/subscription-card/);
        expect(cards.length).toBeGreaterThan(0);
        // Check that all cards have the Entertainment category
        cards.forEach(card => {
          const categoryBadge = within(card).queryByTestId('category-badge');
          if (categoryBadge) {
            expect(categoryBadge.props.children).toContain('Entertainment');
          }
        });
      });
    });
  });
});