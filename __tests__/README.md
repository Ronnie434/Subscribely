# Smart Subscription Tracker - Testing Framework

## Overview

This testing framework provides comprehensive UI and unit testing capabilities for the Smart Subscription Tracker React Native application. It includes utilities for testing authentication flows, subscription management, real-time updates, and payment integration.

## Test Structure

```
__tests__/
├── setup/
│   └── test-utils.tsx       # Testing utilities and custom render functions
├── fixtures/
│   └── mockData.ts          # Mock data for testing
├── mocks/
│   └── services.ts          # Mock service implementations
├── screens/                 # Screen component tests
│   └── StatsScreen.test.tsx
├── utils/                   # Utility function tests
│   ├── calculations.test.ts
│   └── dateHelpers.test.ts
└── example/
    └── HomeScreen.test.tsx  # Example test demonstrating best practices
```

## Key Features

### 1. Custom Test Utilities (`test-utils.tsx`)

- **Custom render function** with all providers (Auth, Theme, Navigation, Stripe)
- **Mock contexts** for authentication and navigation
- **Helper functions** for common testing scenarios
- **Async test utilities** for handling loading states

### 2. Mock Data (`mockData.ts`)

- Pre-configured mock users (authenticated, premium, etc.)
- Sample subscriptions with various states
- Test data generators for dynamic scenarios
- Mock API responses for different states (success, error, empty)

### 3. Service Mocks (`services.ts`)

- Mock implementations for all services
- Configurable responses for different test scenarios
- Helper to reset all mocks between tests
- Setup functions for common scenarios

## Running Tests

### Basic Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run only UI tests
npm run test:ui

# Run only unit tests
npm run test:unit

# Run only screen tests
npm run test:screens

# Debug tests
npm run test:debug

# Clear Jest cache
npm run test:clear

# Update snapshots
npm run test:update-snapshots
```

## Writing Tests

### Basic Screen Test

```typescript
import React from 'react';
import { render, fireEvent, waitFor } from '../setup/test-utils';
import MyScreen from '../../screens/MyScreen';
import { mockSubscriptions } from '../fixtures/mockData';

describe('MyScreen', () => {
  it('should render correctly', async () => {
    const { getByText } = render(<MyScreen />);
    
    await waitFor(() => {
      expect(getByText('Expected Text')).toBeTruthy();
    });
  });
});
```

### Testing with Authentication

```typescript
import { render, createAuthenticatedContext } from '../setup/test-utils';
import ProtectedScreen from '../../screens/ProtectedScreen';

describe('ProtectedScreen', () => {
  it('should render for authenticated user', () => {
    const { getByText } = render(<ProtectedScreen />, {
      authContextValue: createAuthenticatedContext({
        email: 'rox434@gmail.com'
      })
    });
    
    expect(getByText('Welcome')).toBeTruthy();
  });
});
```

### Testing Navigation

```typescript
import { render } from '../setup/test-utils';
import ScreenWithNavigation from '../../screens/ScreenWithNavigation';

describe('ScreenWithNavigation', () => {
  it('should navigate when button is pressed', () => {
    const mockNavigate = jest.fn();
    const { getByText } = render(<ScreenWithNavigation />, {
      navigation: { navigate: mockNavigate }
    });
    
    fireEvent.press(getByText('Go to Next'));
    expect(mockNavigate).toHaveBeenCalledWith('NextScreen');
  });
});
```

### Testing Async Operations

```typescript
import { render, waitFor, setupMockResponses } from '../setup/test-utils';
import DataScreen from '../../screens/DataScreen';

describe('DataScreen', () => {
  beforeEach(() => {
    setupMockResponses('success');
  });

  it('should load and display data', async () => {
    const { getByText, queryByTestId } = render(<DataScreen />);
    
    // Initially shows loading
    expect(queryByTestId('loading-indicator')).toBeTruthy();
    
    // Wait for data to load
    await waitFor(() => {
      expect(getByText('Data Loaded')).toBeTruthy();
    });
    
    // Loading indicator should be gone
    expect(queryByTestId('loading-indicator')).toBeNull();
  });
});
```

### Testing Subscription Limits

```typescript
import { render, fireEvent, Alert } from '../setup/test-utils';
import { mockSubscriptionLimitService } from '../mocks/services';
import HomeScreen from '../../screens/HomeScreen';

describe('Subscription Limits', () => {
  it('should prevent adding when at limit', async () => {
    mockSubscriptionLimitService.checkLimit.mockResolvedValue({
      canAdd: false,
      currentCount: 3,
      limit: 3
    });
    
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByTestId } = render(<HomeScreen />);
    
    fireEvent.press(getByTestId('add-subscription-button'));
    
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Subscription Limit Reached',
        expect.any(String),
        expect.any(Array)
      );
    });
  });
});
```

## Test Data

### Using Mock Data

```typescript
import { 
  mockSubscriptions,
  createMockSubscription,
  testScenarios,
  mockFormData 
} from '../fixtures/mockData';

// Use pre-defined subscriptions
const netflix = mockSubscriptions[0];

// Create custom subscription
const customSub = createMockSubscription({
  name: 'Custom Service',
  cost: 19.99
});

// Use test scenarios
const { user, subscriptions } = testScenarios.freeTierLimit();

// Use form data for testing inputs
const { validLogin } = mockFormData.authentication;
```

## Authentication Testing

### Test Credentials

- **Email**: rox434@gmail.com
- **Password**: 12345678

### Testing Auth Flows

```typescript
describe('Authentication', () => {
  it('should login with valid credentials', async () => {
    const { getByTestId } = render(<LoginScreen />);
    
    fireEvent.changeText(getByTestId('email-input'), 'rox434@gmail.com');
    fireEvent.changeText(getByTestId('password-input'), '12345678');
    fireEvent.press(getByTestId('login-button'));
    
    await waitFor(() => {
      expect(mockAuth.signIn).toHaveBeenCalledWith(
        'rox434@gmail.com',
        '12345678'
      );
    });
  });
});
```

## Mocking Best Practices

### 1. Reset Mocks Between Tests

```typescript
beforeEach(() => {
  jest.clearAllMocks();
  resetServiceMocks();
});
```

### 2. Setup Mock Responses

```typescript
beforeEach(() => {
  setupMockResponses('success'); // or 'error', 'empty'
});
```

### 3. Mock Specific Behaviors

```typescript
mockStorage.getAll.mockResolvedValue(mockSubscriptions);
mockStorage.refresh.mockRejectedValue(new Error('Network error'));
```

## Coverage Requirements

The project has the following coverage thresholds:

- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%
- **Statements**: 70%

Run `npm run test:coverage` to check current coverage.

## Debugging Tests

### Using Debug Mode

```bash
npm run test:debug
```

Then open Chrome and navigate to `chrome://inspect` to debug.

### Logging Test State

```typescript
import { logTestState } from '../setup/test-utils';

it('should debug component', () => {
  const component = render(<MyComponent />);
  logTestState(component, 'After Render');
});
```

Set `DEBUG_TESTS=true` environment variable to enable debug logging.

## Common Issues and Solutions

### 1. Async Warnings

Always wrap async operations in `waitFor`:

```typescript
await waitFor(() => {
  expect(getByText('Loaded')).toBeTruthy();
});
```

### 2. Navigation Not Working

Ensure you're passing mock navigation props:

```typescript
const mockNavigate = jest.fn();
render(<Screen />, {
  navigation: { navigate: mockNavigate }
});
```

### 3. Context Not Available

Use the custom render function with context options:

```typescript
render(<Screen />, {
  authContextValue: createAuthenticatedContext()
});
```

### 4. Timer Issues

Use fake timers for time-dependent tests:

```typescript
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});
```

## CI/CD Integration

The test suite is designed to run in CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Run Tests
  run: |
    npm install
    npm run test:coverage
    
- name: Upload Coverage
  uses: codecov/codecov-action@v2
  with:
    file: ./coverage/lcov.info
```

## Contributing

When adding new tests:

1. Follow the existing file structure
2. Use mock data from `fixtures/mockData.ts`
3. Reset mocks in `beforeEach`
4. Test both success and error scenarios
5. Add meaningful test descriptions
6. Ensure tests are deterministic (no random failures)

## Support

For issues or questions about testing:

1. Check this README first
2. Look at example tests in `__tests__/example/`
3. Review the test utilities in `__tests__/setup/`
4. Check mock implementations in `__tests__/mocks/`