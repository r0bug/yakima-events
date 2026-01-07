/**
 * Geocoding Service
 * Google Maps geocoding integration with file-based caching
 */

import { GOOGLE_MAPS_API_KEY } from '$env/static/private';
import * as fs from 'fs';
import * as path from 'path';

interface GeocodeResult {
  lat: number;
  lng: number;
  formattedAddress: string;
  placeId: string;
}

interface ReverseGeocodeResult {
  formattedAddress: string;
  placeId: string;
  components: {
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
}

const CACHE_DIR = '/tmp/yakima-geocode-cache';
const CACHE_TTL = 86400 * 7; // 7 days

// Ensure cache directory exists
try {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('[Geocode] Could not create cache directory:', e);
}

/**
 * Geocode an address to coordinates
 */
export async function geocode(address: string): Promise<GeocodeResult | null> {
  if (!address || !GOOGLE_MAPS_API_KEY) {
    return null;
  }

  // Check cache first
  const cacheKey = Buffer.from(address).toString('base64').replace(/[/+=]/g, '_');
  const cacheFile = path.join(CACHE_DIR, `${cacheKey}.json`);

  try {
    if (fs.existsSync(cacheFile)) {
      const stat = fs.statSync(cacheFile);
      const age = (Date.now() - stat.mtimeMs) / 1000;

      if (age < CACHE_TTL) {
        const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
        return cached;
      }
    }
  } catch (e) {
    console.warn('[Geocode] Cache read error:', e);
  }

  // Make API request
  const params = new URLSearchParams({
    address,
    key: GOOGLE_MAPS_API_KEY,
    region: 'us',
  });

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?${params}`
    );

    if (!response.ok) {
      console.error(`[Geocode] HTTP ${response.status} for address: ${address}`);
      return null;
    }

    const data = await response.json();

    if (data.status !== 'OK' || !data.results?.length) {
      console.warn(`[Geocode] No results for address: ${address}, status: ${data.status}`);
      return null;
    }

    const result = data.results[0];
    const geocodeResult: GeocodeResult = {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      formattedAddress: result.formatted_address,
      placeId: result.place_id,
    };

    // Cache the result
    try {
      fs.writeFileSync(cacheFile, JSON.stringify(geocodeResult));
    } catch (e) {
      console.warn('[Geocode] Cache write error:', e);
    }

    return geocodeResult;
  } catch (error) {
    console.error('[Geocode] Error:', error);
    return null;
  }
}

/**
 * Reverse geocode coordinates to address
 */
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<ReverseGeocodeResult | null> {
  if (!GOOGLE_MAPS_API_KEY) {
    return null;
  }

  const params = new URLSearchParams({
    latlng: `${lat},${lng}`,
    key: GOOGLE_MAPS_API_KEY,
  });

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?${params}`
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (data.status !== 'OK' || !data.results?.length) {
      return null;
    }

    const result = data.results[0];
    const components: ReverseGeocodeResult['components'] = {};

    // Extract address components
    for (const component of result.address_components || []) {
      const types = component.types || [];
      if (types.includes('locality')) {
        components.city = component.long_name;
      } else if (types.includes('administrative_area_level_1')) {
        components.state = component.short_name;
      } else if (types.includes('country')) {
        components.country = component.short_name;
      } else if (types.includes('postal_code')) {
        components.postalCode = component.long_name;
      }
    }

    return {
      formattedAddress: result.formatted_address,
      placeId: result.place_id,
      components,
    };
  } catch (error) {
    console.error('[ReverseGeocode] Error:', error);
    return null;
  }
}

/**
 * Geocode with Yakima area bias
 * Prioritizes results near Yakima, WA
 */
export async function geocodeYakimaArea(address: string): Promise<GeocodeResult | null> {
  // If address doesn't include state, append Yakima area hints
  let searchAddress = address;

  if (!address.match(/\b(WA|Washington)\b/i)) {
    // Check if it's a partial address
    if (!address.match(/\d{5}/) && !address.match(/,\s*\w{2}\s*$/)) {
      searchAddress = `${address}, Yakima, WA`;
    }
  }

  const result = await geocode(searchAddress);

  // Verify result is near Yakima (within ~100 miles)
  if (result) {
    const yakimaLat = 46.600825;
    const yakimaLng = -120.503357;
    const distance = calculateDistance(result.lat, result.lng, yakimaLat, yakimaLng);

    if (distance > 160) { // ~100 miles in km
      console.warn(`[Geocode] Result too far from Yakima: ${distance}km`);
      // Try without the Yakima hint
      return await geocode(address);
    }
  }

  return result;
}

/**
 * Calculate distance between two points using Haversine formula
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Batch geocode multiple addresses
 */
export async function batchGeocode(
  addresses: string[],
  delayMs: number = 100
): Promise<Map<string, GeocodeResult | null>> {
  const results = new Map<string, GeocodeResult | null>();

  for (const address of addresses) {
    const result = await geocodeYakimaArea(address);
    results.set(address, result);

    // Rate limiting
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return results;
}
