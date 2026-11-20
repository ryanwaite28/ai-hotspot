CREATE TABLE IF NOT EXISTS creator_payout_accounts (
  creator_user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  provider_account_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  payouts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  charges_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  details_submitted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS creator_payout_accounts_status_idx
  ON creator_payout_accounts (status, updated_at DESC);
