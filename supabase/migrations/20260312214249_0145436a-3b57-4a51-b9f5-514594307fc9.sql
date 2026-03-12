
-- Promo codes table (admin-managed)
CREATE TABLE public.promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  credits integer NOT NULL CHECK (credits > 0),
  max_uses integer DEFAULT NULL, -- NULL = unlimited
  current_uses integer NOT NULL DEFAULT 0,
  expires_at timestamptz DEFAULT NULL, -- NULL = never expires
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Track who redeemed what
CREATE TABLE public.promo_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id uuid REFERENCES public.promo_codes(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  credits_awarded integer NOT NULL,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(promo_code_id, user_id) -- each user can only redeem a code once
);

-- RLS
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_redemptions ENABLE ROW LEVEL SECURITY;

-- Users can read active promo codes (needed for validation)
CREATE POLICY "Anyone can read active promo codes"
  ON public.promo_codes FOR SELECT
  TO authenticated
  USING (active = true);

-- Users can see their own redemptions
CREATE POLICY "Users can see own redemptions"
  ON public.promo_redemptions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Service role inserts redemptions (edge function)
CREATE POLICY "Service role can insert redemptions"
  ON public.promo_redemptions FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Service role can update promo codes (increment uses)
CREATE POLICY "Service role can update promo codes"
  ON public.promo_codes FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);
