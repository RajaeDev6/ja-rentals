import * as cheerio from 'cheerio';
import { fetchHtml } from '../utils/fetcher.js';
import { extractFromJsonLd } from '../utils/jsonLd.js';
import { logPageStructure } from '../utils/debugHtml.js';
import type { RawListing, Parish, PropertyType } from '../types.js';
import { PARISHES, PROPERTY_TYPES } from '../types.js';

const BASE_URL = 'https://www.century21jamaica.com';
const LISTINGS_URL = `${BASE_URL}/for-rent`;
const MAX_PAGES = 4;
const PAGE_DELAY_MS = 4000;
const RENDER_JS = false;

function parsePropertyType(raw: string): PropertyType {
  const s = raw.toLowerCase();
  if (s.includes('apartment') || s.includes('flat') || s.includes('condo')) return 'apartment';
  if (s.includes('studio')) return 'studio';
  if (s.includes('townhouse') || s.includes('town house')) return 'townhouse';
  if (s.includes('room')) return 'room';
  if (s.includes('commercial') || s.includes('office')) return 'commercial';
  return 'house';
}

function parseParish(raw: string): Parish {
  return PARISHES.find((p) => raw.toLowerCase().includes(p.toLowerCase())) ?? 'Kingston';
}

function parsePrice(raw: string): { price: number; currency: 'JMD' | 'USD' } {
  const isUSD = raw.includes('US$') || raw.includes('USD') || raw.includes('US ');
  return { price: parseFloat(raw.replace(/[^0-9.]/g, '')) || 0, currency: isUSD ? 'USD' : 'JMD' };
}

function absoluteUrl(href: string): string {
  if (!href) return '';
  return href.startsWith('http') ? href : `${BASE_URL}${href.startsWith('/') ? '' : '/'}${href}`;
}

function extractByCss($: cheerio.CheerioAPI): RawListing[] {
  const results: RawListing[] = [];

  const selectorSets = [
    '[class*="property-item"]',
    '[class*="property-card"]',
    '[class*="listing-item"]',
    '[class*="listing-card"]',
    '[class*="result-item"]',
    '.col-md-4',
    '.col-sm-6',
    'article',
    '.property',
  ];

  for (const sel of selectorSets) {
    const els = $(sel);
    if (els.length < 2) continue;

    els.each((_, el) => {
      try {
        const $el = $(el);
        const priceEl = $el.find('[class*="price"], [class*="amount"], strong, b')
          .filter((_, e) => /[\d,]/.test($(e).text()) && /[$J]/.test($(e).text()))
          .first();
        if (!priceEl.length) return;

        const title = $el.find('h2, h3, h4, [class*="title"], a').first().text().trim();
        if (!title || title.length < 5) return;

        const href = $el.find('a[href]').first().attr('href') ?? '';
        const sourceUrl = absoluteUrl(href);
        if (!sourceUrl || sourceUrl === BASE_URL) return;

        const { price, currency } = parsePrice(priceEl.text());
        if (price <= 0) return;

        const locationText = $el.find('[class*="location"], [class*="address"], [class*="area"]').first().text().trim();
        const parish = parseParish(locationText || title);

        const bedsText = $el.find('[class*="bed"], [class*="room"]').first().text();
        const bathsText = $el.find('[class*="bath"]').first().text();
        const typeText = $el.find('[class*="type"], [class*="category"]').first().text();

        const imgSrc = $el.find('img[src], img[data-src]').first().attr('src')
          ?? $el.find('img').first().attr('data-src') ?? '';

        const listing: RawListing = {
          title,
          description: $el.find('p, [class*="desc"]').first().text().trim().slice(0, 500),
          price, currency, pricePeriod: 'monthly',
          bedrooms: parseInt(bedsText.match(/(\d+)/)?.[1] ?? '1', 10) || 1,
          bathrooms: parseInt(bathsText.match(/(\d+)/)?.[1] ?? '1', 10) || 1,
          propertyType: typeText ? parsePropertyType(typeText) : parsePropertyType(title),
          location: { parish, area: locationText.replace(parish, '').replace(/,/g, '').trim(), address: locationText.slice(0, 200) || title.slice(0, 200) },
          amenities: [], images: imgSrc ? [absoluteUrl(imgSrc)] : [],
          contact: {}, sourceUrl, sourceSite: 'century21jamaica.com', source: 'scrape', listedAt: new Date(),
        };

        if (PROPERTY_TYPES.includes(listing.propertyType)) results.push(listing);
      } catch { /* skip */ }
    });

    if (results.length > 0) break;
  }
  return results;
}

async function scrapePage(url: string, referer?: string, delayMs = 0): Promise<RawListing[]> {
  let html: string;
  try {
    html = await fetchHtml(url, delayMs, referer, RENDER_JS);
  } catch (e) {
    console.warn(`[C21] Failed ${url}:`, (e as Error).message);
    return [];
  }

  const bodyLower = html.toLowerCase();
  if (bodyLower.includes('captcha') || (bodyLower.includes('access denied') && !bodyLower.includes('listing'))) {
    console.warn('[C21] Bot wall — skipping');
    return [];
  }

  const jsonLdResults = extractFromJsonLd(html, 'century21jamaica.com', BASE_URL);
  if (jsonLdResults.length > 0) {
    console.log(`[C21] JSON-LD: ${jsonLdResults.length}`);
    return jsonLdResults;
  }

  const stripped = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
  const $ = cheerio.load(stripped);
  const cssResults = extractByCss($);
  console.log(`[C21] CSS: ${cssResults.length}`);
  if (cssResults.length === 0) logPageStructure(html, 'C21');
  return cssResults;
}

export async function scrapeCentury21Jamaica(): Promise<RawListing[]> {
  const all: RawListing[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = page === 1 ? LISTINGS_URL : `${LISTINGS_URL}?page=${page}`;
    console.log(`[C21] Page ${page}`);
    const listings = await scrapePage(url, page === 1 ? BASE_URL : LISTINGS_URL, page === 1 ? 0 : PAGE_DELAY_MS);
    if (listings.length === 0) { console.log(`[C21] Empty page ${page} — stopping`); break; }
    all.push(...listings);
    console.log(`[C21] Page ${page}: ${listings.length}`);
  }
  console.log(`[C21] Total: ${all.length}`);
  return all;
}
