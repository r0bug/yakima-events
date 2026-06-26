/**
 * Calculate distance between two coordinates using Haversine formula
 * @returns Distance in miles
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Format distance for display
 */
export function formatDistance(miles: number): string {
  if (miles < 0.1) {
    const feet = Math.round(miles * 5280);
    return `${feet} ft`;
  } else if (miles < 1) {
    return `${(miles * 5280).toFixed(0)} ft`;
  } else if (miles < 10) {
    return `${miles.toFixed(1)} mi`;
  } else {
    return `${Math.round(miles)} mi`;
  }
}

/**
 * Get user's current location
 */
export function getCurrentLocation(): Promise<GeolocationCoordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position.coords),
      (error) => {
        let message = 'Unable to get location';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = 'Location access denied';
            break;
          case error.POSITION_UNAVAILABLE:
            message = 'Location unavailable';
            break;
          case error.TIMEOUT:
            message = 'Location request timed out';
            break;
        }
        reject(new Error(message));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  });
}

/**
 * Open Google Maps directions
 */
export function openDirections(lat: number, lng: number): void {
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
}

/**
 * Check if coordinates are valid
 */
export function isValidCoordinates(lat: number | null | undefined, lng: number | null | undefined): boolean {
  if (lat === null || lat === undefined || lng === null || lng === undefined) {
    return false;
  }
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/**
 * Default Yakima coordinates
 */
export const YAKIMA_CENTER = {
  lat: 46.600825,
  lng: -120.503357,
};

export const DEFAULT_ZOOM = 12;

/**
 * Derive Yakima Valley region from an address string
 */
export function getYakimaRegion(address: string): string {
  const lower = address.toLowerCase();
  if (lower.includes('union gap')) return 'uniongap';
  if (lower.includes('selah')) return 'selah';
  if (lower.includes('wapato')) return 'wapato';
  if (lower.includes('naches')) return 'naches';
  if (lower.includes('tieton')) return 'tieton';
  if (lower.includes('prosser')) return 'prosser';
  if (lower.includes('toppenish')) return 'toppenish';
  if (lower.includes('sunnyside')) return 'sunnyside';
  if (lower.includes('zillah')) return 'zillah';
  if (lower.includes('benton city')) return 'bentoncity';
  if (lower.includes('granger')) return 'granger';
  return 'yakima';
}

export const REGION_LABELS: Record<string, string> = {
  yakima: 'Yakima',
  uniongap: 'Union Gap',
  selah: 'Selah',
  wapato: 'Wapato',
  naches: 'Naches',
  tieton: 'Tieton',
  prosser: 'Prosser',
  toppenish: 'Toppenish',
  sunnyside: 'Sunnyside',
  zillah: 'Zillah',
  bentoncity: 'Benton City',
  granger: 'Granger',
};

/** Display order for region groups (north/central Yakima first, then valley, then wine country) */
export const REGION_ORDER: string[] = [
  'yakima', 'uniongap', 'selah', 'naches', 'tieton',
  'wapato', 'toppenish', 'granger', 'sunnyside', 'zillah',
  'prosser', 'bentoncity',
];
