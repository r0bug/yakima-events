-- Add 'yakimavalley_events' to the calendar_sources scrape_type enum and
-- register www.yakimavalley.events as a source. That site aggregates local
-- events (largely from the same upstreams we scrape, including our own feed);
-- the parser maps Facebook/Eventbrite source links to our fb_/eb_ external-id
-- formats so cross-source duplicates collapse, and skips events that cite
-- yfevents.yakimafinds.com as their source.
ALTER TABLE calendar_sources
  MODIFY scrape_type ENUM(
    'ical', 'html', 'json', 'rss', 'eventbrite', 'facebook',
    'yakima_valley', 'yakimavalley_events', 'intelligent', 'firecrawl', 'cityspark'
  ) NOT NULL;

INSERT INTO calendar_sources (name, url, scrape_type, active)
SELECT 'Yakima Valley Events (yakimavalley.events)',
       'https://www.yakimavalley.events/events',
       'yakimavalley_events',
       1
WHERE NOT EXISTS (
  SELECT 1 FROM calendar_sources WHERE scrape_type = 'yakimavalley_events'
);
