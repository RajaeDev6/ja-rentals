import * as cheerio from 'cheerio';
import { fetchHtml } from '../utils/fetcher.js';
import { extractFromJsonLd } from '../utils/jsonLd.js';
import type { RawListing, Parish, PropertyType } from '../types.js';
import { PARISHES, PROPERTY_TYPES } from '../types.js';

const BASE_URL = 'https://loopjamaica.com';
const LISTINGS_URL = `${BASE_URL}/classifieds/real-estate/for-rent`;
const MAX_PAGES = 5;
const PAGE_DELAY_MS = 3500;
const RENDER_JS = false;

function parsePropertyType(raw: string): PropertyType {
  const s = raw.toLowerCase();
  if (s.includes('apartment') || s.includes('flat')) return 'apartment';
  if (s.includes('studio')) return 'studio';
  if (s.includes('townhouse')) return 'townhouse';
  if (s.includes('room')) return 'room';
  if (s.includes('commercial') || s.includes('office') || s.includes('retail')) return 'commercial';
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
    '[class*="classified-item"]',
    '[class*="ad-item"]',
    '[class*="listing"]',
    '[class*="property"]',
    'article',
    '.card',
    '.col-sm-4 > div',
    '.col-md-4 > div',
  ];

  for (const sel of selectorSets) {
    const els = $(sel);
    if (els.length < 2) continue;

    els.each((_, el) => {
      try {
        const $el = $(el);
        const priceEl = $el.find('[class*="price"], strong, b').filter((_, e) => /[\d,J$]/.test($(e).text())).first();
        if (!priceEl.length) return;

        const title = $el.find('h2, h3, h4, [class*="title"], a').first().text().trim();
        if (!title || title.length < 5) return;

        const href = $el.find('a[href]').first().attr('href') ?? '';
        const sourceUrl = absoluteUrl(href);
        if (!sourceUrl || sourceUrl === BASE_URL) return;

        const { price, currency } = parsePrice(priceEl.text());
        if (price <= 0) return;

        const locationText = $el.find('[class*="location"], [class*="area"], [class*="parish"]').first().text().trim();
        const parish = parseParish(locationText || title);

        const bedsText = $el.find('[class*="bed"], [class*="room"]').first().text();
        const bathsText = $el.find('[class*="bath"]').first().text();

        const imgSrc = $el.find('img[src], img[data-src]').first().attr('src')
          ?? $el.find('img').first().attr('data-src') ?? '';

        const listing: RawListing = {
          title,
          description: $el.find('p, [class*="desc"]').first().text().trim().slice(0, 500),
          price, currency, pricePeriod: 'monthly',
          bedrooms: parseInt(bedsText.match(/(\d+)/)?.[1] ?? '1', 10) || 1,
          bathrooms: parseInt(bathsText.match(/(\d+)/)?.[1] ?? '1', 10) || 1,
          propertyType: parsePropertyType(title),
          location: { parish, area: locationText.replace(parish, '').replace(/,/g, '').trim(), address: locationText.slice(0, 200) || title.slice(0, 200) },
          amenities: [], images: imgSrc ? [absoluteUrl(imgSrc)] : [],
          contact: {}, sourceUrl, sourceSite: 'loopjamaica.com', source: 'scrape', listedAt: new Date(),
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
    console.warn(`[LOOP] Failed ${url}:`, (e as Error).message);
    return [];
  }

  const bodyLower = html.toLowerCase();
  if (bodyLower.includes('captcha') || (bodyLower.includes('access denied') && !bodyLower.includes('listing'))) {
    console.warn('[LOOP] Bot wall — skipping');
    return [];
  }

  const jsonLdResults = extractFromJsonLd(html, 'loopjamaica.com', BASE_URL);
  if (jsonLdResults.length > 0) {
    console.log(`[LOOP] JSON-LD: ${jsonLdResults.length}`);
    return jsonLdResults;
  }

  const stripped = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
  const $ = cheerio.load(stripped);
  const cssResults = extractByCss($);
  console.log(`[LOOP] CSS: ${cssResults.length}`);
  return cssResults;
}

export async function scrapeLoopJamaica(): Promise<RawListing[]> {
  const all: RawListing[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = page === 1 ? LISTINGS_URL : `${LISTINGS_URL}?page=${page}`;
    console.log(`[LOOP] Page ${page}`);
    const listings = await scrapePage(url, page === 1 ? BASE_URL : LISTINGS_URL, page === 1 ? 0 : PAGE_DELAY_MS);
    if (listings.length === 0) { console.log(`[LOOP] Empty page ${page} — stopping`); break; }
    all.push(...listings);
    console.log(`[LOOP] Page ${page}: ${listings.length}`);
  }
  console.log(`[LOOP] Total: ${all.length}`);
  return all;
}
