import { scrapeRealEstateJamaica } from './realEstateJamaica.js';
import { scrapeColdwellBanker } from './coldwellBanker.js';
import { scrapeLoopJamaica } from './loopJamaica.js';
import type { RawListing } from '../types.js';

export async function runScrapers(): Promise<RawListing[]> {
  const scrapers = [
    { name: 'RealEstateJamaica', fn: scrapeRealEstateJamaica },
    { name: 'ColdwellBanker', fn: scrapeColdwellBanker },
    { name: 'LoopJamaica', fn: scrapeLoopJamaica },
  ];

  // Run all scrapers concurrently — a slow/failing one won't block the others
  const settled = await Promise.allSettled(scrapers.map(({ fn }) => fn()));
  const results: RawListing[] = [];

  settled.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      console.log(`[Scrapers] ${scrapers[i].name}: ${result.value.length}`);
      results.push(...result.value);
    } else {
      console.error(`[Scrapers] ${scrapers[i].name} failed:`, result.reason);
    }
  });

  return results;
}
