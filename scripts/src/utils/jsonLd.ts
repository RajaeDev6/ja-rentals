import * as cheerio from 'cheerio';
import type { RawListing, Parish, PropertyType } from '../types.js';
import { PARISHES, PROPERTY_TYPES } from '../types.js';

// schema.org types that indicate a rental listing
const RENTAL_TYPES = new Set([
  'RealEstateListing', 'Residence', 'Apartment', 'House',
  'SingleFamilyResidence', 'Product', 'Offer',
]);

interface SchemaAddress {
  streetAddress?: string;
  addressLocality?: string;
  addressRegion?: string;
  addressCountry?: string;
}

interface SchemaOffer {
  price?: number | string;
  priceCurrency?: string;
  priceSpecification?: { price?: number | string; priceCurrency?: string };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = Record<string, any>;

function parseParish(raw: string): Parish {
  return PARISHES.find((p) => raw.toLowerCase().includes(p.toLowerCase())) ?? 'Kingston';
}

function parsePropertyType(raw: string): PropertyType {
  const s = raw.toLowerCase();
  if (s.includes('apartment') || s.includes('flat') || s.includes('condo')) return 'apartment';
  if (s.includes('studio')) return 'studio';
  if (s.includes('townhouse') || s.includes('town house')) return 'townhouse';
  if (s.includes('room')) return 'room';
  if (s.includes('commercial') || s.includes('office') || s.includes('retail')) return 'commercial';
  return 'house';
}

function extractPrice(obj: AnyObj): { price: number; currency: 'JMD' | 'USD' } | null {
  const offer: SchemaOffer = obj.offers ?? obj.priceSpecification ?? obj;
  const raw = offer.price ?? offer.priceSpecification?.price ?? obj.price;
  const cur = (offer.priceCurrency ?? offer.priceSpecification?.priceCurrency ?? obj.priceCurrency ?? 'JMD') as string;
  const price = typeof raw === 'string' ? parseFloat(raw.replace(/[^0-9.]/g, '')) : (raw as number);
  if (!price || price <= 0) return null;
  return { price, currency: cur.toUpperCase() === 'USD' ? 'USD' : 'JMD' };
}

function extractAddress(obj: AnyObj): { parish: Parish; area: string; address: string } {
  const addr: SchemaAddress = obj.address ?? obj.location ?? {};
  const parts = [addr.streetAddress, addr.addressLocality, addr.addressRegion].filter(Boolean).join(', ');
  const parish = parseParish(parts || obj.name || '');
  const area = (addr.addressLocality ?? '').trim();
  return { parish, area, address: parts.slice(0, 200) };
}

function extractImages(obj: AnyObj): string[] {
  const img = obj.image ?? obj.photo ?? obj.thumbnail ?? [];
  if (typeof img === 'string') return [img];
  if (Array.isArray(img)) return img.map((i: AnyObj | string) => (typeof i === 'string' ? i : i?.url ?? '')).filter(Boolean).slice(0, 10);
  if (typeof img === 'object' && img?.url) return [img.url as string];
  return [];
}

function fromSchemaNode(node: AnyObj, sourceSite: string, baseUrl: string): RawListing | null {
  try {
    const type: string = Array.isArray(node['@type']) ? node['@type'][0] : (node['@type'] ?? '');
    if (!RENTAL_TYPES.has(type)) return null;

    const title = (node.name ?? '').trim();
    if (!title || title.length < 5) return null;

    const priceData = extractPrice(node);
    if (!priceData) return null;

    const location = extractAddress(node);
    const url = (node.url ?? node.mainEntityOfPage ?? baseUrl).toString();
    const beds = parseInt(String(node.numberOfRooms ?? node.numberOfBedrooms ?? 1), 10) || 1;
    const baths = parseInt(String(node.numberOfBathroomsTotal ?? node.numberOfBathrooms ?? 1), 10) || 1;
    const typeRaw = String(node['@type'] ?? node.additionalType ?? node.propertyType ?? '');
    const propertyType = parsePropertyType(typeRaw);
    if (!PROPERTY_TYPES.includes(propertyType)) return null;

    const listedRaw = node.datePosted ?? node.availabilityStarts ?? null;
    const listedAt = listedRaw ? new Date(listedRaw as string) : new Date();

    return {
      title,
      description: (node.description ?? '').toString().slice(0, 500),
      price: priceData.price,
      currency: priceData.currency,
      pricePeriod: 'monthly',
      bedrooms: beds,
      bathrooms: baths,
      propertyType,
      location,
      amenities: [],
      images: extractImages(node),
      contact: { agent: node.agent?.name ?? node.seller?.name },
      sourceUrl: url,
      sourceSite,
      source: 'scrape',
      listedAt,
    };
  } catch {
    return null;
  }
}

export function extractFromJsonLd(html: string, sourceSite: string, baseUrl: string): RawListing[] {
  const $ = cheerio.load(html);
  const results: RawListing[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw = $(el).html() ?? '';
      const parsed: AnyObj | AnyObj[] = JSON.parse(raw);
      const nodes: AnyObj[] = Array.isArray(parsed) ? parsed : [parsed];

      // Also check @graph arrays used by some CMS platforms
      const expanded = nodes.flatMap((n) => (n['@graph'] ? (n['@graph'] as AnyObj[]) : [n]));

      for (const node of expanded) {
        const listing = fromSchemaNode(node, sourceSite, baseUrl);
        if (listing) results.push(listing);
      }
    } catch {
      // malformed JSON-LD — skip silently
    }
  });

  return results;
}
