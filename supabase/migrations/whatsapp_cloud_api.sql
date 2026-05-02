-- ─── Migration: WhatsApp Cloud API schema additions ───────────────────────────
-- Run this in Supabase SQL Editor → New Query

-- 1. Add template tracking columns to whatsapp_messages
ALTER TABLE whatsapp_messages
  ADD COLUMN IF NOT EXISTS template_name    TEXT,
  ADD COLUMN IF NOT EXISTS template_params  JSONB,
  ADD COLUMN IF NOT EXISTS meta_message_id  TEXT,       -- Meta's wamid (e.g. "wamid.xxx")
  ADD COLUMN IF NOT EXISTS inbound_text     TEXT,       -- text body of inbound messages
  ADD COLUMN IF NOT EXISTS delivered_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS read_at          TIMESTAMPTZ;

-- 2. Index on meta_message_id for fast delivery-status webhook lookups
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_meta_message_id
  ON whatsapp_messages (meta_message_id)
  WHERE meta_message_id IS NOT NULL;

-- 3. Add 'received' and 'delivered' and 'read' to the status check constraint
--    (The existing constraint may only allow 'pending' | 'sent' | 'failed')
--    Drop and recreate if needed:
ALTER TABLE whatsapp_messages
  DROP CONSTRAINT IF EXISTS whatsapp_messages_status_check;

ALTER TABLE whatsapp_messages
  ADD CONSTRAINT whatsapp_messages_status_check
  CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed', 'received'));

-- 4. Verify
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'whatsapp_messages'
ORDER BY ordinal_position;
