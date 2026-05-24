import { scrapeRealEstateJamaica } from './realEstateJamaica.js';
import { scrapeColdwellBanker } from './coldwellBanker.js';
import type { RawListing } from '../types.js';

export async function runScrapers(): Promise<RawListing[]> {
  const results: RawListing[] = [];
  for (const { name, fn } of [
    { name: 'RealEstateJamaica', fn: scrapeRealEstateJamaica },
    { name: 'ColdwellBanker', fn: scrapeColdwellBanker },
  ]) {
    try {
      const listings = await fn();
      console.log(`[Scrapers] ${name}: ${listings.length}`);
      results.push(...listings);
    } catch (e) {
      console.error(`[Scrapers] ${name} failed:`, e);
    }
  }
  return results;
}
