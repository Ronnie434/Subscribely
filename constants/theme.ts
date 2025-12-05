import { Platform } from 'react-native';
import { colors } from './colors';

export type ThemeColorMode = 'light' | 'dark';

/**
 * Factory function to create a theme based on color mode
 * @param mode - 'light' or 'dark'
 * @returns Complete theme object with colors, spacing, typography, etc.
 */
export function createTheme(mode: ThemeColorMode) {
  const colorPalette = mode === 'light' ? colors.light : colors.dark;
  
  const gradients = {
    primary: ['#007AFF', '#0056D2'] as readonly [string, string],
    accent: ['#007AFF', '#5856D6'] as readonly [string, string],
    surface: (mode === 'light'
      ? ['#F8F9FA', '#FFFFFF']
      : ['#1A1A1C', '#2C2C2E']) as readonly [string, string],
    card: (mode === 'light'
      ? ['#FFFFFF', '#F8F9FA']
      : ['#1C1C1E', '#2C2C2E']) as readonly [string, string],
    success: (mode === 'light'
      ? ['#34C759', '#30D158']
      : ['#32D74B', '#30D158']) as readonly [string, string],
    error: (mode === 'light'
      ? ['#FF3B30', '#FF453A']
      : ['#FF453A', '#FF6961']) as readonly [string, string],
  };
  
  return {
    colors: colorPalette,
    gradients,
    animation: {
      timing: {
        fast: 150,
        normal: 250,
        slow: 400,
      },
      spring: {
        damping: 15,
        mass: 1,
        stiffness: 150,
      },
    },
    spacing: {
      xs: 4,
      sm: 8,
      md: 16,
      lg: 24,
      xl: 32,
      xxl: 48,
    },
    typography: {
      h1: {
        fontSize: 32,
        fontWeight: '700' as const,
        lineHeight: 40,
      },
      h2: {
        fontSize: 24,
        fontWeight: '600' as const,
        lineHeight: 32,
      },
      h3: {
        fontSize: 20,
        fontWeight: '600' as const,
        lineHeight: 28,
      },
      body: {
        fontSize: 16,
        fontWeight: '400' as const,
        lineHeight: 24,
      },
      bodyBold: {
        fontSize: 16,
        fontWeight: '600' as const,
        lineHeight: 24,
      },
      caption: {
        fontSize: 14,
        fontWeight: '400' as const,
        lineHeight: 20,
      },
      captionBold: {
        fontSize: 14,
        fontWeight: '600' as const,
        lineHeight: 20,
      },
    },
    borderRadius: {
      sm: 8,
      md: 12,
      lg: 16,
      xl: 24,
      full: 9999,
    },
    shadows: {
      sm: Platform.select({
        ios: {
          shadowColor: colorPalette.shadow,
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: mode === 'light' ? 0.1 : 0.3,
          shadowRadius: 2,
        },
        android: {
          elevation: 2,
        },
      }),
      md: Platform.select({
        ios: {
          shadowColor: colorPalette.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: mode === 'light' ? 0.15 : 0.35,
          shadowRadius: 4,
        },
        android: {
          elevation: 4,
        },
      }),
      lg: Platform.select({
        ios: {
          shadowColor: colorPalette.shadow,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: mode === 'light' ? 0.2 : 0.4,
          shadowRadius: 8,
        },
        android: {
          elevation: 8,
        },
      }),
    },
    isDark: mode === 'dark',
  };
}

// Export default theme for backward compatibility during migration
export const theme = createTheme('dark');

