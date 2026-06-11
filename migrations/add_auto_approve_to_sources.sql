-- Per-source auto-approval: events scraped from trusted sources are
-- published immediately instead of entering the pending-review queue.
ALTER TABLE calendar_sources
  ADD COLUMN auto_approve BOOLEAN DEFAULT FALSE AFTER active;
