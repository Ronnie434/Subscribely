import { supabase } from '../config/supabase';

/**
 * Database health check and error helper utility
 * Provides user-friendly error messages and troubleshooting guidance
 */

export interface DatabaseCheckResult {
  success: boolean;
  error?: string;
  errorType?: 'connection' | 'tables' | 'rls' | 'auth' | 'unknown';
  userMessage?: string;
  troubleshootingSteps?: string[];
}

/**
 * Check if database tables exist and are accessible
 */
export async function checkDatabaseHealth(): Promise<DatabaseCheckResult> {
  try {
    // Check 1: Test basic connection
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      return {
        success: false,
        error: sessionError.message,
        errorType: 'auth',
        userMessage: 'Authentication service is not available.',
        troubleshootingSteps: [
          'Check your internet connection',
          'Verify Supabase URL and API key in .env file',
          'Ensure your Supabase project is active',
        ],
      };
    }

    // Check 2: Test database access (query subscriptions table)
    const { data, error } = await supabase
      .from('subscriptions')
      .select('id', { count: 'exact', head: true });

    if (error) {
      // Analyze the error to provide specific guidance
      const errorMessage = error.message.toLowerCase();

      // Table doesn't exist
      if (errorMessage.includes('relation') && errorMessage.includes('does not exist')) {
        return {
          success: false,
          error: error.message,
          errorType: 'tables',
          userMessage: 'Database tables have not been created yet.',
          troubleshootingSteps: [
            'Run the database migration from database/supabase_migration.sql',
            'Go to your Supabase dashboard → SQL Editor',
            'Copy and paste the migration SQL',
            'Execute the migration',
            'See SETUP_ERRORS.md for detailed instructions',
          ],
        };
      }

      // RLS policy issue
      if (errorMessage.includes('policy') || errorMessage.includes('permission denied')) {
        return {
          success: false,
          error: error.message,
          errorType: 'rls',
          userMessage: 'Database access is restricted. This may be due to Row Level Security (RLS) policies.',
          troubleshootingSteps: [
            'Ensure you are signed in',
            'Check that RLS policies were created in the migration',
            'Verify policies in Supabase dashboard → Authentication → Policies',
            'Re-run the migration SQL if policies are missing',
          ],
        };
      }

      // Network/connection error
      if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        return {
          success: false,
          error: error.message,
          errorType: 'connection',
          userMessage: 'Unable to connect to the database.',
          troubleshootingSteps: [
            'Check your internet connection',
            'Verify your Supabase project is active',
            'Check Supabase status at status.supabase.com',
            'Try again in a few moments',
          ],
        };
      }

      // Unknown database error
      return {
        success: false,
        error: error.message,
        errorType: 'unknown',
        userMessage: 'A database error occurred.',
        troubleshootingSteps: [
          'Check the error details below',
          'Verify your Supabase configuration',
          'See docs/SETUP_ERRORS.md for troubleshooting',
          'Contact support if issue persists',
        ],
      };
    }

    // All checks passed
    return {
      success: true,
      userMessage: 'Database is healthy and accessible.',
    };
  } catch (error) {
    // Unexpected error during health check
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: errorMessage,
      errorType: 'unknown',
      userMessage: 'An unexpected error occurred while checking database health.',
      troubleshootingSteps: [
        'Check your internet connection',
        'Restart the app',
        'Check console logs for details',
        'See docs/SETUP_ERRORS.md for help',
      ],
    };
  }
}

/**
 * Get a user-friendly error message for database operations
 */
export function getDatabaseErrorMessage(error: any): string {
  const errorMessage = error?.message?.toLowerCase() || '';

  // Table doesn't exist
  if (errorMessage.includes('relation') && errorMessage.includes('does not exist')) {
    return 'Database tables not created. Please run the migration first. See SETUP_ERRORS.md for help.';
  }

  // RLS policy error
  if (errorMessage.includes('policy') || errorMessage.includes('permission denied')) {
    return 'Access denied. Please ensure you are signed in and have proper permissions.';
  }

  // Network error
  if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
    return 'Network error. Please check your internet connection and try again.';
  }

  // Auth error
  if (errorMessage.includes('jwt') || errorMessage.includes('token')) {
    return 'Session expired. Please sign in again.';
  }

  // Generic database error
  if (errorMessage.includes('database') || errorMessage.includes('query')) {
    return 'Database error occurred. Please try again or contact support.';
  }

  // Return original message if no specific match
  return error?.message || 'An unexpected error occurred. Please try again.';
}

/**
 * Check if error indicates missing database tables
 */
export function isMissingTablesError(error: any): boolean {
  const errorMessage = error?.message?.toLowerCase() || '';
  return errorMessage.includes('relation') && errorMessage.includes('does not exist');
}

/**
 * Check if error indicates RLS permission issue
 */
export function isPermissionError(error: any): boolean {
  const errorMessage = error?.message?.toLowerCase() || '';
  return errorMessage.includes('policy') || errorMessage.includes('permission denied');
}

/**
 * Check if error indicates network issue
 */
export function isNetworkError(error: any): boolean {
  const errorMessage = error?.message?.toLowerCase() || '';
  return errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('connection');
}

/**
 * Check if error indicates authentication issue
 */
export function isAuthError(error: any): boolean {
  const errorMessage = error?.message?.toLowerCase() || '';
  return errorMessage.includes('jwt') || errorMessage.includes('token') || errorMessage.includes('auth');
}

/**
 * Format error for display to user
 * Sanitizes technical details while keeping helpful information
 */
export function formatErrorForUser(error: any): { title: string; message: string; details?: string } {
  const errorMessage = error?.message || 'Unknown error';

  if (isMissingTablesError(error)) {
    return {
      title: 'Setup Required',
      message: 'The database tables need to be created before you can use the app.',
      details: 'Please follow the setup instructions in SETUP_ERRORS.md to run the database migration.',
    };
  }

  if (isPermissionError(error)) {
    return {
      title: 'Access Denied',
      message: 'You don\'t have permission to access this data.',
      details: 'Please ensure you are signed in with the correct account.',
    };
  }

  if (isNetworkError(error)) {
    return {
      title: 'Connection Error',
      message: 'Unable to connect to the server.',
      details: 'Please check your internet connection and try again.',
    };
  }

  if (isAuthError(error)) {
    return {
      title: 'Authentication Error',
      message: 'Your session has expired or is invalid.',
      details: 'Please sign in again to continue.',
    };
  }

  // Generic error
  return {
    title: 'Error',
    message: 'Something went wrong.',
    details: __DEV__ ? errorMessage : 'Please try again or contact support if the issue persists.',
  };
}