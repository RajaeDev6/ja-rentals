import { fetchJson } from '../utils/fetcher.js';
import type { RawListing, Parish, PropertyType } from '../types.js';
import { PARISHES, PROPERTY_TYPES } from '../types.js';

const API_KEY = process.env.RAPIDAPI_KEY ?? '';
const API_HOST = process.env.RAPIDAPI_HOST ?? '';

interface ApiProperty {
  id?: string | number;
  title?: string; name?: string; description?: string;
  price?: number | string; currency?: string; period?: string;
  bedrooms?: number | string; bathrooms?: number | string;
  type?: string; property_type?: string;
  location?: { city?: string; state?: string; address?: string };
  address?: string;
  images?: string[] | { url?: string; src?: string }[];
  image?: string; url?: string; link?: string;
  listed_date?: string; date_posted?: string;
  amenities?: string[]; agent?: string; phone?: string; email?: string;
}

interface ApiResponse {
  data?: ApiProperty[]; results?: ApiProperty[];
  listings?: ApiProperty[]; properties?: ApiProperty[];
}

function parseParish(raw: string): Parish {
  return PARISHES.find((p) => raw.toLowerCase().includes(p.toLowerCase())) ?? 'Kingston';
}

function parsePropertyType(raw: string): PropertyType {
  const s = raw.toLowerCase();
  if (s.includes('apartment') || s.includes('flat')) return 'apartment';
  if (s.includes('studio')) return 'studio';
  if (s.includes('townhouse')) return 'townhouse';
  if (s.includes('room')) return 'room';
  if (s.includes('commercial') || s.includes('office')) return 'commercial';
  return 'house';
}

function normalize(p: ApiProperty): RawListing | null {
  try {
    const title = (p.title ?? p.name ?? '').trim();
    const price = typeof p.price === 'string' ? parseFloat(p.price) : (p.price ?? 0);
    if (!title || !price || price <= 0) return null;

    const currency: 'JMD' | 'USD' = (p.currency ?? '').toUpperCase() === 'USD' ? 'USD' : 'JMD';
    const locationStr = [p.location?.address ?? p.address ?? '', p.location?.city ?? ''].filter(Boolean).join(', ');
    const parish = parseParish(locationStr);
    const propertyType = parsePropertyType(p.property_type ?? p.type ?? '');
    if (!PROPERTY_TYPES.includes(propertyType)) return null;

    const sourceUrl = (p.url ?? p.link ?? '').trim();
    if (!sourceUrl) return null;

    const images = Array.isArray(p.images)
      ? p.images.map((i) => typeof i === 'string' ? i : (i.url ?? i.src ?? '')).filter(Boolean).slice(0, 10)
      : p.image ? [p.image] : [];

    return {
      title, description: (p.description ?? '').slice(0, 500),
      price, currency, pricePeriod: 'monthly',
      bedrooms: parseInt(String(p.bedrooms ?? 1), 10) || 1,
      bathrooms: parseInt(String(p.bathrooms ?? 1), 10) || 1,
      propertyType,
      location: { parish, area: p.location?.city ?? '', address: locationStr.slice(0, 200) },
      amenities: Array.isArray(p.amenities) ? p.amenities.map(String).slice(0, 20) : [],
      images, contact: { phone: p.phone, email: p.email, agent: p.agent },
      sourceUrl, sourceSite: API_HOST, source: 'api',
      listedAt: p.listed_date || p.date_posted ? new Date(p.listed_date ?? p.date_posted ?? '') : new Date(),
    };
  } catch { return null; }
}

export async function fetchFromRapidApi(): Promise<RawListing[]> {
  if (!API_KEY || !API_HOST) {
    console.warn('[API] RAPIDAPI_KEY or RAPIDAPI_HOST not set — skipping');
    return [];
  }

  // Adjust URL to match the specific RapidAPI endpoint you subscribe to
  const url = `https://${API_HOST}/rentals?location=Jamaica&country=JM&limit=100`;

  let raw: ApiResponse;
  try {
    raw = await fetchJson<ApiResponse>(url, {
      headers: { 'X-RapidAPI-Key': API_KEY, 'X-RapidAPI-Host': API_HOST },
    });
  } catch (e) {
    console.error('[API] Fetch failed:', e);
    return [];
  }

  const items = raw.data ?? raw.results ?? raw.listings ?? raw.properties ?? [];
  const listings = items.map(normalize).filter((l): l is RawListing => l !== null);
  console.log(`[API] RapidAPI: ${listings.length} valid from ${items.length} raw`);
  return listings;
}
