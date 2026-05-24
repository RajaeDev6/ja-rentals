import { fetchFromRapidApi } from './rapidApi.js';
import type { RawListing } from '../types.js';

export async function runApiEngines(): Promise<RawListing[]> {
  const results: RawListing[] = [];
  for (const { name, fn } of [{ name: 'RapidAPI', fn: fetchFromRapidApi }]) {
    try {
      const listings = await fn();
      console.log(`[API Engines] ${name}: ${listings.length}`);
      results.push(...listings);
    } catch (e) {
      console.error(`[API Engines] ${name} failed:`, e);
    }
  }
  return results;
}
