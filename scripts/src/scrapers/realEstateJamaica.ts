import * as cheerio from 'cheerio';
import { fetchHtml } from '../utils/fetcher.js';
import type { RawListing, Parish, PropertyType } from '../types.js';
import { PARISHES, PROPERTY_TYPES } from '../types.js';

const BASE_URL = 'https://www.realestatejamaica.com';
const LISTINGS_URL = `${BASE_URL}/for-rent/`;
const MAX_PAGES = 5;
const DELAY_MS = 2500;

function parsePropertyType(raw: string): PropertyType {
  const s = raw.toLowerCase();
  if (s.includes('apartment') || s.includes('flat')) return 'apartment';
  if (s.includes('studio')) return 'studio';
  if (s.includes('townhouse') || s.includes('town house')) return 'townhouse';
  if (s.includes('room')) return 'room';
  if (s.includes('commercial') || s.includes('office')) return 'commercial';
  return 'house';
}

function parseParish(raw: string): Parish {
  return PARISHES.find((p) => raw.toLowerCase().includes(p.toLowerCase())) ?? 'St. Andrew';
}

function parsePrice(raw: string): { price: number; currency: 'JMD' | 'USD' } {
  const isUSD = raw.includes('US$') || raw.includes('USD');
  return { price: parseFloat(raw.replace(/[^0-9.]/g, '')) || 0, currency: isUSD ? 'USD' : 'JMD' };
}

function sanitizeHtml(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
}

function absoluteUrl(href: string): string {
  if (!href) return '';
  return href.startsWith('http') ? href : `${BASE_URL}${href.startsWith('/') ? '' : '/'}${href}`;
}

async function scrapePage(url: string): Promise<RawListing[]> {
  let html: string;
  try { html = await fetchHtml(url, DELAY_MS); }
  catch (e) { console.warn(`[REJ] Failed ${url}:`, e); return []; }

  const $ = cheerio.load(sanitizeHtml(html));
  const results: RawListing[] = [];

  // VERIFY: confirm selectors against live realestatejamaica.com/for-rent/
  $('[class*="listing-item"], [class*="property-item"], article.listing').each((_, el) => {
    try {
      const $el = $(el);
      const title = $el.find('[class*="title"], h2, h3').first().text().trim();
      if (!title) return;

      const href = $el.find('a[href]').first().attr('href') ?? '';
      const sourceUrl = absoluteUrl(href);
      if (!sourceUrl) return;

      const { price, currency } = parsePrice($el.find('[class*="price"]').first().text());
      if (price <= 0) return;

      const locationText = $el.find('[class*="location"], [class*="address"]').first().text().trim();
      const parish = parseParish(locationText);
      const propertyType = parsePropertyType($el.find('[class*="type"], [class*="category"]').first().text());

      const imgSrc = $el.find('img[src]').first().attr('src') ?? '';
      const listing: RawListing = {
        title,
        description: $el.find('[class*="desc"], p').first().text().trim().slice(0, 500),
        price, currency, pricePeriod: 'monthly',
        bedrooms: parseInt($el.find('[class*="bed"]').first().text().match(/(\d+)/)?.[1] ?? '1', 10),
        bathrooms: parseInt($el.find('[class*="bath"]').first().text().match(/(\d+)/)?.[1] ?? '1', 10),
        propertyType,
        location: { parish, area: locationText.replace(parish, '').replace(/,/g, '').trim(), address: locationText.slice(0, 200) },
        amenities: [], images: imgSrc ? [absoluteUrl(imgSrc)] : [],
        contact: {}, sourceUrl, sourceSite: 'realestatejamaica.com',
        source: 'scrape', listedAt: new Date(),
      };
      if (PROPERTY_TYPES.includes(listing.propertyType)) results.push(listing);
    } catch (e) { console.warn('[REJ] Parse error:', e); }
  });

  return results;
}

export async function scrapeRealEstateJamaica(): Promise<RawListing[]> {
  const all: RawListing[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = page === 1 ? LISTINGS_URL : `${LISTINGS_URL}?page=${page}`;
    console.log(`[REJ] Page ${page}`);
    const listings = await scrapePage(url);
    if (listings.length === 0) break;
    all.push(...listings);
  }
  console.log(`[REJ] Total: ${all.length}`);
  return all;
}
