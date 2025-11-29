import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

type OAuthProvider = 'google' | 'apple';

interface OAuthButtonProps {
  provider: OAuthProvider;
  onPress: () => void | Promise<void>;
  disabled?: boolean;
  loading?: boolean;
}

export default function OAuthButton({
  provider,
  onPress,
  disabled = false,
  loading = false,
}: OAuthButtonProps) {
  const { theme, activeColorScheme } = useTheme();

  const isApple = provider === 'apple';
  const isGoogle = provider === 'google';
  const isDarkMode = activeColorScheme === 'dark';

  // Theme-aware button styles
  const getButtonStyle = () => {
    if (isApple) {
      // Apple button: Black in light mode, White in dark mode
      return {
        backgroundColor: isDarkMode ? '#FFFFFF' : '#000000',
      };
    }
    // Google button: White in light mode, Surface color in dark mode
    return {
      backgroundColor: isDarkMode ? theme.colors.surface : '#FFFFFF',
      borderColor: theme.colors.border,
      borderWidth: 1,
    };
  };

  // Theme-aware text styles
  const getTextStyle = () => {
    if (isApple) {
      // Apple text: White in light mode, Black in dark mode
      return {
        color: isDarkMode ? '#000000' : '#FFFFFF',
      };
    }
    // Google text: Use theme text color
    return {
      color: theme.colors.text,
    };
  };

  // Theme-aware icon color
  const getIconColor = () => {
    if (loading) {
      return isApple
        ? (isDarkMode ? '#000000' : '#FFFFFF')
        : theme.colors.text;
    }
    
    if (isApple) {
      // Apple icon: White in light mode, Black in dark mode
      return isDarkMode ? '#000000' : '#FFFFFF';
    }
    
    // Google icon: Keep brand color
    return '#4285F4';
  };

  const buttonStyles = [
    styles.button,
    getButtonStyle(),
    disabled && styles.disabled,
  ];

  const textStyles = [
    styles.buttonText,
    getTextStyle(),
  ];

  const getIcon = () => {
    if (loading) {
      return (
        <ActivityIndicator
          size="small"
          color={getIconColor()}
          style={styles.icon}
        />
      );
    }

    if (isApple) {
      return (
        <Ionicons
          name="logo-apple"
          size={20}
          color={getIconColor()}
          style={styles.icon}
        />
      );
    }

    // Google logo using custom styling
    return (
      <View style={styles.googleIconContainer}>
        <Ionicons
          name="logo-google"
          size={20}
          color={getIconColor()}
          style={styles.icon}
        />
      </View>
    );
  };

  const getLabel = () => {
    if (isApple) {
      return 'Sign in with Apple';
    }
    return 'Sign in with Google';
  };

  return (
    <TouchableOpacity
      style={buttonStyles}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}>
      <View style={styles.content}>
        {getIcon()}
        <Text style={textStyles}>{getLabel()}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 26,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    minHeight: 52,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  disabled: {
    opacity: 0.6,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: 8,
  },
  googleIconContainer: {
    marginRight: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});