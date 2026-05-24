import { createHash } from 'crypto';
import type { RawListing } from '../types.js';

export function makeDedupeHash(l: Partial<RawListing>): string {
  const key = [
    (l.location?.parish ?? '').toLowerCase().trim(),
    (l.location?.address ?? '').toLowerCase().replace(/\s+/g, ' ').trim(),
    l.bedrooms ?? '',
    l.bathrooms ?? '',
    l.price ?? '',
    l.currency ?? '',
  ].join('|');
  return createHash('sha256').update(key).digest('hex').slice(0, 32);
}

export function deduplicateListings(listings: RawListing[]): RawListing[] {
  const seen = new Map<string, RawListing>();
  for (const l of listings) {
    const hash = makeDedupeHash(l);
    if (!seen.has(hash)) seen.set(hash, l);
  }
  return Array.from(seen.values());
}
