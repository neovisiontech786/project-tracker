-- Neo Vision Tech Project Hub: project finance ledger (INR paise)
-- Safe to run more than once. Client receipts and founder transfers remain distinct.
-- Apply on Neon project flat-flower-68161626. All existing projects remain unchanged.
CREATE TABLE IF NOT EXISTS project_financials (
  project_id UUID PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  quoted_paise BIGINT CHECK (quoted_paise >= 0 AND quoted_paise <= 100000000000),
  quoted_updated_by VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  quoted_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS client_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), request_id UUID NOT NULL UNIQUE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  amount_paise BIGINT NOT NULL CHECK (amount_paise > 0 AND amount_paise <= 100000000000),
  paid_at TIMESTAMPTZ NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('Google Pay','PhonePe','Paytm','UPI','Bank Transfer','Cash','Card','Other')),
  received_by TEXT NOT NULL CHECK (received_by IN ('Kabir','Naushad')),
  reference TEXT, note TEXT,
  recorded_by_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  voided_at TIMESTAMPTZ, voided_by_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL, void_reason TEXT
);

CREATE TABLE IF NOT EXISTS founder_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), request_id UUID NOT NULL UNIQUE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  amount_paise BIGINT NOT NULL CHECK (amount_paise > 0 AND amount_paise <= 100000000000),
  transferred_at TIMESTAMPTZ NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('Google Pay','PhonePe','Paytm','UPI','Bank Transfer','Cash','Card','Other')),
  from_founder TEXT NOT NULL CHECK (from_founder IN ('Kabir','Naushad')),
  to_founder TEXT NOT NULL CHECK (to_founder IN ('Kabir','Naushad')),
  reference TEXT, note TEXT,
  recorded_by_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  voided_at TIMESTAMPTZ, voided_by_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  void_reason TEXT, CONSTRAINT founder_transfer_different_people CHECK (from_founder <> to_founder)
);

CREATE INDEX IF NOT EXISTS idx_client_receipts_project_date ON client_receipts(project_id,paid_at DESC);

CREATE INDEX IF NOT EXISTS idx_founder_transfers_project_date ON founder_transfers(project_id,transferred_at DESC);
