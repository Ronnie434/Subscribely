import { mockSubscriptions, mockApiResponses } from '../fixtures/mockData';

// Mock subscription service
export const mockSubscriptionService = {
  getAll: jest.fn(() => Promise.resolve(mockSubscriptions)),
  create: jest.fn((subscription) => Promise.resolve({ ...subscription, id: 'new-sub-id' })),
  update: jest.fn((id, subscription) => Promise.resolve({ ...subscription, id })),
  delete: jest.fn(() => Promise.resolve()),
  syncWithSupabase: jest.fn(() => Promise.resolve({ success: true })),
  migrateLocalSubscriptions: jest.fn(() => Promise.resolve({ success: true, migratedCount: 0 })),
};

// Mock subscription limit service
export const mockSubscriptionLimitService = {
  checkLimit: jest.fn(() => Promise.resolve({ canAdd: true, currentCount: 1, limit: 3 })),
  getUsageStats: jest.fn(() => Promise.resolve({ 
    currentCount: 1, 
    limit: 3, 
    isAtLimit: false,
    tier: 'free' 
  })),
  hasReachedLimit: jest.fn(() => Promise.resolve(false)),
  getRemainingSlots: jest.fn(() => Promise.resolve(2)),
};

// Mock payment service
export const mockPaymentService = {
  createPaymentIntent: jest.fn(() => Promise.resolve(mockApiResponses.payment.createPaymentSheet)),
  confirmPayment: jest.fn(() => Promise.resolve(mockApiResponses.payment.confirmPayment)),
  createSubscription: jest.fn(() => Promise.resolve({ 
    success: true, 
    subscriptionId: 'sub_mock_123' 
  })),
  cancelSubscription: jest.fn(() => Promise.resolve({ success: true })),
  updatePaymentMethod: jest.fn(() => Promise.resolve({ success: true })),
  getBillingPortal: jest.fn(() => Promise.resolve({ url: 'https://billing.stripe.com/mock' })),
};

// Mock notification service
export const mockNotificationService = {
  requestPermissions: jest.fn(() => Promise.resolve({ status: 'granted' })),
  scheduleNotification: jest.fn(() => Promise.resolve('notification-id')),
  cancelNotification: jest.fn(() => Promise.resolve()),
  cancelAllNotifications: jest.fn(() => Promise.resolve()),
  getScheduledNotifications: jest.fn(() => Promise.resolve([])),
  scheduleRenewalReminders: jest.fn(() => Promise.resolve()),
  updateNotificationSettings: jest.fn(() => Promise.resolve()),
};

// Mock storage service
export const mockStorage = {
  getAll: jest.fn(() => Promise.resolve(mockSubscriptions)),
  get: jest.fn((id) => Promise.resolve(mockSubscriptions.find(s => s.id === id))),
  save: jest.fn(() => Promise.resolve()),
  delete: jest.fn(() => Promise.resolve()),
  refresh: jest.fn(() => Promise.resolve(mockSubscriptions)),
  hasSeenOnboarding: jest.fn(() => Promise.resolve(true)),
  setHasSeenOnboarding: jest.fn(() => Promise.resolve()),
  clearAll: jest.fn(() => Promise.resolve()),
};

// Mock Supabase client
export const mockSupabase = {
  from: jest.fn((table: string) => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn(() => Promise.resolve({ data: null, error: null })),
    then: jest.fn((callback) => callback({ data: [], error: null })),
  })),
  auth: {
    signInWithPassword: jest.fn(() => Promise.resolve(mockApiResponses.auth.signInSuccess)),
    signUp: jest.fn(() => Promise.resolve(mockApiResponses.auth.signUpSuccess)),
    signOut: jest.fn(() => Promise.resolve({ error: null })),
    resetPasswordForEmail: jest.fn(() => Promise.resolve({ error: null })),
    getSession: jest.fn(() => Promise.resolve({ 
      data: { session: mockApiResponses.auth.signInSuccess.data.session }, 
      error: null 
    })),
    getUser: jest.fn(() => Promise.resolve({ 
      data: { user: mockApiResponses.auth.signInSuccess.data.user }, 
      error: null 
    })),
    onAuthStateChange: jest.fn((callback) => {
      // Immediately call the callback with current session
      callback('SIGNED_IN', mockApiResponses.auth.signInSuccess.data.session);
      return {
        data: { 
          subscription: { 
            unsubscribe: jest.fn() 
          } 
        },
      };
    }),
  },
  rpc: jest.fn(() => Promise.resolve({ data: null, error: null })),
  channel: jest.fn(() => ({
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn().mockReturnThis(),
    unsubscribe: jest.fn(),
  })),
};

// Mock hooks
export const mockUseRealtimeSubscriptions = jest.fn(() => undefined);

export const mockUseInactivityTimer = jest.fn(() => ({
  resetTimer: jest.fn(),
}));

// Mock AsyncStorage
export const mockAsyncStorage = {
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([])),
  multiGet: jest.fn(() => Promise.resolve([])),
  multiSet: jest.fn(() => Promise.resolve()),
  multiRemove: jest.fn(() => Promise.resolve()),
};

// Mock SecureStore
export const mockSecureStore = {
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
};

// Mock Expo Notifications
export const mockNotifications = {
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ 
    status: 'granted',
    expires: 'never',
    granted: true,
    canAskAgain: true,
  })),
  setNotificationHandler: jest.fn(),
  scheduleNotificationAsync: jest.fn(() => Promise.resolve('notification-id')),
  cancelScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
  cancelAllScheduledNotificationsAsync: jest.fn(() => Promise.resolve()),
  getAllScheduledNotificationsAsync: jest.fn(() => Promise.resolve([])),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ 
    status: 'granted',
    expires: 'never',
    granted: true,
    canAskAgain: true,
  })),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
};

// Reset all mocks utility
export function resetServiceMocks() {
  Object.values(mockSubscriptionService).forEach(mock => {
    if (typeof mock === 'function' && jest.isMockFunction(mock)) {
      mock.mockClear();
    }
  });
  
  Object.values(mockSubscriptionLimitService).forEach(mock => {
    if (typeof mock === 'function' && jest.isMockFunction(mock)) {
      mock.mockClear();
    }
  });
  
  Object.values(mockPaymentService).forEach(mock => {
    if (typeof mock === 'function' && jest.isMockFunction(mock)) {
      mock.mockClear();
    }
  });
  
  Object.values(mockNotificationService).forEach(mock => {
    if (typeof mock === 'function' && jest.isMockFunction(mock)) {
      mock.mockClear();
    }
  });
  
  Object.values(mockStorage).forEach(mock => {
    if (typeof mock === 'function' && jest.isMockFunction(mock)) {
      mock.mockClear();
    }
  });
  
  // Reset Supabase mocks
  jest.clearAllMocks();
}

// Helper to setup mock responses
export function setupMockResponses(scenario: 'success' | 'error' | 'empty' = 'success') {
  switch (scenario) {
    case 'success':
      mockStorage.getAll.mockResolvedValue(mockSubscriptions);
      mockStorage.refresh.mockResolvedValue(mockSubscriptions);
      mockSubscriptionService.getAll.mockResolvedValue(mockSubscriptions);
      mockSubscriptionLimitService.checkLimit.mockResolvedValue({ 
        canAdd: true, 
        currentCount: mockSubscriptions.length, 
        limit: -1 
      });
      break;
      
    case 'empty':
      mockStorage.getAll.mockResolvedValue([]);
      mockStorage.refresh.mockResolvedValue([]);
      mockSubscriptionService.getAll.mockResolvedValue([]);
      mockSubscriptionLimitService.checkLimit.mockResolvedValue({ 
        canAdd: true, 
        currentCount: 0, 
        limit: 3 
      });
      break;
      
    case 'error':
      const error = new Error('Network error');
      mockStorage.getAll.mockRejectedValue(error);
      mockStorage.refresh.mockRejectedValue(error);
      mockSubscriptionService.getAll.mockRejectedValue(error);
      break;
  }
}