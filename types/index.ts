export type BillingCycle = 'monthly' | 'yearly';

export interface Subscription {
  id: string;
  name: string;
  cost: number;
  billingCycle: BillingCycle;
  renewalDate: string; // ISO date string
  /** Indicates whether the user manually set the renewal date (vs auto-generated) */
  isCustomRenewalDate?: boolean;
  /** Stores the notification identifier for scheduled reminders (used to cancel/update notifications) */
  notificationId?: string;
  category: string;
  color?: string;
  /** Optional icon identifier for the service (e.g., 'netflix', 'spotify') */
  icon?: string;
  /** Company domain for fetching logo from Clearbit API */
  domain?: string;
  /** Optional flag to enable/disable renewal reminder notifications */
  reminders?: boolean;
  /** Optional description/notes about the subscription */
  description?: string;
  createdAt: string;
  updatedAt: string;
  /** User ID from Supabase auth (for multi-user support) */
  user_id?: string;
}
export type RootStackParamList = {
  Home: undefined;
  AddSubscription: { subscription?: Subscription };
  EditSubscription: { subscription: Subscription };
};

// Supabase Database Types
export interface Database {
  public: {
    Tables: {
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          cost: number;
          billing_cycle: BillingCycle;
          renewal_date: string;
          is_custom_renewal_date: boolean;
          notification_id: string | null;
          category: string;
          color: string | null;
          icon: string | null;
          domain: string | null;
          reminders: boolean;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          cost: number;
          billing_cycle: BillingCycle;
          renewal_date: string;
          is_custom_renewal_date?: boolean;
          notification_id?: string | null;
          category: string;
          color?: string | null;
          icon?: string | null;
          domain?: string | null;
          reminders?: boolean;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          cost?: number;
          billing_cycle?: BillingCycle;
          renewal_date?: string;
          is_custom_renewal_date?: boolean;
          notification_id?: string | null;
          category?: string;
          color?: string | null;
          icon?: string | null;
          domain?: string | null;
          reminders?: boolean;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}

// Auth related types
export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthState {
  user: UserProfile | null;
  session: any | null;
  loading: boolean;
  error: string | null;
}


