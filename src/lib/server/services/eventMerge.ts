/**
 * Cross-source duplicate detection and field merging.
 * Pure helpers — no DB imports — so they're usable from both the scraper
 * and standalone scripts (npx tsx).
 *
 * The same event often appears in multiple sources (CitySpark, Facebook,
 * visityakima, city feeds) with slightly different titles and partial data.
 * Instead of skipping or double-listing, we detect the match and merge the
 * missing fields so the surviving event is more complete.
 */

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/&amp;/g, '&')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Two titles refer to the same event if they normalize identically, or if
 * one contains the other (scrapers often glue venue names onto titles or
 * truncate them). Containment requires a meaningful length to avoid
 * matching short generic titles.
 */
export function titlesMatch(a: string, b: string): boolean {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (!na || !nb) return false;
  if (na === nb) return true;

  const [shorter, longer] = na.length <= nb.length ? [na, nb] : [nb, na];
  return shorter.length >= 12 && longer.includes(shorter);
}

export interface MergeableEvent {
  description?: string | null;
  endDatetime?: Date | string | null;
  location?: string | null;
  address?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  externalUrl?: string | null;
}

function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || v === '';
}

/**
 * Fields the incoming duplicate can contribute to the existing event —
 * only fills gaps, never overwrites existing data.
 */
export function pickMergeUpdates(
  existing: MergeableEvent,
  incoming: MergeableEvent
): Record<string, unknown> {
  const updates: Record<string, unknown> = {};

  if (isEmpty(existing.description) && !isEmpty(incoming.description)) {
    updates.description = incoming.description;
  }
  if (isEmpty(existing.endDatetime) && !isEmpty(incoming.endDatetime)) {
    updates.endDatetime = incoming.endDatetime;
  }
  if (isEmpty(existing.location) && !isEmpty(incoming.location)) {
    updates.location = incoming.location;
  }
  if (isEmpty(existing.address) && !isEmpty(incoming.address)) {
    updates.address = incoming.address;
  }
  if (isEmpty(existing.latitude) && !isEmpty(incoming.latitude)) {
    updates.latitude = String(incoming.latitude);
    updates.longitude = String(incoming.longitude);
  }
  if (isEmpty(existing.externalUrl) && !isEmpty(incoming.externalUrl)) {
    updates.externalUrl = incoming.externalUrl;
  }

  return updates;
}
