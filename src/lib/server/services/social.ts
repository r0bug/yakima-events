/**
 * Social Sharing Service
 * Generates share links, Open Graph metadata, and tracks shares
 */

import { db } from '$lib/server/db';
import { events, localShops, type Event, type LocalShop } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export interface OpenGraphData {
  title: string;
  description: string;
  image?: string;
  url: string;
  type: 'event' | 'place';
  siteName: string;
  locale: string;
}

export interface ShareLinks {
  direct: string;
  facebook: string;
  twitter: string;
  email: string;
  copy: string;
}

export interface ShareData {
  openGraph: OpenGraphData;
  links: ShareLinks;
  hashtags: string[];
}

const BASE_URL = 'https://yfevents.yakimafinds.com';
const SITE_NAME = 'Yakima Events';

/**
 * Format a date for display in share text
 */
function formatEventDate(startDatetime: string, endDatetime?: string | null): string {
  const start = new Date(startDatetime);
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  };

  let dateStr = start.toLocaleString('en-US', options);

  if (endDatetime) {
    const end = new Date(endDatetime);
    if (start.toDateString() === end.toDateString()) {
      // Same day - just show end time
      dateStr += ` - ${end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    }
  }

  return dateStr;
}

/**
 * Generate a short description for social sharing
 */
function truncateDescription(text: string | null, maxLength = 200): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3).trim() + '...';
}

/**
 * Generate hashtags from event/shop data
 */
function generateHashtags(item: { title?: string; name?: string; location?: string; address?: string | null }): string[] {
  const hashtags = ['YakimaEvents', 'YakimaWA'];

  // Add location-based hashtags
  if (item.location?.toLowerCase().includes('yakima')) {
    hashtags.push('Yakima');
  }

  // Add category-based hashtags
  const text = (item.title || item.name || '').toLowerCase();
  if (text.includes('market') || text.includes('farm')) {
    hashtags.push('FarmersMarket');
  }
  if (text.includes('music') || text.includes('concert')) {
    hashtags.push('LiveMusic');
  }
  if (text.includes('festival')) {
    hashtags.push('Festival');
  }
  if (text.includes('wine') || text.includes('winery')) {
    hashtags.push('WineCountry');
  }
  if (text.includes('antique') || text.includes('thrift') || text.includes('vintage')) {
    hashtags.push('Antiques', 'Thrifting');
  }

  return [...new Set(hashtags)]; // Remove duplicates
}

/**
 * Encode text for URL
 */
function encodeForUrl(text: string): string {
  return encodeURIComponent(text);
}

/**
 * Generate share data for an event
 */
export async function getEventShareData(eventId: number): Promise<ShareData | null> {
  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId));

  if (!event) return null;

  const eventUrl = `${BASE_URL}/events/${event.id}`;
  const dateStr = formatEventDate(event.startDatetime, event.endDatetime);

  const title = event.title;
  const description = event.description
    ? truncateDescription(event.description)
    : `Join us for ${event.title} on ${dateStr} in Yakima!`;

  const hashtags = generateHashtags({
    title: event.title,
    location: event.location || undefined,
    address: event.address,
  });

  const hashtagString = hashtags.map(h => `#${h}`).join(' ');
  const shareText = `${title}\n${dateStr}${event.location ? ` at ${event.location}` : ''}\n${eventUrl}`;
  const shareTextWithHashtags = `${shareText}\n\n${hashtagString}`;

  const openGraph: OpenGraphData = {
    title,
    description,
    url: eventUrl,
    type: 'event',
    siteName: SITE_NAME,
    locale: 'en_US',
  };

  const links: ShareLinks = {
    direct: eventUrl,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeForUrl(eventUrl)}`,
    twitter: `https://twitter.com/intent/tweet?text=${encodeForUrl(shareTextWithHashtags)}`,
    email: `mailto:?subject=${encodeForUrl(title)}&body=${encodeForUrl(shareText)}`,
    copy: eventUrl,
  };

  return {
    openGraph,
    links,
    hashtags,
  };
}

/**
 * Generate share data for a shop
 */
export async function getShopShareData(shopId: number): Promise<ShareData | null> {
  const [shop] = await db
    .select()
    .from(localShops)
    .where(eq(localShops.id, shopId));

  if (!shop) return null;

  const shopUrl = `${BASE_URL}/shops/${shop.id}`;

  const title = shop.name;
  const description = shop.description
    ? truncateDescription(shop.description)
    : `Check out ${shop.name} in Yakima!`;

  const hashtags = generateHashtags({
    name: shop.name,
    address: shop.address,
  });

  const hashtagString = hashtags.map(h => `#${h}`).join(' ');
  const shareText = `${title}${shop.address ? `\n${shop.address}` : ''}\n${shopUrl}`;
  const shareTextWithHashtags = `${shareText}\n\n${hashtagString}`;

  const openGraph: OpenGraphData = {
    title,
    description,
    image: shop.imageUrl || undefined,
    url: shopUrl,
    type: 'place',
    siteName: SITE_NAME,
    locale: 'en_US',
  };

  const links: ShareLinks = {
    direct: shopUrl,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeForUrl(shopUrl)}`,
    twitter: `https://twitter.com/intent/tweet?text=${encodeForUrl(shareTextWithHashtags)}`,
    email: `mailto:?subject=${encodeForUrl(title)}&body=${encodeForUrl(shareText)}`,
    copy: shopUrl,
  };

  return {
    openGraph,
    links,
    hashtags,
  };
}

/**
 * Generate Open Graph meta tags as HTML string
 */
export function generateOpenGraphTags(data: OpenGraphData): string {
  const tags = [
    `<meta property="og:title" content="${escapeHtml(data.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(data.description)}" />`,
    `<meta property="og:url" content="${escapeHtml(data.url)}" />`,
    `<meta property="og:type" content="${data.type === 'event' ? 'event' : 'place'}" />`,
    `<meta property="og:site_name" content="${escapeHtml(data.siteName)}" />`,
    `<meta property="og:locale" content="${data.locale}" />`,
  ];

  if (data.image) {
    tags.push(`<meta property="og:image" content="${escapeHtml(data.image)}" />`);
  }

  // Twitter Card tags
  tags.push(
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${escapeHtml(data.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(data.description)}" />`,
  );

  if (data.image) {
    tags.push(`<meta name="twitter:image" content="${escapeHtml(data.image)}" />`);
  }

  return tags.join('\n');
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generate Instagram-friendly text (no clickable links)
 */
export function generateInstagramText(
  item: { title?: string; name?: string; description?: string | null; location?: string },
  type: 'event' | 'shop',
  dateStr?: string
): string {
  const title = item.title || item.name || '';
  const hashtags = generateHashtags(item);

  const lines = [title];

  if (type === 'event' && dateStr) {
    lines.push(`📅 ${dateStr}`);
  }

  if (item.location) {
    lines.push(`📍 ${item.location}`);
  }

  if (item.description) {
    lines.push('', truncateDescription(item.description, 150));
  }

  lines.push('', '🔗 Link in bio!', '', hashtags.map(h => `#${h}`).join(' '));

  return lines.join('\n');
}
