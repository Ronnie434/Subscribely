import React, { ReactElement, ReactNode } from 'react';
import { render, RenderOptions, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StripeProvider } from '@stripe/stripe-react-native';
import { AuthProvider } from '../../contexts/AuthContext';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { stripeConfig } from '../../config/stripe';

// Create mock implementations for contexts
export const mockAuthContext = {
  user: null,
  session: null,
  loading: false,
  error: null,
  isHandlingDuplicate: false,
  signUp: jest.fn(),
  signIn: jest.fn(),
  signOut: jest.fn(),
  resetPassword: jest.fn(),
  clearError: jest.fn(),
  clearDuplicateFlag: jest.fn(),
};

export const mockNavigationProp = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  dispatch: jest.fn(),
  setOptions: jest.fn(),
  addListener: jest.fn(),
  removeListener: jest.fn(),
  isFocused: jest.fn(() => true),
  canGoBack: jest.fn(() => true),
  getParent: jest.fn(),
  getState: jest.fn(),
  reset: jest.fn(),
  setParams: jest.fn(),
  getId: jest.fn(),
};

export const mockRouteProp = {
  key: 'test-key',
  name: 'TestScreen',
  params: {},
};

// Custom render function with all providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  authContextValue?: Partial<typeof mockAuthContext>;
  initialNavigationState?: any;
  withNavigation?: boolean;
  withAuth?: boolean;
  withTheme?: boolean;
  withStripe?: boolean;
}

// All providers wrapper
function AllTheProviders({ 
  children,
  authContextValue = mockAuthContext,
  withNavigation = true,
  withAuth = true,
  withTheme = true,
  withStripe = true,
}: { 
  children: ReactNode;
  authContextValue?: any;
  withNavigation?: boolean;
  withAuth?: boolean;
  withTheme?: boolean;
  withStripe?: boolean;
}) {
  let content = children;

  if (withAuth) {
    // Mock AuthProvider
    const MockAuthProvider = ({ children }: { children: ReactNode }) => {
      const AuthContext = React.createContext(authContextValue);
      return <AuthContext.Provider value={authContextValue}>{children}</AuthContext.Provider>;
    };
    content = <MockAuthProvider>{content}</MockAuthProvider>;
  }

  if (withTheme) {
    content = <ThemeProvider>{content}</ThemeProvider>;
  }

  if (withNavigation) {
    content = <NavigationContainer>{content}</NavigationContainer>;
  }

  if (withStripe && content) {
    content = (
      <StripeProvider
        publishableKey={stripeConfig.publishableKey}
        merchantIdentifier={stripeConfig.merchantIdentifier}
        urlScheme={stripeConfig.urlScheme}>
        {content as any}
      </StripeProvider>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {content}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const customRender = (
  ui: ReactElement,
  {
    authContextValue = mockAuthContext,
    withNavigation = true,
    withAuth = true,
    withTheme = true,
    withStripe = true,
    ...renderOptions
  }: CustomRenderOptions = {}
) => {
  return render(ui, {
    wrapper: ({ children }) => (
      <AllTheProviders
        authContextValue={authContextValue}
        withNavigation={withNavigation}
        withAuth={withAuth}
        withTheme={withTheme}
        withStripe={withStripe}
      >
        {children}
      </AllTheProviders>
    ),
    ...renderOptions,
  });
};

// Export everything from React Native Testing Library
export * from '@testing-library/react-native';

// Override the default render with our custom one
export { customRender as render, fireEvent, waitFor };

// Utility function to create authenticated context
export function createAuthenticatedContext(userOverrides = {}) {
  return {
    ...mockAuthContext,
    user: {
      id: 'test-user-123',
      email: 'test@example.com',
      created_at: '2025-01-01T00:00:00.000Z',
      ...userOverrides,
    },
    session: {
      access_token: 'test-token',
      refresh_token: 'test-refresh-token',
      expires_at: Date.now() + 3600000, // 1 hour from now
      user: {
        id: 'test-user-123',
        email: 'test@example.com',
        ...userOverrides,
      },
    },
    loading: false,
    error: null,
  };
}

// Wait for async operations
export const waitForAsyncUpdates = () => 
  new Promise(resolve => setTimeout(resolve, 0));

// Mock navigation helpers
export const createMockNavigation = (overrides = {}) => ({
  ...mockNavigationProp,
  ...overrides,
});

export const createMockRoute = (name: string, params = {}) => ({
  ...mockRouteProp,
  name,
  params,
});

// Helper to test component with specific props
export function renderWithProps<T extends Record<string, any>>(
  Component: React.ComponentType<T>,
  props: T,
  renderOptions?: CustomRenderOptions
) {
  return render(<Component {...props} />, renderOptions);
}

// Helper for testing screens with navigation
export function renderScreen(
  Screen: React.ComponentType<any>,
  {
    navigation = mockNavigationProp,
    route = mockRouteProp,
    ...renderOptions
  }: CustomRenderOptions & {
    navigation?: any;
    route?: any;
  } = {}
) {
  return render(
    <Screen navigation={navigation} route={route} />,
    renderOptions
  );
}

// Async test helpers
export async function waitForLoadingToFinish(getByTestId: any) {
  try {
    await waitFor(() => {
      expect(() => getByTestId('loading-indicator')).toThrow();
    });
  } catch {
    // Loading indicator not found, which is what we want
  }
}

// Form input helpers
export async function fillInput(getByTestId: any, testId: string, value: string) {
  const input = getByTestId(testId);
  fireEvent.changeText(input, value);
  await waitForAsyncUpdates();
}

export async function submitForm(getByTestId: any, buttonTestId: string) {
  const button = getByTestId(buttonTestId);
  fireEvent.press(button);
  await waitForAsyncUpdates();
}

// Debug helpers
export function logTestState(component: any, label = 'Test State') {
  if (process.env.DEBUG_TESTS) {
    console.log(`\n=== ${label} ===`);
    console.log(component.toJSON());
    console.log('================\n');
  }
}