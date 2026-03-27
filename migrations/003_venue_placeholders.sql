-- Add venue placeholder support to local_shops
ALTER TABLE local_shops
  ADD COLUMN is_venue_placeholder BOOLEAN NOT NULL DEFAULT FALSE AFTER verified,
  ADD COLUMN venue_source_count INT NOT NULL DEFAULT 0 AFTER is_venue_placeholder,
  ADD COLUMN normalized_name VARCHAR(255) AFTER venue_source_count;

-- Index for fast venue lookup by normalized name
CREATE INDEX idx_normalized_name ON local_shops(normalized_name);

-- Populate normalized_name for existing shops
UPDATE local_shops SET normalized_name = LOWER(TRIM(name));
