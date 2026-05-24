import * as cheerio from 'cheerio';
import { fetchPageHtml } from '../utils/browser.js';
import { extractFromJsonLd } from '../utils/jsonLd.js';
import type { RawListing, Parish, PropertyType } from '../types.js';
import { PARISHES, PROPERTY_TYPES } from '../types.js';

const BASE_URL = 'https://www.realestatejamaica.com';
const LISTINGS_URL = `${BASE_URL}/for-rent/`;
const MAX_PAGES = 5;
const PAGE_DELAY_MS = 4000;
// Enable JS rendering — site likely requires it

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

function absoluteUrl(href: string): string {
  if (!href) return '';
  return href.startsWith('http') ? href : `${BASE_URL}${href.startsWith('/') ? '' : '/'}${href}`;
}

function extractByCss($: cheerio.CheerioAPI): RawListing[] {
  const results: RawListing[] = [];
  const selectors = [
    '[class*="listing-item"]', '[class*="property-item"]',
    '[class*="property-card"]', 'article.listing', '.listing',
    '[data-listing-id]', '.card',
  ];

  for (const sel of selectors) {
    const els = $(sel);
    if (els.length === 0) continue;

    els.each((_, el) => {
      try {
        const $el = $(el);
        const title = $el.find('[class*="title"], h2, h3, h4').first().text().trim();
        if (!title || title.length < 5) return;

        const href = $el.find('a[href]').first().attr('href') ?? '';
        const sourceUrl = absoluteUrl(href);
        if (!sourceUrl || sourceUrl === BASE_URL) return;

        const { price, currency } = parsePrice($el.find('[class*="price"], [class*="amount"]').first().text());
        if (price <= 0) return;

        const locationText = $el.find('[class*="location"], [class*="address"], [class*="area"]').first().text().trim();
        const parish = parseParish(locationText || title);

        const imgSrc = $el.find('img[src], img[data-src]').first().attr('src')
          ?? $el.find('img').first().attr('data-src') ?? '';

        const listing: RawListing = {
          title,
          description: $el.find('[class*="desc"], p').first().text().trim().slice(0, 500),
          price, currency, pricePeriod: 'monthly',
          bedrooms: parseInt($el.find('[class*="bed"]').first().text().match(/(\d+)/)?.[1] ?? '1', 10) || 1,
          bathrooms: parseInt($el.find('[class*="bath"]').first().text().match(/(\d+)/)?.[1] ?? '1', 10) || 1,
          propertyType: parsePropertyType($el.find('[class*="type"], [class*="category"]').first().text()) || 'apartment',
          location: { parish, area: locationText.replace(parish, '').replace(/,/g, '').trim(), address: locationText.slice(0, 200) || title.slice(0, 200) },
          amenities: [], images: imgSrc ? [absoluteUrl(imgSrc)] : [],
          contact: {}, sourceUrl, sourceSite: 'realestatejamaica.com', source: 'scrape', listedAt: new Date(),
        };

        if (PROPERTY_TYPES.includes(listing.propertyType)) results.push(listing);
      } catch { /* skip bad element */ }
    });

    if (results.length > 0) break;
  }
  return results;
}

async function scrapePage(url: string, _referer?: string, delayMs = 0): Promise<RawListing[]> {
  if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
  let html: string;
  try {
    html = await fetchPageHtml(url, 2500);
  } catch (e) {
    console.warn(`[REJ] Failed ${url}:`, (e as Error).message);
    return [];
  }

  const bodyLower = html.toLowerCase();
  if (bodyLower.includes('captcha') || (bodyLower.includes('access denied') && !bodyLower.includes('listing'))) {
    console.warn('[REJ] Bot wall detected — skipping page');
    return [];
  }

  // JSON-LD is the most reliable — try it first
  const jsonLdResults = extractFromJsonLd(html, 'realestatejamaica.com', BASE_URL);
  if (jsonLdResults.length > 0) {
    console.log(`[REJ] JSON-LD: ${jsonLdResults.length} listings`);
    return jsonLdResults;
  }

  // Fall back to CSS selectors
  const stripped = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
  const $ = cheerio.load(stripped);
  const cssResults = extractByCss($);
  console.log(`[REJ] CSS selectors: ${cssResults.length} listings`);
  return cssResults;
}

export async function scrapeRealEstateJamaica(): Promise<RawListing[]> {
  const all: RawListing[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = page === 1 ? LISTINGS_URL : `${LISTINGS_URL}?page=${page}`;
    console.log(`[REJ] Page ${page}`);
    const listings = await scrapePage(url, page === 1 ? BASE_URL : LISTINGS_URL, page === 1 ? 0 : PAGE_DELAY_MS);
    if (listings.length === 0) { console.log(`[REJ] Empty page ${page} — stopping`); break; }
    all.push(...listings);
    console.log(`[REJ] Page ${page}: ${listings.length}`);
  }
  console.log(`[REJ] Total: ${all.length}`);
  return all;
}
