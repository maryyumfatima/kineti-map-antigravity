-- Add continuity_notes to both SOAP tables
ALTER TABLE public.soap_notes
  ADD COLUMN IF NOT EXISTS continuity_notes text;

ALTER TABLE public.ai_soap_drafts
  ADD COLUMN IF NOT EXISTS draft_continuity_notes text;

COMMENT ON COLUMN public.soap_notes.continuity_notes IS
  'AI-generated observations about session-to-session continuity (pain trends, compliance, trajectory). Separate from S/O/A/P clinical fields.';
