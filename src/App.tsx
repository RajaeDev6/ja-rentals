import { useState } from 'react';
import { Header } from './components/Header';
import { FilterBar } from './components/FilterBar';
import { ListingGrid } from './components/ListingGrid';
import { Footer } from './components/Footer';
import { useListings } from './hooks/useListings';
import { DEFAULT_FILTERS } from './types';
import type { FilterState } from './types';

export default function App() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const { listings, loading, error, hasMore, loadMore } = useListings(filters);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <FilterBar filters={filters} onChange={setFilters} />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-base font-semibold text-gray-900">
            Rentals in Jamaica
          </h1>
          {!loading && listings.length > 0 && (
            <span className="text-xs text-gray-500">{listings.length} shown</span>
          )}
        </div>
        <ListingGrid
          listings={listings}
          loading={loading}
          error={error}
          hasMore={hasMore}
          onLoadMore={loadMore}
        />
      </main>
      <Footer />
    </div>
  );
}
