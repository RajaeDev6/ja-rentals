import { ListingCard } from './ListingCard';
import type { Listing } from '../types';

interface ListingGridProps {
  listings: Listing[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  onLoadMore: () => void;
}

function SkeletonCard() {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden animate-pulse">
      <div className="aspect-[16/10] bg-gray-200" />
      <div className="p-4 space-y-3">
        <div className="h-6 bg-gray-200 rounded w-2/5" />
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-200 rounded w-1/2" />
        <div className="h-3 bg-gray-200 rounded w-1/3" />
      </div>
    </div>
  );
}

export function ListingGrid({ listings, loading, error, hasMore, onLoadMore }: ListingGridProps) {
  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 text-sm">{error}</p>
        <button
          onClick={onLoadMore}
          className="mt-4 text-sm text-blue-700 hover:underline focus:outline-none focus:ring-1 focus:ring-blue-700 rounded"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!loading && listings.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="text-4xl mb-3">🔍</div>
        <p className="text-gray-700 font-medium">No listings found</p>
        <p className="text-gray-500 text-sm mt-1">
          Try adjusting your filters or check back later for new listings.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {listings.map((l) => (
          <ListingCard key={l.id} listing={l} />
        ))}
        {loading && Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>

      {!loading && hasMore && (
        <div className="mt-10 flex justify-center">
          <button
            onClick={onLoadMore}
            className="px-6 py-2.5 bg-blue-700 text-white text-sm font-medium rounded hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-700 focus:ring-offset-2"
          >
            Load more
          </button>
        </div>
      )}

      {!loading && !hasMore && listings.length > 0 && (
        <p className="text-center text-gray-400 text-xs mt-10">
          {listings.length} listing{listings.length !== 1 ? 's' : ''} — all caught up
        </p>
      )}
    </div>
  );
}
