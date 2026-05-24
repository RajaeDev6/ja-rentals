import type { Timestamp } from 'firebase-admin/firestore';

export type Parish =
  | 'Kingston' | 'St. Andrew' | 'St. Thomas' | 'Portland'
  | 'St. Mary' | 'St. Ann' | 'Trelawny' | 'St. James'
  | 'Hanover' | 'Westmoreland' | 'St. Elizabeth' | 'Manchester'
  | 'Clarendon' | 'St. Catherine';

export type PropertyType =
  | 'apartment' | 'house' | 'studio' | 'townhouse' | 'room' | 'commercial';

export type Currency = 'JMD' | 'USD';

export interface RawListing {
  title: string;
  description: string;
  price: number;
  currency: Currency;
  pricePeriod: 'monthly' | 'weekly';
  bedrooms: number;
  bathrooms: number;
  propertyType: PropertyType;
  location: { parish: Parish; area: string; address: string };
  amenities: string[];
  images: string[];
  contact: { phone?: string; email?: string; agent?: string };
  sourceUrl: string;
  sourceSite: string;
  source: 'api' | 'scrape';
  listedAt: Date;
}

export interface StoredListing extends Omit<RawListing, 'listedAt'> {
  id: string;
  fetchedAt: Timestamp;
  listedAt: Timestamp;
  isActive: boolean;
}

export const PARISHES: Parish[] = [
  'Kingston', 'St. Andrew', 'St. Thomas', 'Portland',
  'St. Mary', 'St. Ann', 'Trelawny', 'St. James',
  'Hanover', 'Westmoreland', 'St. Elizabeth', 'Manchester',
  'Clarendon', 'St. Catherine',
];

export const PROPERTY_TYPES: PropertyType[] = [
  'apartment', 'house', 'studio', 'townhouse', 'room', 'commercial',
];
