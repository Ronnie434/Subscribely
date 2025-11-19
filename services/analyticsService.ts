/**
 * Analytics Service
 * 
 * Centralized service for tracking user events and subscription management actions.
 * Supports multiple analytics providers (Firebase, Mixpanel, Amplitude, etc.)
 */

interface AnalyticsEvent {
  name: string;
  properties?: Record<string, any>;
  timestamp?: Date;
}

type SubscriptionAction =
  | 'subscription_paused'
  | 'subscription_resumed'
  | 'billing_cycle_switched'
  | 'payment_method_updated'
  | 'billing_history_viewed'
  | 'subscription_cancelled'
  | 'cancellation_modal_opened'
  | 'pause_modal_opened'
  | 'billing_cycle_modal_opened'
  | 'billing_portal_opened'
  | 'subscription_management_viewed'
  | 'upgrade_initiated'
  | 'plan_selected';

class AnalyticsService {
  private enabled: boolean = true;
  private userId: string | null = null;

  /**
   * Initialize analytics with user ID
   */
  initialize(userId: string) {
    this.userId = userId;
    console.log('[Analytics] Initialized for user:', userId);
  }

  /**
   * Set whether analytics tracking is enabled
   */
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    console.log('[Analytics] Tracking', enabled ? 'enabled' : 'disabled');
  }

  /**
   * Track a generic event
   */
  trackEvent(eventName: string, properties?: Record<string, any>) {
    if (!this.enabled) return;

    const event: AnalyticsEvent = {
      name: eventName,
      properties: {
        ...properties,
        userId: this.userId,
        timestamp: new Date().toISOString(),
      },
    };

    this.logEvent(event);
    
    // TODO: Send to your analytics provider
    // Examples:
    // - Firebase: analytics().logEvent(eventName, properties)
    // - Mixpanel: mixpanel.track(eventName, properties)
    // - Amplitude: amplitude.track(eventName, properties)
  }

  /**
   * Track subscription pause event
   */
  trackSubscriptionPaused(duration: number) {
    this.trackEvent('subscription_paused', {
      duration_days: duration,
      action_type: 'pause',
    });
  }

  /**
   * Track subscription resume event
   */
  trackSubscriptionResumed() {
    this.trackEvent('subscription_resumed', {
      action_type: 'resume',
    });
  }

  /**
   * Track billing cycle switch
   */
  trackBillingCycleSwitched(fromCycle: string, toCycle: string) {
    this.trackEvent('billing_cycle_switched', {
      from_cycle: fromCycle,
      to_cycle: toCycle,
      action_type: 'billing_change',
    });
  }

  /**
   * Track payment method update
   */
  trackPaymentMethodUpdated() {
    this.trackEvent('payment_method_updated', {
      action_type: 'payment_update',
    });
  }

  /**
   * Track billing history view
   */
  trackBillingHistoryViewed() {
    this.trackEvent('billing_history_viewed', {
      action_type: 'view_history',
    });
  }

  /**
   * Track subscription cancellation
   */
  trackSubscriptionCancelled(immediate: boolean) {
    this.trackEvent('subscription_cancelled', {
      cancellation_type: immediate ? 'immediate' : 'end_of_period',
      action_type: 'cancel',
    });
  }

  /**
   * Track modal opens
   */
  trackModalOpened(modalType: 'cancel' | 'pause' | 'billing_cycle') {
    this.trackEvent(`${modalType}_modal_opened`, {
      modal_type: modalType,
      action_type: 'modal_open',
    });
  }

  /**
   * Track billing portal access
   */
  trackBillingPortalOpened() {
    this.trackEvent('billing_portal_opened', {
      action_type: 'portal_access',
    });
  }

  /**
   * Track subscription management screen view
   */
  trackSubscriptionManagementViewed() {
    this.trackEvent('subscription_management_viewed', {
      screen: 'subscription_management',
      action_type: 'screen_view',
    });
  }

  /**
   * Track upgrade initiation
   */
  trackUpgradeInitiated(plan: string) {
    this.trackEvent('upgrade_initiated', {
      plan,
      action_type: 'upgrade_start',
    });
  }

  /**
   * Track plan selection
   */
  trackPlanSelected(plan: string, price: number) {
    this.trackEvent('plan_selected', {
      plan,
      price,
      action_type: 'plan_selection',
    });
  }

  /**
   * Track error events
   */
  trackError(errorName: string, errorMessage: string, context?: Record<string, any>) {
    this.trackEvent('error_occurred', {
      error_name: errorName,
      error_message: errorMessage,
      ...context,
    });
  }

  /**
   * Set user properties (for analytics providers that support it)
   */
  setUserProperties(properties: Record<string, any>) {
    if (!this.enabled) return;

    console.log('[Analytics] User properties:', properties);
    
    // TODO: Send to your analytics provider
    // Examples:
    // - Firebase: analytics().setUserProperties(properties)
    // - Mixpanel: mixpanel.people.set(properties)
    // - Amplitude: amplitude.setUserProperties(properties)
  }

  /**
   * Log event to console (for debugging)
   */
  private logEvent(event: AnalyticsEvent) {
    if (__DEV__) {
      console.log('[Analytics] Event:', event.name, event.properties);
    }
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService();

// Export class for testing
export default AnalyticsService;