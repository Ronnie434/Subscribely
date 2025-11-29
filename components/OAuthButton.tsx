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
  const { theme } = useTheme();

  const isApple = provider === 'apple';
  const isGoogle = provider === 'google';

  const buttonStyles = [
    styles.button,
    isApple && styles.appleButton,
    isGoogle && [styles.googleButton, { borderColor: theme.colors.border }],
    disabled && styles.disabled,
  ];

  const textStyles = [
    styles.buttonText,
    isApple && styles.appleText,
    isGoogle && { color: theme.colors.text },
  ];

  const getIcon = () => {
    if (loading) {
      return (
        <ActivityIndicator
          size="small"
          color={isApple ? '#FFFFFF' : theme.colors.text}
          style={styles.icon}
        />
      );
    }

    if (isApple) {
      return (
        <Ionicons
          name="logo-apple"
          size={20}
          color="#FFFFFF"
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
          color="#4285F4"
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
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
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
  appleButton: {
    backgroundColor: '#000000',
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
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
  appleText: {
    color: '#FFFFFF',
  },
});