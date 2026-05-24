import { useState, useEffect, useCallback, useRef } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type DocumentData,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Listing, FilterState } from '../types';
import { PARISHES, PROPERTY_TYPES, PRICE_LIMITS } from '../types';

const PAGE_SIZE = 12;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function sanitizeFilters(f: FilterState): FilterState {
  const parish = (PARISHES as readonly string[]).includes(f.parish) ? f.parish : '';
  const propertyType = (PROPERTY_TYPES as readonly string[]).includes(f.propertyType)
    ? f.propertyType
    : '';
  const currency = f.currency === 'USD' ? 'USD' : 'JMD';
  const limits = PRICE_LIMITS[currency];

  const minPrice = (() => {
    const n = parseInt(f.minPrice, 10);
    if (isNaN(n) || n < limits.min) return '';
    return String(Math.min(n, limits.max));
  })();

  const maxPrice = (() => {
    const n = parseInt(f.maxPrice, 10);
    if (isNaN(n) || n < limits.min) return '';
    return String(Math.min(n, limits.max));
  })();

  const validBedrooms = ['', '0', '1', '2', '3', '4'];
  const bedrooms = validBedrooms.includes(f.bedrooms) ? f.bedrooms : '';

  const validSort = ['newest', 'price_asc', 'price_desc'] as const;
  const sort = (validSort as readonly string[]).includes(f.sort)
    ? (f.sort as FilterState['sort'])
    : 'newest';

  const area = f.area.replace(/[<>"']/g, '').slice(0, 100).trim();

  return { parish, area, minPrice, maxPrice, currency, bedrooms, propertyType, sort };
}

export function useListings(rawFilters: FilterState) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const cursorRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const filtersRef = useRef<string>('');

  const buildQuery = useCallback(
    (filters: FilterState, cursor: QueryDocumentSnapshot<DocumentData> | null) => {
      const thirtyDaysAgo = Timestamp.fromMillis(Date.now() - THIRTY_DAYS_MS);
      const constraints: QueryConstraint[] = [
        where('isActive', '==', true),
        where('listedAt', '>=', thirtyDaysAgo),
      ];

      if (filters.parish) constraints.push(where('location.parish', '==', filters.parish));
      if (filters.propertyType) constraints.push(where('propertyType', '==', filters.propertyType));
      if (filters.bedrooms !== '') {
        const beds = parseInt(filters.bedrooms, 10);
        if (filters.bedrooms === '4') {
          constraints.push(where('bedrooms', '>=', 4));
        } else {
          constraints.push(where('bedrooms', '==', beds));
        }
      }
      if (filters.minPrice) {
        constraints.push(where('price', '>=', parseInt(filters.minPrice, 10)));
      }
      if (filters.maxPrice) {
        constraints.push(where('price', '<=', parseInt(filters.maxPrice, 10)));
      }

      const sortField = filters.sort === 'newest' ? 'listedAt' : 'price';
      const sortDir = filters.sort === 'price_asc' ? 'asc' : 'desc';
      constraints.push(orderBy(sortField, sortDir));

      if (cursor) constraints.push(startAfter(cursor));
      constraints.push(limit(PAGE_SIZE + 1));

      return query(collection(db, 'listings'), ...constraints);
    },
    []
  );

  const fetchPage = useCallback(
    async (filters: FilterState, cursor: QueryDocumentSnapshot<DocumentData> | null) => {
      const safe = sanitizeFilters(filters);
      const q = buildQuery(safe, cursor);
      const snap = await getDocs(q);
      const docs = snap.docs;
      const hasNextPage = docs.length > PAGE_SIZE;
      const pageDocs = hasNextPage ? docs.slice(0, PAGE_SIZE) : docs;
      const results = pageDocs.map((d) => ({ id: d.id, ...d.data() } as Listing));

      // Client-side area filter (Firestore doesn't support case-insensitive contains)
      const filtered = safe.area
        ? results.filter((l) =>
            l.location.area.toLowerCase().includes(safe.area.toLowerCase()) ||
            l.location.address.toLowerCase().includes(safe.area.toLowerCase())
          )
        : results;

      return {
        listings: filtered,
        cursor: pageDocs.length > 0 ? pageDocs[pageDocs.length - 1] : null,
        hasMore: hasNextPage,
      };
    },
    [buildQuery]
  );

  // Reset and fetch first page when filters change
  useEffect(() => {
    const filterKey = JSON.stringify(rawFilters);
    if (filtersRef.current === filterKey) return;
    filtersRef.current = filterKey;
    cursorRef.current = null;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchPage(rawFilters, null)
      .then(({ listings: page, cursor, hasMore: more }) => {
        if (cancelled) return;
        setListings(page);
        cursorRef.current = cursor;
        setHasMore(more);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        console.error(e);
        setError('Failed to load listings. Please try again.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [rawFilters, fetchPage]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loading) return;
    setLoading(true);
    try {
      const { listings: page, cursor, hasMore: more } = await fetchPage(rawFilters, cursorRef.current);
      setListings((prev) => [...prev, ...page]);
      cursorRef.current = cursor;
      setHasMore(more);
    } catch (e) {
      console.error(e);
      setError('Failed to load more listings.');
    } finally {
      setLoading(false);
    }
  }, [hasMore, loading, rawFilters, fetchPage]);

  return { listings, loading, error, hasMore, loadMore };
}
