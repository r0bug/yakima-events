export interface SessionUser {
  id: number;
  username: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: 'admin' | 'moderator' | 'user';
  avatarUrl: string | null;
  isSeller: boolean;
  isBusinessOwner: boolean;
  isYfVendor: boolean;
  isYfStaff: boolean;
  isYfAssociate: boolean;
}

export interface Event {
  id: number;
  title: string;
  description: string | null;
  startDatetime: string;
  endDatetime: string | null;
  location: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  externalUrl: string | null;
  status: string;
  featured: boolean;
}

export interface CalendarEvent {
  id: number;
  title: string;
  description?: string;
  start_datetime: string;
  end_datetime?: string;
  location?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  external_url?: string;
  source_name?: string;
  image_url?: string;
  featured?: boolean;
  is_unapproved?: boolean;
  categories?: string;
}

export interface Shop {
  id: number;
  name: string;
  description: string | null;
  address: string;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  categoryId: number | null;
  operatingHours: OperatingHours | null;
  primaryImage: string | null;
  featured: boolean;
  verified: boolean;
  status: string;
}

export interface OperatingHours {
  [day: string]: {
    open: string;
    close: string;
    closed?: boolean;
  };
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  icon?: string | null;
  color?: string | null;
}

export type ViewMode = 'grid' | 'list' | 'map';
export type CalendarViewType = 'day' | 'week' | 'month' | 'list' | 'map';
