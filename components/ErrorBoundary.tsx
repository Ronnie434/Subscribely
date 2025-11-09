import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * ErrorBoundary component that catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI instead of crashing the app.
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error to console for debugging
    console.error('ErrorBoundary caught an error:', error);
    console.error('Error Info:', errorInfo);
    
    // Update state with error details
    this.setState({
      error,
      errorInfo,
    });

    // TODO: In production, send error to error reporting service
    // Example: Sentry.captureException(error, { extra: errorInfo });
  }

  handleReload = () => {
    // Reset the error boundary state
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <View style={styles.container}>
          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <Ionicons name="alert-circle" size={64} color={theme.colors.error} />
            </View>

            <Text style={styles.title}>Oops! Something went wrong</Text>
            <Text style={styles.message}>
              We're sorry for the inconvenience. The app encountered an unexpected error.
            </Text>

            <TouchableOpacity
              style={styles.reloadButton}
              onPress={this.handleReload}
              activeOpacity={0.8}>
              <Ionicons name="refresh" size={20} color="#FFFFFF" style={styles.buttonIcon} />
              <Text style={styles.reloadButtonText}>Try Again</Text>
            </TouchableOpacity>

            {/* Show error details in development */}
            {__DEV__ && this.state.error && (
              <ScrollView style={styles.errorDetails}>
                <Text style={styles.errorDetailsTitle}>Error Details (Development Only):</Text>
                <Text style={styles.errorDetailsText}>
                  {this.state.error.toString()}
                </Text>
                {this.state.errorInfo && (
                  <Text style={styles.errorDetailsText}>
                    {this.state.errorInfo.componentStack}
                  </Text>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  content: {
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
  },
  iconContainer: {
    marginBottom: theme.spacing.xl,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  message: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: theme.spacing.xxl,
  },
  reloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 16,
    paddingHorizontal: 32,
    minWidth: 200,
  },
  buttonIcon: {
    marginRight: theme.spacing.sm,
  },
  reloadButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  errorDetails: {
    marginTop: theme.spacing.xl,
    backgroundColor: '#1C1C1E',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    maxHeight: 200,
    width: '100%',
  },
  errorDetailsTitle: {
    color: theme.colors.error,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: theme.spacing.sm,
  },
  errorDetailsText: {
    color: '#8E8E93',
    fontSize: 12,
    fontFamily: 'Courier',
    lineHeight: 18,
  },
});

export default ErrorBoundary;