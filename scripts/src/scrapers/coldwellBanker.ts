import * as cheerio from 'cheerio';
import { fetchHtml } from '../utils/fetcher.js';
import type { RawListing, Parish, PropertyType } from '../types.js';
import { PARISHES, PROPERTY_TYPES } from '../types.js';

const BASE_URL = 'https://www.coldwellbankerjamaica.com';
const LISTINGS_URL = `${BASE_URL}/rentals`;
const MAX_PAGES = 4;
const PAGE_DELAY_MS = 5000;

function parsePropertyType(raw: string): PropertyType {
  const s = raw.toLowerCase();
  if (s.includes('apartment') || s.includes('flat')) return 'apartment';
  if (s.includes('studio')) return 'studio';
  if (s.includes('townhouse')) return 'townhouse';
  if (s.includes('room')) return 'room';
  if (s.includes('commercial') || s.includes('office')) return 'commercial';
  return 'house';
}

function parseParish(raw: string): Parish {
  return PARISHES.find((p) => raw.toLowerCase().includes(p.toLowerCase())) ?? 'Kingston';
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

function extractListings($: cheerio.CheerioAPI): RawListing[] {
  const results: RawListing[] = [];

  // VERIFY: inspect coldwellbankerjamaica.com/rentals and confirm selectors
  const candidates = [
    '[class*="property-item"]',
    '[class*="property-card"]',
    '[class*="listing-item"]',
    '.col-sm-4',
    '.col-md-4',
    'article',
    '.property',
  ];

  for (const sel of candidates) {
    const els = $(sel);
    if (els.length === 0) continue;

    els.each((_, el) => {
      try {
        const $el = $(el);
        const title = $el.find('h2, h3, h4, [class*="title"]').first().text().trim();
        if (!title || title.length < 5) return;

        const href = $el.find('a[href]').first().attr('href') ?? '';
        const sourceUrl = absoluteUrl(href);
        if (!sourceUrl || sourceUrl === BASE_URL) return;

        const rawPrice = $el.find('[class*="price"], [class*="amount"]').first().text();
        const { price, currency } = parsePrice(rawPrice);
        if (price <= 0) return;

        const locationText = $el
          .find('[class*="location"], [class*="address"], address')
          .first()
          .text()
          .trim();
        const parish = parseParish(locationText || title);
        const area = locationText.replace(parish, '').replace(/,/g, '').trim();

        const bedsText = $el.find('[class*="bed"], [title*="bed"]').first().text();
        const bathsText = $el.find('[class*="bath"], [title*="bath"]').first().text();
        const typeText = $el.find('[class*="type"], [class*="category"]').first().text();

        const imgSrc = $el.find('img[src], img[data-src]').first().attr('src')
          ?? $el.find('img').first().attr('data-src') ?? '';

        const listing: RawListing = {
          title,
          description: $el.find('p, [class*="desc"]').first().text().trim().slice(0, 500),
          price, currency, pricePeriod: 'monthly',
          bedrooms: parseInt(bedsText.match(/(\d+)/)?.[1] ?? '1', 10) || 1,
          bathrooms: parseInt(bathsText.match(/(\d+)/)?.[1] ?? '1', 10) || 1,
          propertyType: typeText ? parsePropertyType(typeText) : 'apartment',
          location: { parish, area, address: locationText.slice(0, 200) || title.slice(0, 200) },
          amenities: [],
          images: imgSrc ? [absoluteUrl(imgSrc)] : [],
          contact: {},
          sourceUrl,
          sourceSite: 'coldwellbankerjamaica.com',
          source: 'scrape',
          listedAt: new Date(),
        };

        if (PROPERTY_TYPES.includes(listing.propertyType)) results.push(listing);
      } catch (e) {
        console.warn('[CBJ] Parse error:', e);
      }
    });

    break;
  }

  return results;
}

async function scrapePage(url: string, referer?: string, delayMs = 0): Promise<RawListing[]> {
  let html: string;
  try {
    html = await fetchHtml(url, delayMs, referer);
  } catch (e) {
    console.warn(`[CBJ] Failed to fetch ${url}:`, (e as Error).message);
    return [];
  }

  const $ = cheerio.load(sanitizeHtml(html));

  const bodyText = $('body').text().toLowerCase();
  if (bodyText.includes('captcha') || bodyText.includes('cloudflare') || bodyText.includes('access denied')) {
    console.warn('[CBJ] Bot detection page returned — skipping');
    return [];
  }

  return extractListings($);
}

export async function scrapeColdwellBanker(): Promise<RawListing[]> {
  const all: RawListing[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = page === 1 ? LISTINGS_URL : `${LISTINGS_URL}?page=${page}`;
    const referer = page === 1 ? BASE_URL : LISTINGS_URL;
    const delay = page === 1 ? 0 : PAGE_DELAY_MS;

    console.log(`[CBJ] Scraping page ${page}: ${url}`);
    const listings = await scrapePage(url, referer, delay);

    if (listings.length === 0) {
      console.log(`[CBJ] No listings on page ${page} — stopping`);
      break;
    }

    all.push(...listings);
    console.log(`[CBJ] Page ${page}: ${listings.length} listings`);
  }

  console.log(`[CBJ] Total: ${all.length}`);
  return all;
}
