-- Fix can_user_add_subscription RPC to handle canceled subscriptions that are still valid
CREATE OR REPLACE FUNCTION can_user_add_subscription(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  v_tier_id TEXT;
  v_status TEXT;
  v_cancel_at_period_end BOOLEAN;
  v_current_period_end TIMESTAMPTZ;
  v_payment_provider TEXT;
  v_apple_expiry TIMESTAMPTZ;
  v_tier_name TEXT;
  v_limit INTEGER;
  v_current_count INTEGER;
BEGIN
  -- Get subscription details
  SELECT 
    tier_id,
    status,
    cancel_at_period_end,
    current_period_end
  INTO 
    v_tier_id,
    v_status,
    v_cancel_at_period_end,
    v_current_period_end
  FROM user_subscriptions
  WHERE user_id = p_user_id;

  -- Determine effective tier based on subscription status
  IF v_tier_id = 'premium_tier' THEN
    -- Check if subscription is canceled
    IF v_status = 'canceled' THEN
      -- Get payment provider
      SELECT payment_provider INTO v_payment_provider
      FROM profiles
      WHERE id = p_user_id;
      
      -- For Apple IAP, check apple_transactions for expiry
      IF v_payment_provider = 'apple' THEN
        SELECT expiration_date INTO v_apple_expiry
        FROM apple_transactions
        WHERE user_id = p_user_id
        ORDER BY created_at DESC
        LIMIT 1;
        
        -- If Apple expiry exists and is in the future, still premium
        IF v_apple_expiry IS NOT NULL AND v_apple_expiry > NOW() THEN
          v_tier_name := 'premium';
        ELSE
          v_tier_name := 'free';
        END IF;
      -- For other providers, check current_period_end
      ELSIF v_cancel_at_period_end AND v_current_period_end IS NOT NULL AND v_current_period_end > NOW() THEN
        v_tier_name := 'premium';
      ELSE
        v_tier_name := 'free';
      END IF;
    -- Active or other valid statuses
    ELSIF v_status IN ('active', 'trialing', 'incomplete', 'past_due', 'paused') THEN
      v_tier_name := 'premium';
    ELSE
      v_tier_name := 'free';
    END IF;
  ELSE
    v_tier_name := 'free';
  END IF;

  -- Get tier limit
  SELECT subscription_limit INTO v_limit
  FROM subscription_tiers
  WHERE tier_id = COALESCE(v_tier_id, 'free_tier');

  -- Get current subscription count
  SELECT COUNT(*) INTO v_current_count
  FROM recurring_items
  WHERE user_id = p_user_id AND deleted_at IS NULL;

  -- Return result
  RETURN json_build_object(
    'tier', v_tier_name,
    'limit_count', v_limit,
    'current_count', v_current_count,
    'allowed', v_current_count < v_limit
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;