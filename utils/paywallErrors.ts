/**
 * Custom Error Classes for Paywall System
 * 
 * Provides specialized error types for subscription limit enforcement,
 * payment processing, and other paywall-related operations.
 */

/**
 * Error thrown when user exceeds their subscription limit
 */
export class SubscriptionLimitError extends Error {
  constructor(
    message: string,
    public currentCount: number,
    public limit: number,
    public isPremium: boolean
  ) {
    super(message);
    this.name = 'SubscriptionLimitError';
    
    // Maintains proper stack trace for where error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SubscriptionLimitError);
    }
  }

  /**
   * Create a user-friendly error message
   */
  toUserMessage(): string {
    if (this.isPremium) {
      return `You've reached your plan limit of ${this.limit} subscriptions. Please contact support if you need more.`;
    }
    return `You've reached the free plan limit of ${this.limit} subscriptions. Upgrade to Premium for unlimited subscriptions.`;
  }
}

/**
 * Error thrown when payment is required for an action
 */
export class PaymentRequiredError extends Error {
  constructor(
    message: string,
    public requiredPlan?: 'premium',
    public currentPlan?: 'free' | 'premium'
  ) {
    super(message);
    this.name = 'PaymentRequiredError';
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PaymentRequiredError);
    }
  }

  /**
   * Create a user-friendly error message
   */
  toUserMessage(): string {
    if (this.requiredPlan === 'premium') {
      return 'This feature requires a Premium subscription. Upgrade now to continue.';
    }
    return this.message;
  }
}

/**
 * Error thrown when a subscription is not found
 */
export class SubscriptionNotFoundError extends Error {
  constructor(
    message: string,
    public subscriptionId?: string
  ) {
    super(message);
    this.name = 'SubscriptionNotFoundError';
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SubscriptionNotFoundError);
    }
  }

  /**
   * Create a user-friendly error message
   */
  toUserMessage(): string {
    return 'Subscription not found. It may have been deleted.';
  }
}

/**
 * Error thrown when tier information cannot be retrieved
 */
export class TierNotFoundError extends Error {
  constructor(
    message: string,
    public tierId?: string
  ) {
    super(message);
    this.name = 'TierNotFoundError';
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TierNotFoundError);
    }
  }

  /**
   * Create a user-friendly error message
   */
  toUserMessage(): string {
    return 'Subscription plan information not available. Please try again.';
  }
}

/**
 * Error thrown when usage tracking fails
 */
export class UsageTrackingError extends Error {
  constructor(
    message: string,
    public eventType?: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'UsageTrackingError';
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, UsageTrackingError);
    }
  }

  /**
   * Create a user-friendly error message
   */
  toUserMessage(): string {
    // Analytics errors should not affect user experience
    return 'An error occurred while tracking usage. Your action will still proceed.';
  }
}

/**
 * Error thrown when cache operations fail
 */
export class CacheError extends Error {
  constructor(
    message: string,
    public operation?: 'get' | 'set' | 'invalidate' | 'clear',
    public originalError?: Error
  ) {
    super(message);
    this.name = 'CacheError';
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CacheError);
    }
  }
}

/**
 * Type guard to check if an error is a SubscriptionLimitError
 */
export function isSubscriptionLimitError(error: unknown): error is SubscriptionLimitError {
  return error instanceof SubscriptionLimitError;
}

/**
 * Type guard to check if an error is a PaymentRequiredError
 */
export function isPaymentRequiredError(error: unknown): error is PaymentRequiredError {
  return error instanceof PaymentRequiredError;
}

/**
 * Type guard to check if an error is a SubscriptionNotFoundError
 */
export function isSubscriptionNotFoundError(error: unknown): error is SubscriptionNotFoundError {
  return error instanceof SubscriptionNotFoundError;
}

/**
 * Type guard to check if an error is a TierNotFoundError
 */
export function isTierNotFoundError(error: unknown): error is TierNotFoundError {
  return error instanceof TierNotFoundError;
}

/**
 * Type guard to check if an error is a UsageTrackingError
 */
export function isUsageTrackingError(error: unknown): error is UsageTrackingError {
  return error instanceof UsageTrackingError;
}

/**
 * Type guard to check if an error is a CacheError
 */
export function isCacheError(error: unknown): error is CacheError {
  return error instanceof CacheError;
}

/**
 * Get a user-friendly error message from any error type
 */
export function getUserFriendlyErrorMessage(error: unknown): string {
  if (error instanceof SubscriptionLimitError) {
    return error.toUserMessage();
  }
  
  if (error instanceof PaymentRequiredError) {
    return error.toUserMessage();
  }
  
  if (error instanceof SubscriptionNotFoundError) {
    return error.toUserMessage();
  }
  
  if (error instanceof TierNotFoundError) {
    return error.toUserMessage();
  }
  
  if (error instanceof UsageTrackingError) {
    return error.toUserMessage();
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  return 'An unexpected error occurred. Please try again.';
}