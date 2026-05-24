import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { runScrapers } from './scrapers/index.js';
import { runApiEngines } from './apiEngines/index.js';
import { deduplicateListings, makeDedupeHash } from './utils/deduplication.js';
import type { RawListing } from './types.js';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const BATCH_LIMIT = 400;

function initFirebase() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT env var is not set');
  const serviceAccount = JSON.parse(raw) as object;
  initializeApp({ credential: cert(serviceAccount) });
  return getFirestore();
}

async function writeListings(db: FirebaseFirestore.Firestore, listings: RawListing[]): Promise<number> {
  const now = Timestamp.now();
  let written = 0;

  for (let i = 0; i < listings.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    for (const listing of listings.slice(i, i + BATCH_LIMIT)) {
      const id = makeDedupeHash(listing);
      batch.set(
        db.collection('listings').doc(id),
        { ...listing, id, listedAt: Timestamp.fromDate(listing.listedAt), fetchedAt: now, isActive: true },
        { merge: true }
      );
    }
    await batch.commit();
    written += Math.min(BATCH_LIMIT, listings.length - i);
  }
  return written;
}

async function pruneExpired(db: FirebaseFirestore.Firestore): Promise<number> {
  const cutoff = Timestamp.fromMillis(Date.now() - THIRTY_DAYS_MS);
  const snap = await db.collection('listings').where('listedAt', '<', cutoff).limit(500).get();
  if (snap.empty) return 0;

  const batch = db.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  return snap.size;
}

async function main() {
  console.log('[fetch] Starting — ' + new Date().toISOString());

  const db = initFirebase();

  const [scraperResult, apiResult] = await Promise.allSettled([runScrapers(), runApiEngines()]);

  const scraped = scraperResult.status === 'fulfilled' ? scraperResult.value : [];
  const apiData = apiResult.status === 'fulfilled' ? apiResult.value : [];

  if (scraperResult.status === 'rejected') console.error('[fetch] Scrapers failed:', scraperResult.reason);
  if (apiResult.status === 'rejected') console.error('[fetch] API engines failed:', apiResult.reason);

  const combined = [...scraped, ...apiData];
  console.log(`[fetch] Combined: ${combined.length} before dedup`);

  const deduped = deduplicateListings(combined);
  console.log(`[fetch] After dedup: ${deduped.length}`);

  const written = await writeListings(db, deduped);
  console.log(`[fetch] Written: ${written}`);

  const pruned = await pruneExpired(db);
  console.log(`[fetch] Pruned: ${pruned} expired listings`);

  console.log('[fetch] Done — ' + new Date().toISOString());
}

main().catch((e) => { console.error(e); process.exit(1); });
