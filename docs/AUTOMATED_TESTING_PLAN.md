# Apple IAP Automated Testing Plan

Comprehensive test suite specifications for Apple In-App Purchase implementation.

## Document Information
- **Version**: 1.0.0
- **Created**: 2025-12-06
- **Phase**: Phase 6 - Testing & Validation
- **Testing Framework**: Jest + React Native Testing Library

---

## Table of Contents

1. [Testing Strategy](#testing-strategy)
2. [Test Environment Setup](#test-environment-setup)
3. [Unit Tests](#unit-tests)
4. [Integration Tests](#integration-tests)
5. [Component Tests](#component-tests)
6. [Backend Function Tests](#backend-function-tests)
7. [Test Data & Fixtures](#test-data--fixtures)
8. [CI/CD Integration](#cicd-integration)
9. [Code Coverage Requirements](#code-coverage-requirements)

---

## Testing Strategy

### Testing Pyramid

```
        /\
       /  \
      / E2E \
     /______\
    /        \
   /Integration\
  /____________\
 /              \
/   Unit Tests   \
/________________\
```

**Distribution**:
- **Unit Tests**: 70% - Fast, isolated, test individual functions
- **Integration Tests**: 20% - Test component interactions
- **E2E Tests**: 10% - Full user journey tests (manual in sandbox)

### Goals

1. **Prevent Regressions**: Catch breaking changes early
2. **Document Behavior**: Tests serve as living documentation
3. **Enable Refactoring**: Safe code improvements
4. **CI/CD Confidence**: Automated quality gates

### Testing Principles

- ✅ **Fast**: Unit tests run in <5 seconds
- ✅ **Isolated**: No external dependencies
- ✅ **Repeatable**: Deterministic results
- ✅ **Readable**: Clear test descriptions
- ✅ **Maintainable**: DRY, well-organized

---

## Test Environment Setup

### Prerequisites

```bash
# Install testing dependencies
npm install --save-dev \
  jest \
  @testing-library/react-native \
  @testing-library/jest-native \
  jest-expo \
  @types/jest
```

### Jest Configuration

Create or update [`jest.config.js`](../jest.config.js):

```javascript
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: [
    '@testing-library/jest-native/extend-expect',
    '<rootDir>/jest.setup.js',
  ],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|react-native-iap)',
  ],
  collectCoverageFrom: [
    'services/**/*.{ts,tsx}',
    'config/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  testMatch: [
    '**/__tests__/**/*.test.{ts,tsx}',
    '**/*.test.{ts,tsx}',
  ],
};
```

### Jest Setup File

Create [`jest.setup.js`](../jest.setup.js):

```javascript
// Mock react-native-iap
jest.mock('react-native-iap', () => ({
  initConnection: jest.fn(),
  endConnection: jest.fn(),
  getProducts: jest.fn(),
  requestPurchase: jest.fn(),
  finishTransaction: jest.fn(),
  purchaseUpdatedListener: jest.fn(),
  purchaseErrorListener: jest.fn(),
  getAvailablePurchases: jest.fn(),
}));

// Mock Supabase
jest.mock('./config/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
    functions: {
      invoke: jest.fn(),
    },
  },
}));

// Mock Platform
jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  OS: 'ios',
  select: jest.fn((obj) => obj.ios),
  Version: 17,
}));

// Suppress console warnings in tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};
```

---

## Unit Tests

### Test Suite 1: appleIAPService.ts

File: `__tests__/services/appleIAPService.test.ts`

#### Test 1.1: Service Initialization

```typescript
import { appleIAPService } from '../../services/appleIAPService';
import * as RNIap from 'react-native-iap';

describe('AppleIAPService - Initialization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize IAP connection successfully', async () => {
    // Arrange
    (RNIap.initConnection as jest.Mock).mockResolvedValue(true);

    // Act
    await appleIAPService.initialize();

    // Assert
    expect(RNIap.initConnection).toHaveBeenCalledTimes(1);
    expect(appleIAPService.isInitialized()).toBe(true);
  });

  it('should handle initialization failure gracefully', async () => {
    // Arrange
    const error = new Error('Connection failed');
    (RNIap.initConnection as jest.Mock).mockRejectedValue(error);

    // Act & Assert
    await expect(appleIAPService.initialize()).rejects.toThrow('Connection failed');
    expect(appleIAPService.isInitialized()).toBe(false);
  });

  it('should not reinitialize if already initialized', async () => {
    // Arrange
    (RNIap.initConnection as jest.Mock).mockResolvedValue(true);
    await appleIAPService.initialize();
    jest.clearAllMocks();

    // Act
    await appleIAPService.initialize();

    // Assert
    expect(RNIap.initConnection).not.toHaveBeenCalled();
  });

  it('should skip initialization on non-iOS platform', async () => {
    // Arrange
    jest.spyOn(Platform, 'OS', 'get').mockReturnValue('android');

    // Act
    await appleIAPService.initialize();

    // Assert
    expect(RNIap.initConnection).not.toHaveBeenCalled();
  });
});
```

#### Test 1.2: Product Fetching

```typescript
describe('AppleIAPService - Product Fetching', () => {
  const mockProducts = [
    {
      productId: 'com.renvo.basic.monthly',
      title: 'Monthly Premium',
      description: 'Unlimited recurring items',
      price: 4.99,
      currency: 'USD',
      localizedPrice: '$4.99',
    },
    {
      productId: 'com.renvo.basic.yearly',
      title: 'Yearly Premium',
      description: 'Unlimited recurring items',
      price: 39.99,
      currency: 'USD',
      localizedPrice: '$39.99',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (RNIap.initConnection as jest.Mock).mockResolvedValue(true);
  });

  it('should fetch products from App Store', async () => {
    // Arrange
    await appleIAPService.initialize();
    (RNIap.getProducts as jest.Mock).mockResolvedValue(mockProducts);

    // Act
    const products = await appleIAPService.getProducts();

    // Assert
    expect(RNIap.getProducts).toHaveBeenCalledWith({
      skus: ['com.renvo.basic.monthly', 'com.renvo.basic.yearly'],
    });
    expect(products).toHaveLength(2);
    expect(products[0].productId).toBe('com.renvo.basic.monthly');
  });

  it('should handle product fetch failure', async () => {
    // Arrange
    await appleIAPService.initialize();
    const error = new Error('Failed to fetch products');
    (RNIap.getProducts as jest.Mock).mockRejectedValue(error);

    // Act & Assert
    await expect(appleIAPService.getProducts()).rejects.toThrow('Failed to fetch products');
  });

  it('should map product data correctly', async () => {
    // Arrange
    await appleIAPService.initialize();
    (RNIap.getProducts as jest.Mock).mockResolvedValue(mockProducts);

    // Act
    const products = await appleIAPService.getProducts();

    // Assert
    expect(products[0]).toMatchObject({
      productId: 'com.renvo.basic.monthly',
      title: expect.any(String),
      price: expect.any(Number),
      localizedPrice: expect.any(String),
      type: 'subscription',
    });
  });
});
```

#### Test 1.3: Purchase Flow

```typescript
describe('AppleIAPService - Purchase Flow', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    (RNIap.initConnection as jest.Mock).mockResolvedValue(true);
    await appleIAPService.initialize();
  });

  it('should initiate purchase for valid product', async () => {
    // Arrange
    const productId = 'com.renvo.basic.monthly';
    (RNIap.requestPurchase as jest.Mock).mockResolvedValue(undefined);

    // Act
    const result = await appleIAPService.purchaseSubscription(productId);

    // Assert
    expect(RNIap.requestPurchase).toHaveBeenCalledWith({ sku: productId });
    expect(result.success).toBe(true);
  });

  it('should reject purchase for invalid product', async () => {
    // Arrange
    const invalidProductId = 'com.invalid.product';

    // Act & Assert
    await expect(
      appleIAPService.purchaseSubscription(invalidProductId)
    ).rejects.toThrow('Invalid product ID');
  });

  it('should handle user cancellation', async () => {
    // Arrange
    const productId = 'com.renvo.basic.monthly';
    const error = { code: 'E_USER_CANCELLED', message: 'User cancelled' };
    (RNIap.requestPurchase as jest.Mock).mockRejectedValue(error);

    // Act
    const result = await appleIAPService.purchaseSubscription(productId);

    // Assert
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('E_USER_CANCELLED');
  });
});
```

#### Test 1.4: Purchase Restoration

```typescript
describe('AppleIAPService - Purchase Restoration', () => {
  const mockPurchases = [
    {
      transactionId: '1000000123456789',
      productId: 'com.renvo.basic.monthly',
      transactionReceipt: 'base64_receipt_data',
      transactionDate: new Date().toISOString(),
      originalTransactionIdentifierIOS: '1000000000000001',
    },
  ];

  beforeEach(async () => {
    jest.clearAllMocks();
    (RNIap.initConnection as jest.Mock).mockResolvedValue(true);
    await appleIAPService.initialize();
  });

  it('should restore previous purchases', async () => {
    // Arrange
    (RNIap.getAvailablePurchases as jest.Mock).mockResolvedValue(mockPurchases);
    mockSupabaseUser();

    // Act
    const result = await appleIAPService.restorePurchases();

    // Assert
    expect(result.success).toBe(true);
    expect(result.purchases).toHaveLength(1);
    expect(result.purchases[0].productId).toBe('com.renvo.basic.monthly');
  });

  it('should return empty array when no purchases found', async () => {
    // Arrange
    (RNIap.getAvailablePurchases as jest.Mock).mockResolvedValue([]);
    mockSupabaseUser();

    // Act
    const result = await appleIAPService.restorePurchases();

    // Assert
    expect(result.success).toBe(true);
    expect(result.purchases).toHaveLength(0);
  });

  it('should handle restoration without authenticated user', async () => {
    // Arrange
    (RNIap.getAvailablePurchases as jest.Mock).mockResolvedValue(mockPurchases);
    mockSupabaseUser(null);

    // Act
    const result = await appleIAPService.restorePurchases();

    // Assert
    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('authenticated user');
  });
});

// Helper function
function mockSupabaseUser(user = { id: 'test-user-id' }) {
  const { supabase } = require('../../config/supabase');
  supabase.auth.getUser.mockResolvedValue({
    data: { user },
    error: null,
  });
}
```

### Test Suite 2: appleIAP.ts Configuration

File: `__tests__/config/appleIAP.test.ts`

#### Test 2.1: Product Configuration

```typescript
import {
  IAP_PRODUCT_IDS,
  ACTIVE_PRODUCT_IDS,
  getProductConfig,
  isValidProductId,
  getProductIdByBillingCycle,
} from '../../config/appleIAP';

describe('Apple IAP Configuration', () => {
  describe('Product IDs', () => {
    it('should have correct product IDs defined', () => {
      expect(IAP_PRODUCT_IDS.basic_monthly).toBe('com.renvo.basic.monthly');
      expect(IAP_PRODUCT_IDS.basic_yearly).toBe('com.renvo.basic.yearly');
    });

    it('should have active product IDs array', () => {
      expect(ACTIVE_PRODUCT_IDS).toHaveLength(2);
      expect(ACTIVE_PRODUCT_IDS).toContain('com.renvo.basic.monthly');
      expect(ACTIVE_PRODUCT_IDS).toContain('com.renvo.basic.yearly');
    });
  });

  describe('getProductConfig', () => {
    it('should return config for valid product ID', () => {
      const config = getProductConfig('com.renvo.basic.monthly');
      expect(config).toBeDefined();
      expect(config?.productId).toBe('com.renvo.basic.monthly');
      expect(config?.interval).toBe('month');
    });

    it('should return null for invalid product ID', () => {
      const config = getProductConfig('invalid.product.id');
      expect(config).toBeNull();
    });
  });

  describe('isValidProductId', () => {
    it('should validate active product IDs', () => {
      expect(isValidProductId('com.renvo.basic.monthly')).toBe(true);
      expect(isValidProductId('com.renvo.basic.yearly')).toBe(true);
    });

    it('should reject invalid product IDs', () => {
      expect(isValidProductId('com.invalid.product')).toBe(false);
      expect(isValidProductId('')).toBe(false);
    });
  });

  describe('getProductIdByBillingCycle', () => {
    it('should return correct product for monthly cycle', () => {
      const productId = getProductIdByBillingCycle('monthly');
      expect(productId).toBe('com.renvo.basic.monthly');
    });

    it('should return correct product for yearly cycle', () => {
      const productId = getProductIdByBillingCycle('yearly');
      expect(productId).toBe('com.renvo.basic.yearly');
    });
  });
});
```

#### Test 2.2: StoreKit Version Detection

```typescript
import { 
  isStoreKit2Available, 
  getStoreKitVersion 
} from '../../config/appleIAP';
import { Platform } from 'react-native';

describe('StoreKit Version Detection', () => {
  it('should return true for iOS 15+', () => {
    jest.spyOn(Platform, 'Version', 'get').mockReturnValue(15);
    expect(isStoreKit2Available()).toBe(true);
  });

  it('should return false for iOS 14', () => {
    jest.spyOn(Platform, 'Version', 'get').mockReturnValue(14);
    expect(isStoreKit2Available()).toBe(false);
  });

  it('should return false for Android', () => {
    jest.spyOn(Platform, 'OS', 'get').mockReturnValue('android');
    expect(isStoreKit2Available()).toBe(false);
  });

  it('should return correct StoreKit version', () => {
    jest.spyOn(Platform, 'Version', 'get').mockReturnValue(17);
    expect(getStoreKitVersion()).toBe(2);

    jest.spyOn(Platform, 'Version', 'get').mockReturnValue(14);
    expect(getStoreKitVersion()).toBe(1);
  });
});
```

---

## Integration Tests

### Test Suite 3: End-to-End Purchase Flow

File: `__tests__/integration/purchase-flow.test.ts`

```typescript
import { appleIAPService } from '../../services/appleIAPService';
import * as RNIap from 'react-native-iap';
import { supabase } from '../../config/supabase';

describe('Purchase Flow Integration', () => {
  const mockUser = { id: 'test-user-123' };
  const mockReceipt = 'mock_base64_receipt';
  const mockTransactionId = '1000000123456789';

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Mock user authentication
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    // Initialize service
    (RNIap.initConnection as jest.Mock).mockResolvedValue(true);
    await appleIAPService.initialize();
  });

  it('should complete full purchase flow with validation', async () => {
    // Arrange
    const productId = 'com.renvo.basic.monthly';
    const mockPurchase = {
      transactionId: mockTransactionId,
      productId,
      transactionReceipt: mockReceipt,
      transactionDate: new Date().toISOString(),
    };

    (RNIap.requestPurchase as jest.Mock).mockResolvedValue(undefined);
    
    // Mock successful validation
    (supabase.functions.invoke as jest.Mock).mockResolvedValue({
      data: { success: true, subscription: { tier: 'premium' } },
      error: null,
    });

    // Act
    await appleIAPService.purchaseSubscription(productId);

    // Simulate purchase update listener
    const purchaseListener = (RNIap.purchaseUpdatedListener as jest.Mock).mock.calls[0][0];
    await purchaseListener(mockPurchase);

    // Assert
    expect(supabase.functions.invoke).toHaveBeenCalledWith(
      'validate-apple-receipt',
      expect.objectContaining({
        body: expect.objectContaining({
          receiptData: mockReceipt,
          userId: mockUser.id,
        }),
      })
    );

    expect(RNIap.finishTransaction).toHaveBeenCalledWith({
      purchase: mockPurchase,
      isConsumable: false,
    });
  });

  it('should handle validation failure during purchase', async () => {
    // Arrange
    const productId = 'com.renvo.basic.monthly';
    const mockPurchase = {
      transactionId: mockTransactionId,
      productId,
      transactionReceipt: mockReceipt,
    };

    (RNIap.requestPurchase as jest.Mock).mockResolvedValue(undefined);
    
    // Mock validation failure
    (supabase.functions.invoke as jest.Mock).mockResolvedValue({
      data: { success: false, error: 'Invalid receipt' },
      error: null,
    });

    // Act
    await appleIAPService.purchaseSubscription(productId);
    const purchaseListener = (RNIap.purchaseUpdatedListener as jest.Mock).mock.calls[0][0];

    // Assert
    await expect(purchaseListener(mockPurchase)).rejects.toThrow('Invalid receipt');
    expect(RNIap.finishTransaction).not.toHaveBeenCalled();
  });
});
```

### Test Suite 4: Restore with Validation

File: `__tests__/integration/restore-flow.test.ts`

```typescript
describe('Restore Purchases Integration', () => {
  const mockUser = { id: 'test-user-123' };
  const mockPurchases = [
    {
      transactionId: '1000000123456789',
      productId: 'com.renvo.basic.monthly',
      transactionReceipt: 'base64_receipt',
      transactionDate: new Date().toISOString(),
      originalTransactionIdentifierIOS: '1000000000000001',
    },
  ];

  beforeEach(async () => {
    jest.clearAllMocks();
    
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    (RNIap.initConnection as jest.Mock).mockResolvedValue(true);
    await appleIAPService.initialize();
  });

  it('should restore and validate purchases', async () => {
    // Arrange
    (RNIap.getAvailablePurchases as jest.Mock).mockResolvedValue(mockPurchases);
    (supabase.functions.invoke as jest.Mock).mockResolvedValue({
      data: { success: true },
      error: null,
    });

    // Act
    const result = await appleIAPService.restorePurchases();

    // Assert
    expect(result.success).toBe(true);
    expect(result.purchases).toHaveLength(1);
    expect(supabase.functions.invoke).toHaveBeenCalledWith(
      'validate-apple-receipt',
      expect.any(Object)
    );
    expect(RNIap.finishTransaction).toHaveBeenCalledTimes(1);
  });
});
```

---

## Component Tests

### Test Suite 5: PaywallModal Component

File: `__tests__/components/PaywallModal.test.tsx`

```typescript
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import PaywallModal from '../../components/PaywallModal';
import { appleIAPService } from '../../services/appleIAPService';

jest.mock('../../services/appleIAPService');

describe('PaywallModal Component', () => {
  const mockOnClose = jest.fn();
  const mockOnUpgradePress = jest.fn();
  const mockProducts = [
    {
      productId: 'com.renvo.basic.monthly',
      title: 'Monthly Premium',
      price: 4.99,
      localizedPrice: '$4.99',
    },
    {
      productId: 'com.renvo.basic.yearly',
      title: 'Yearly Premium',
      price: 39.99,
      localizedPrice: '$39.99',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (appleIAPService.initialize as jest.Mock).mockResolvedValue(undefined);
    (appleIAPService.getProducts as jest.Mock).mockResolvedValue(mockProducts);
  });

  it('should render modal when visible', () => {
    const { getByText } = render(
      <PaywallModal
        visible={true}
        onClose={mockOnClose}
        onUpgradePress={mockOnUpgradePress}
        currentCount={3}
        maxCount={3}
      />
    );

    expect(getByText('Upgrade to Premium')).toBeTruthy();
  });

  it('should fetch and display IAP products on iOS', async () => {
    const { getByText } = render(
      <PaywallModal
        visible={true}
        onClose={mockOnClose}
        onUpgradePress={mockOnUpgradePress}
        currentCount={3}
        maxCount={3}
      />
    );

    await waitFor(() => {
      expect(appleIAPService.initialize).toHaveBeenCalled();
      expect(appleIAPService.getProducts).toHaveBeenCalled();
    });
  });

  it('should call onUpgradePress when monthly button tapped', () => {
    const { getByText } = render(
      <PaywallModal
        visible={true}
        onClose={mockOnClose}
        onUpgradePress={mockOnUpgradePress}
        currentCount={3}
        maxCount={3}
      />
    );

    const monthlyButton = getByText('Choose Monthly');
    fireEvent.press(monthlyButton);

    expect(mockOnUpgradePress).toHaveBeenCalledWith('monthly');
  });

  it('should call onUpgradePress when yearly button tapped', () => {
    const { getByText } = render(
      <PaywallModal
        visible={true}
        onClose={mockOnClose}
        onUpgradePress={mockOnUpgradePress}
        currentCount={3}
        maxCount={3}
      />
    );

    const yearlyButton = getByText('Choose Yearly');
    fireEvent.press(yearlyButton);

    expect(mockOnUpgradePress).toHaveBeenCalledWith('yearly');
  });

  it('should display current usage count', () => {
    const { getByText } = render(
      <PaywallModal
        visible={true}
        onClose={mockOnClose}
        onUpgradePress={mockOnUpgradePress}
        currentCount={3}
        maxCount={3}
      />
    );

    expect(getByText('3/3 Recurring Items Used')).toBeTruthy();
  });

  it('should handle loading state while fetching products', () => {
    const { queryByTestId } = render(
      <PaywallModal
        visible={true}
        onClose={mockOnClose}
        onUpgradePress={mockOnUpgradePress}
        currentCount={3}
        maxCount={3}
      />
    );

    // Initially loading
    expect(queryByTestId('loading-indicator')).toBeTruthy();
  });
});
```

---

## Backend Function Tests

### Test Suite 6: Receipt Validation Function

File: `__tests__/functions/validate-receipt.test.ts`

```typescript
// Note: This would be run in Deno environment for Supabase functions
// Using pseudo-code for structure

describe('validate-apple-receipt Function', () => {
  const mockReceipt = 'base64_encoded_receipt_data';
  const mockUserId = 'user-123';

  beforeEach(() => {
    // Setup Supabase client mocks
    // Setup fetch mock for Apple API
  });

  it('should validate receipt with Apple sandbox API', async () => {
    // Arrange
    const mockAppleResponse = {
      status: 0,
      receipt: {
        bundle_id: 'com.renvo',
        in_app: [
          {
            product_id: 'com.renvo.basic.monthly',
            transaction_id: '1000000123456789',
            purchase_date_ms: Date.now().toString(),
            expires_date_ms: (Date.now() + 30 * 24 * 60 * 60 * 1000).toString(),
          },
        ],
      },
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockAppleResponse,
    });

    // Act
    const response = await validateReceipt({
      receiptData: mockReceipt,
      userId: mockUserId,
    });

    // Assert
    expect(response.success).toBe(true);
    expect(response.subscription.tier).toBe('premium');
  });

  it('should retry with sandbox URL if production returns sandbox receipt', async () => {
    // Arrange - First call returns status 21007 (sandbox receipt in production)
    const prodResponse = { status: 21007 };
    const sandboxResponse = {
      status: 0,
      receipt: { /* valid receipt */ },
    };

    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => prodResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => sandboxResponse,
      });

    // Act
    const response = await validateReceipt({
      receiptData: mockReceipt,
      userId: mockUserId,
    });

    // Assert
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(response.success).toBe(true);
  });

  it('should update database after successful validation', async () => {
    // Test database update logic
  });

  it('should prevent replay attacks (duplicate transaction IDs)', async () => {
    // Test idempotency
  });
});
```

### Test Suite 7: Webhook Handler Function

File: `__tests__/functions/apple-webhook.test.ts`

```typescript
describe('apple-webhook Function', () => {
  const mockTransactionInfo = {
    transactionId: '1000000123456789',
    originalTransactionId: '1000000000000001',
    productId: 'com.renvo.basic.monthly',
    purchaseDate: Date.now(),
    expiresDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
  };

  describe('DID_RENEW notification', () => {
    it('should process renewal and update database', async () => {
      // Arrange
      const notification = {
        notificationType: 'DID_RENEW',
        data: {
          signedTransactionInfo: createMockJWT(mockTransactionInfo),
        },
      };

      // Act
      const response = await handleWebhook(notification);

      // Assert
      expect(response.success).toBe(true);
      // Verify database updated with new expiration date
    });
  });

  describe('EXPIRED notification', () => {
    it('should downgrade user to free tier', async () => {
      // Arrange
      const notification = {
        notificationType: 'EXPIRED',
        data: {
          signedTransactionInfo: createMockJWT(mockTransactionInfo),
        },
      };

      // Act
      const response = await handleWebhook(notification);

      // Assert
      expect(response.success).toBe(true);
      // Verify user downgraded to free tier
    });
  });

  describe('REFUND notification', () => {
    it('should revoke access immediately', async () => {
      // Arrange
      const notification = {
        notificationType: 'REFUND',
        data: {
          signedTransactionInfo: createMockJWT(mockTransactionInfo),
        },
      };

      // Act
      const response = await handleWebhook(notification);

      // Assert
      expect(response.success).toBe(true);
      // Verify access revoked
    });
  });
});

function createMockJWT(payload: any): string {
  // Create mock JWT for testing
  const header = btoa(JSON.stringify({ alg: 'ES256' }));
  const body = btoa(JSON.stringify(payload));
  const signature = 'mock_signature';
  return `${header}.${body}.${signature}`;
}
```

---

## Test Data & Fixtures

### Mock Data File

File: `__tests__/fixtures/iapMockData.ts`

```typescript
export const mockIAPProducts = [
  {
    productId: 'com.renvo.basic.monthly',
    title: 'Monthly Premium',
    description: 'Unlimited recurring items, billed monthly',
    price: 4.99,
    currency: 'USD',
    localizedPrice: '$4.99',
    subscriptionPeriod: 'P1M',
    type: 'subscription' as const,
  },
  {
    productId: 'com.renvo.basic.yearly',
    title: 'Yearly Premium',
    description: 'Unlimited recurring items, billed annually',
    price: 39.99,
    currency: 'USD',
    localizedPrice: '$39.99',
    subscriptionPeriod: 'P1Y',
    type: 'subscription' as const,
  },
];

export const mockPurchase = {
  transactionId: '1000000123456789',
  productId: 'com.renvo.basic.monthly',
  transactionReceipt: 'bW9ja19yZWNlaXB0X2RhdGE=',
  transactionDate: new Date('2024-01-01T00:00:00Z').toISOString(),
  originalTransactionIdentifierIOS: '1000000000000001',
  purchaseState: 'purchased' as const,
};

export const mockAppleReceiptResponse = {
  status: 0,
  environment: 'Sandbox' as const,
  receipt: {
    bundle_id: 'com.renvo',
    application_version: '1.0.0',
    in_app: [
      {
        quantity: '1',
        product_id: 'com.renvo.basic.monthly',
        transaction_id: '1000000123456789',
        original_transaction_id: '1000000000000001',
        purchase_date: '2024-01-01 00:00:00 Etc/GMT',
        purchase_date_ms: '1704067200000',
        expires_date: '2024-02-01 00:00:00 Etc/GMT',
        expires_date_ms: '1706745600000',
      },
    ],
  },
};

export const mockWebhookPayload = {
  signedPayload: 'eyJhbGciOiJFUzI1NiIsIng1YyI6WyJNSUlCb1RDQ0FVZWdBd0lCQWdJQkFUQU5CZ2txaGtpRzl3MEJBUXNGYURDQ...',
};

export const mockUser = {
  id: 'test-user-123',
  email: 'test@example.com',
  created_at: new Date().toISOString(),
};
```

### Test Helpers File

File: `__tests__/helpers/testHelpers.ts`

```typescript
import { supabase } from '../../config/supabase';

export function mockSupabaseAuth(user = mockUser) {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({
    data: { user },
    error: null,
  });
}

export function mockSupabaseFunctionSuccess(data: any) {
  (supabase.functions.invoke as jest.Mock).mockResolvedValue({
    data,
    error: null,
  });
}

export function mockSupabaseFunctionError(error: string) {
  (supabase.functions.invoke as jest.Mock).mockResolvedValue({
    data: null,
    error: { message: error },
  });
}

export function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

---

## CI/CD Integration

### GitHub Actions Workflow

File: `.github/workflows/test.yml`

```yaml
name: Run Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Run type check
        run: npx tsc --noEmit

      - name: Run tests
        run: npm test -- --coverage --maxWorkers=2

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
          files: ./coverage/coverage-final.json
          flags: unittests
          name: codecov-umbrella

      - name: Check coverage thresholds
        run: npm run test:coverage

  lint:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run ESLint
        run: npm run lint

      - name: Run Prettier check
        run: npm run format:check
```

### NPM Scripts

Add to [`package.json`](../package.json):

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --ci --coverage --maxWorkers=2",
    "lint": "eslint . --ext .ts,.tsx",
    "format:check": "prettier --check \"**/*.{ts,tsx,json,md}\""
  }
}
```

---

## Code Coverage Requirements

### Coverage Targets

| Area | Target Coverage |
|------|----------------|
| **Services** | 80%+ |
| **Config** | 70%+ |
| **Components** | 70%+ |
| **Utils** | 80%+ |
| **Overall** | 70%+ |

### Coverage Reports

Generate coverage reports:

```bash
# Run tests with coverage
npm run test:coverage

# Open HTML coverage report
open coverage/lcov-report/index.html
```

### Critical Paths

Ensure 100% coverage for:
- ✅ Purchase initiation
- ✅ Receipt validation
- ✅ Purchase restoration
- ✅ Error handling in payment flows
- ✅ Database update logic

---

## Running Tests

### Local Development

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- appleIAPService.test.ts

# Run tests with coverage
npm run test:coverage
```

### Pre-Commit Hook

Add to `.git/hooks/pre-commit`:

```bash
#!/bin/sh
npm run lint
npm test -- --bail --findRelatedTests
```

### Continuous Integration

Tests run automatically on:
- Every push to main/develop
- Every pull request
- Before deployment

---

## Test Maintenance

### Best Practices

1. **Keep Tests Fast**: Unit tests < 5 seconds total
2. **Isolate Dependencies**: Mock external services
3. **Clear Naming**: Describe what's being tested
4. **One Assertion**: Focus on single behavior
5. **Update with Code**: Keep tests in sync

### Regular Reviews

- **Weekly**: Review failing tests
- **Monthly**: Update mock data
- **Quarterly**: Refactor test structure

---

## Next Steps

After automated testing setup:

1. ✅ Run full test suite locally
2. ✅ Verify CI/CD pipeline
3. ✅ Review coverage reports
4. ✅ Proceed to [App Store Review preparation](APP_STORE_REVIEW_CHECKLIST.md)
5. ✅ Follow [Testing Execution Guide](TESTING_EXECUTION_GUIDE.md)

---

## Resources

- [Jest Documentation](https://jestjs.io/)
- [React Native Testing Library](https://callstack.github.io/react-native-testing-library/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Supabase Edge Functions Testing](https://supabase.com/docs/guides/functions/unit-test)

---

**Version History**:
- v1.0.0 (2025-12-06): Initial automated testing plan