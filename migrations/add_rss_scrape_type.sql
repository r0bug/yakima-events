-- Add 'rss' to the calendar_sources scrape_type enum.
-- The RSS parser has existed in code all along, but no source could be
-- saved with that type because the enum lacked the value.
ALTER TABLE calendar_sources
  MODIFY scrape_type ENUM(
    'ical', 'html', 'json', 'rss', 'eventbrite', 'facebook',
    'yakima_valley', 'intelligent', 'firecrawl', 'cityspark'
  ) NOT NULL;
