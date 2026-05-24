import type { Timestamp } from 'firebase/firestore';

export const PARISHES = [
  'Kingston',
  'St. Andrew',
  'St. Thomas',
  'Portland',
  'St. Mary',
  'St. Ann',
  'Trelawny',
  'St. James',
  'Hanover',
  'Westmoreland',
  'St. Elizabeth',
  'Manchester',
  'Clarendon',
  'St. Catherine',
] as const;

export type Parish = (typeof PARISHES)[number];

export const PROPERTY_TYPES = [
  'apartment',
  'house',
  'studio',
  'townhouse',
  'room',
  'commercial',
] as const;

export type PropertyType = (typeof PROPERTY_TYPES)[number];

export type Currency = 'JMD' | 'USD';

export type SortOrder = 'newest' | 'price_asc' | 'price_desc';

export interface Listing {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: Currency;
  pricePeriod: 'monthly' | 'weekly';
  bedrooms: number;
  bathrooms: number;
  propertyType: PropertyType;
  location: {
    parish: Parish;
    area: string;
    address: string;
  };
  amenities: string[];
  images: string[];
  contact: {
    phone?: string;
    email?: string;
    agent?: string;
  };
  sourceUrl: string;
  sourceSite: string;
  source: 'api' | 'scrape';
  listedAt: Timestamp;
  fetchedAt: Timestamp;
  isActive: boolean;
}

export interface FilterState {
  parish: string;
  area: string;
  minPrice: string;
  maxPrice: string;
  currency: Currency;
  bedrooms: string;
  propertyType: string;
  sort: SortOrder;
}

export const DEFAULT_FILTERS: FilterState = {
  parish: '',
  area: '',
  minPrice: '',
  maxPrice: '',
  currency: 'JMD',
  bedrooms: '',
  propertyType: '',
  sort: 'newest',
};

export const PRICE_LIMITS = {
  JMD: { min: 0, max: 10_000_000 },
  USD: { min: 0, max: 50_000 },
} as const;
