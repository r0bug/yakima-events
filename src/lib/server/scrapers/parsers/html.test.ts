import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { parseJsonLdEvents, parseHtmlContent } from './html';

function docFromJsonLd(...blocks: unknown[]): Document {
  const scripts = blocks
    .map((b) => `<script type="application/ld+json">${JSON.stringify(b)}</script>`)
    .join('\n');
  return new JSDOM(`<html><head>${scripts}</head><body></body></html>`).window.document;
}

const SRC = 'https://example.com/events/';

describe('parseJsonLdEvents', () => {
  it('extracts a simple Event', () => {
    const doc = docFromJsonLd({
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: 'Summer Concert',
      startDate: '2026-07-04T19:00:00-07:00',
      endDate: '2026-07-04T22:00:00-07:00',
      url: '/events/summer-concert',
      description: '<p>Live music &amp; fun</p>',
      location: {
        '@type': 'Place',
        name: 'Franklin Park',
        address: {
          '@type': 'PostalAddress',
          streetAddress: '101 N 21st Ave',
          addressLocality: 'Yakima',
          addressRegion: 'WA',
        },
      },
    });

    const events = parseJsonLdEvents(doc, SRC);
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe('Summer Concert');
    expect(events[0].location).toBe('Franklin Park');
    expect(events[0].address).toBe('101 N 21st Ave, Yakima, WA');
    expect(events[0].externalUrl).toBe('https://example.com/events/summer-concert');
    expect(events[0].description).toBe('Live music & fun');
    expect(events[0].startDatetime.getTime()).toBeGreaterThan(0);
  });

  it('extracts events from a top-level array and @graph', () => {
    const doc = docFromJsonLd(
      [
        { '@type': 'MusicEvent', name: 'Show A', startDate: '2026-07-01' },
        { '@type': 'TheaterEvent', name: 'Show B', startDate: '2026-07-02' },
      ],
      {
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'WebSite', name: 'not an event' },
          { '@type': 'Festival', name: 'Hop Festival', startDate: '2026-08-15' },
        ],
      }
    );

    const titles = parseJsonLdEvents(doc, SRC).map((e) => e.title);
    expect(titles).toEqual(['Show A', 'Show B', 'Hop Festival']);
  });

  it('extracts events from an ItemList', () => {
    const doc = docFromJsonLd({
      '@type': 'ItemList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, item: { '@type': 'Event', name: 'Listed Event', startDate: '2026-07-10' } },
      ],
    });

    const events = parseJsonLdEvents(doc, SRC);
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe('Listed Event');
  });

  it('skips events without a parseable start date', () => {
    const doc = docFromJsonLd(
      { '@type': 'Event', name: 'No Date' },
      { '@type': 'Event', name: 'Bad Date', startDate: 'TBD' },
      { '@type': 'Event', name: 'Good', startDate: '2026-07-01' }
    );

    const events = parseJsonLdEvents(doc, SRC);
    expect(events.map((e) => e.title)).toEqual(['Good']);
  });

  it('dedupes the same event repeated across blocks', () => {
    const ev = { '@type': 'Event', name: 'Dup', startDate: '2026-07-01', url: 'https://example.com/dup' };
    const doc = docFromJsonLd(ev, ev);
    expect(parseJsonLdEvents(doc, SRC)).toHaveLength(1);
  });

  it('ignores malformed JSON-LD blocks', () => {
    const html = `<html><head>
      <script type="application/ld+json">{not valid json</script>
      <script type="application/ld+json">${JSON.stringify({ '@type': 'Event', name: 'OK', startDate: '2026-07-01' })}</script>
    </head><body></body></html>`;
    const doc = new JSDOM(html).window.document;
    expect(parseJsonLdEvents(doc, SRC)).toHaveLength(1);
  });
});

describe('parseHtmlContent with JSON-LD', () => {
  it('prefers JSON-LD over selectors and works with no selector config', () => {
    const html = `<html><head>
      <script type="application/ld+json">${JSON.stringify({ '@type': 'Event', name: 'From JSON-LD', startDate: '2026-07-01' })}</script>
    </head><body><div class="event-item"><h2>From CSS</h2></div></body></html>`;

    const events = parseHtmlContent(html, {} as never, SRC);
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe('From JSON-LD');
  });

  it('falls back to selectors when no JSON-LD present', () => {
    const html = `<html><body>
      <div class="event-item"><h2>CSS Event</h2><span class="date">July 1, 2026 7:00 PM</span></div>
    </body></html>`;

    const events = parseHtmlContent(
      html,
      { selectors: { eventContainer: '.event-item', title: 'h2', datetime: '.date' } },
      SRC
    );
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe('CSS Event');
  });
});
