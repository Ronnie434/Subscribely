import { Subscription, User } from '../../types';

// Mock Users
export const mockUsers = {
  authenticated: {
    id: 'user-123',
    email: 'rox434@gmail.com',
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
    app_metadata: {},
    user_metadata: { name: 'Test User' },
    aud: 'authenticated',
    email_confirmed_at: '2025-01-01T00:00:00.000Z',
  },
  unauthenticated: null,
  premium: {
    id: 'premium-user-456',
    email: 'premium@example.com',
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
    app_metadata: { subscription_tier: 'premium' },
    user_metadata: { name: 'Premium User' },
    aud: 'authenticated',
    email_confirmed_at: '2025-01-01T00:00:00.000Z',
  },
} as const;

// Mock Subscriptions
export const mockSubscriptions: Subscription[] = [
  {
    id: 'sub-1',
    name: 'Netflix',
    cost: 15.99,
    billingCycle: 'monthly',
    renewalDate: '2025-12-15',
    category: 'Entertainment',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    userId: 'user-123',
    description: 'Streaming service',
    notify: true,
    logo: 'https://logo.clearbit.com/netflix.com',
    color: '#E50914',
  },
  {
    id: 'sub-2',
    name: 'Spotify',
    cost: 9.99,
    billingCycle: 'monthly',
    renewalDate: '2025-12-20',
    category: 'Entertainment',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    userId: 'user-123',
    description: 'Music streaming',
    notify: true,
    logo: 'https://logo.clearbit.com/spotify.com',
    color: '#1DB954',
  },
  {
    id: 'sub-3',
    name: 'GitHub Pro',
    cost: 4.00,
    billingCycle: 'monthly',
    renewalDate: '2025-12-10',
    category: 'Productivity',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    userId: 'user-123',
    description: 'Code repository hosting',
    notify: false,
    logo: 'https://logo.clearbit.com/github.com',
    color: '#000000',
  },
  {
    id: 'sub-4',
    name: 'Amazon Prime',
    cost: 139.00,
    billingCycle: 'yearly',
    renewalDate: '2026-03-01',
    category: 'Shopping',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    userId: 'user-123',
    description: 'Prime membership',
    notify: true,
    logo: 'https://logo.clearbit.com/amazon.com',
    color: '#FF9900',
  },
  {
    id: 'sub-5',
    name: 'Disney+',
    cost: 10.99,
    billingCycle: 'monthly',
    renewalDate: '2025-12-25',
    category: 'Entertainment',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    userId: 'user-123',
    description: 'Disney streaming',
    notify: true,
    logo: 'https://logo.clearbit.com/disneyplus.com',
    color: '#113CCF',
  },
];

// Subscription factory function
export function createMockSubscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: 'Test Subscription',
    cost: 9.99,
    billingCycle: 'monthly',
    renewalDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days from now
    category: 'Entertainment',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userId: 'user-123',
    description: '',
    notify: true,
    ...overrides,
  };
}

// Create subscription with specific renewal timing
export function createSubscriptionWithRenewal(
  name: string,
  daysUntilRenewal: number,
  overrides: Partial<Subscription> = {}
): Subscription {
  const renewalDate = new Date();
  renewalDate.setDate(renewalDate.getDate() + daysUntilRenewal);
  
  return createMockSubscription({
    name,
    renewalDate: renewalDate.toISOString().split('T')[0],
    ...overrides,
  });
}

// Mock subscription categories
export const mockCategories = [
  'Entertainment',
  'Productivity',
  'Shopping',
  'Finance',
  'Health & Fitness',
  'Education',
  'News',
  'Cloud Storage',
  'Other',
] as const;

// Mock subscription tiers for paywall testing
export const mockSubscriptionTiers = {
  free: {
    name: 'Free',
    maxSubscriptions: 3,
    features: ['Track up to 3 subscriptions', 'Basic statistics'],
  },
  premium: {
    name: 'Premium',
    maxSubscriptions: -1, // Unlimited
    price: { monthly: 4.99, yearly: 49.99 },
    features: [
      'Unlimited subscriptions',
      'Advanced statistics',
      'Export data',
      'Custom categories',
      'Priority support',
    ],
  },
} as const;

// Mock API responses
export const mockApiResponses = {
  subscriptions: {
    success: {
      data: mockSubscriptions,
      error: null,
    },
    empty: {
      data: [],
      error: null,
    },
    error: {
      data: null,
      error: { message: 'Failed to fetch subscriptions' },
    },
  },
  auth: {
    signInSuccess: {
      data: {
        user: mockUsers.authenticated,
        session: {
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          expires_at: Date.now() + 3600000,
        },
      },
      error: null,
    },
    signInError: {
      data: null,
      error: { message: 'Invalid login credentials' },
    },
    signUpSuccess: {
      data: {
        user: mockUsers.authenticated,
        session: null, // Email confirmation required
      },
      error: null,
    },
    signUpDuplicate: {
      data: null,
      error: { message: 'User already registered' },
    },
  },
  payment: {
    createPaymentSheet: {
      paymentIntent: 'pi_mock_intent',
      publishableKey: 'pk_test_mock',
      customer: 'cus_mock',
      ephemeralKey: 'ek_mock',
    },
    confirmPayment: {
      success: true,
      paymentIntentId: 'pi_mock_intent',
    },
  },
} as const;

// Test data generators
export const testDataGenerators = {
  // Generate multiple subscriptions
  generateSubscriptions(count: number, userId = 'user-123'): Subscription[] {
    return Array.from({ length: count }, (_, index) => 
      createMockSubscription({
        id: `sub-${index + 1}`,
        name: `Subscription ${index + 1}`,
        userId,
        cost: Math.floor(Math.random() * 50) + 5,
        category: mockCategories[index % mockCategories.length],
      })
    );
  },

  // Generate subscriptions with various renewal dates
  generateUpcomingRenewals(): Subscription[] {
    return [
      createSubscriptionWithRenewal('Today', 0),
      createSubscriptionWithRenewal('Tomorrow', 1),
      createSubscriptionWithRenewal('This Week', 5),
      createSubscriptionWithRenewal('Next Week', 10),
      createSubscriptionWithRenewal('This Month', 20),
      createSubscriptionWithRenewal('Next Month', 35),
    ];
  },

  // Generate expired subscriptions
  generateExpiredSubscriptions(count: number): Subscription[] {
    return Array.from({ length: count }, (_, index) => {
      const daysAgo = index + 1;
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - daysAgo);
      
      return createMockSubscription({
        id: `expired-${index + 1}`,
        name: `Expired ${index + 1}`,
        renewalDate: expiredDate.toISOString().split('T')[0],
      });
    });
  },
};

// Mock form data
export const mockFormData = {
  validSubscription: {
    name: 'Test Service',
    cost: '9.99',
    billingCycle: 'monthly',
    renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    category: 'Entertainment',
    description: 'Test subscription service',
    notify: true,
  },
  invalidSubscription: {
    name: '', // Missing required field
    cost: 'invalid', // Invalid number
    billingCycle: 'monthly',
    renewalDate: 'invalid-date',
    category: 'Entertainment',
  },
  authentication: {
    validLogin: {
      email: 'rox434@gmail.com',
      password: '12345678',
    },
    invalidLogin: {
      email: 'invalid@example.com',
      password: 'wrongpassword',
    },
    validSignup: {
      email: 'newuser@example.com',
      password: 'ValidPass123!',
      name: 'New User',
    },
    invalidSignup: {
      email: 'invalid-email',
      password: '123', // Too short
      name: '',
    },
  },
};

// Mock navigation states
export const mockNavigationStates = {
  authenticated: {
    routes: [
      { name: 'Home', key: 'Home-1' },
      { name: 'Stats', key: 'Stats-1' },
      { name: 'Settings', key: 'Settings-1' },
    ],
    index: 0,
  },
  unauthenticated: {
    routes: [
      { name: 'Login', key: 'Login-1' },
    ],
    index: 0,
  },
  onboarding: {
    routes: [
      { name: 'Onboarding', key: 'Onboarding-1' },
    ],
    index: 0,
  },
};

// Helper to reset all mocks
export function resetAllMocks() {
  jest.clearAllMocks();
  jest.clearAllTimers();
}

// Helper to setup common test scenarios
export const testScenarios = {
  // Setup authenticated user with subscriptions
  authenticatedWithSubscriptions: () => ({
    user: mockUsers.authenticated,
    subscriptions: mockSubscriptions,
    session: mockApiResponses.auth.signInSuccess.data.session,
  }),

  // Setup new user with no subscriptions
  newUser: () => ({
    user: mockUsers.authenticated,
    subscriptions: [],
    session: mockApiResponses.auth.signInSuccess.data.session,
  }),

  // Setup user at free tier limit
  freeTierLimit: () => ({
    user: mockUsers.authenticated,
    subscriptions: mockSubscriptions.slice(0, 3),
    session: mockApiResponses.auth.signInSuccess.data.session,
    tier: 'free',
  }),

  // Setup premium user
  premiumUser: () => ({
    user: mockUsers.premium,
    subscriptions: testDataGenerators.generateSubscriptions(10, 'premium-user-456'),
    session: mockApiResponses.auth.signInSuccess.data.session,
    tier: 'premium',
  }),
};