import { useState } from 'react';
import type { Listing } from '../types';

interface ListingCardProps {
  listing: Listing;
}

function formatPrice(price: number, currency: string): string {
  return new Intl.NumberFormat('en-JM', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(price);
}

function timeAgo(ts: { toDate(): Date }): string {
  const ms = Date.now() - ts.toDate().getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

const PLACEHOLDER =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="260" viewBox="0 0 400 260"%3E%3Crect width="400" height="260" fill="%23F3F4F6"/%3E%3Ctext x="200" y="138" text-anchor="middle" fill="%239CA3AF" font-family="sans-serif" font-size="14"%3ENo image%3C/text%3E%3C/svg%3E';

export function ListingCard({ listing }: ListingCardProps) {
  const [imgIdx, setImgIdx] = useState(0);
  const [imgError, setImgError] = useState(false);

  const images = listing.images.length > 0 ? listing.images : [PLACEHOLDER];
  const currentImg = imgError ? PLACEHOLDER : images[imgIdx];

  const bedroomLabel =
    listing.bedrooms === 0 ? 'Studio' : `${listing.bedrooms} bed${listing.bedrooms > 1 ? 's' : ''}`;

  return (
    <article className="bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col hover:shadow-md transition-shadow">
      {/* Image */}
      <div className="relative aspect-[16/10] bg-gray-100 overflow-hidden">
        <img
          src={currentImg}
          alt={listing.title}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={() => setImgError(true)}
        />

        {/* Image nav */}
        {images.length > 1 && !imgError && (
          <>
            {imgIdx > 0 && (
              <button
                onClick={() => setImgIdx((i) => i - 1)}
                aria-label="Previous image"
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-white rounded-full w-7 h-7 flex items-center justify-center shadow text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-700"
              >
                ‹
              </button>
            )}
            {imgIdx < images.length - 1 && (
              <button
                onClick={() => setImgIdx((i) => i + 1)}
                aria-label="Next image"
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-white rounded-full w-7 h-7 flex items-center justify-center shadow text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-700"
              >
                ›
              </button>
            )}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setImgIdx(i)}
                  aria-label={`Image ${i + 1}`}
                  className={`w-1.5 h-1.5 rounded-full focus:outline-none ${
                    i === imgIdx ? 'bg-white' : 'bg-white/50'
                  }`}
                />
              ))}
            </div>
          </>
        )}

        {/* Source badge */}
        <span
          className={`absolute top-2 left-2 text-xs px-2 py-0.5 rounded font-medium ${
            listing.source === 'api'
              ? 'bg-blue-50 text-blue-700 border border-blue-200'
              : 'bg-gray-100 text-gray-600 border border-gray-200'
          }`}
        >
          {listing.source === 'api' ? 'API' : 'Web'}
        </span>

        {/* Time badge */}
        <span className="absolute top-2 right-2 text-xs bg-white text-gray-600 px-2 py-0.5 rounded border border-gray-200">
          {timeAgo(listing.listedAt)}
        </span>
      </div>

      {/* Body */}
      <div className="p-4 flex flex-col flex-1 gap-2">
        {/* Price */}
        <div className="flex items-baseline gap-1">
          <span className="text-lg font-bold text-gray-900">
            {formatPrice(listing.price, listing.currency)}
          </span>
          <span className="text-xs text-gray-500">/{listing.pricePeriod}</span>
        </div>

        {/* Title */}
        <h3 className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug">
          {listing.title}
        </h3>

        {/* Location */}
        <p className="text-xs text-gray-500 flex items-center gap-1">
          <svg
            className="w-3 h-3 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <span className="truncate">
            {listing.location.area ? `${listing.location.area}, ` : ''}
            {listing.location.parish}
          </span>
        </p>

        {/* Stats */}
        <div className="flex flex-wrap gap-2 text-xs text-gray-600">
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            {bedroomLabel}
          </span>
          {listing.bathrooms > 0 && (
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {listing.bathrooms} bath{listing.bathrooms !== 1 ? 's' : ''}
            </span>
          )}
          <span className="capitalize">{listing.propertyType}</span>
        </div>

        {/* Amenities */}
        {listing.amenities.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {listing.amenities.slice(0, 3).map((a) => (
              <span
                key={a}
                className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded"
              >
                {a}
              </span>
            ))}
            {listing.amenities.length > 3 && (
              <span className="text-xs text-gray-400">+{listing.amenities.length - 3} more</span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-auto pt-3 flex items-center justify-between border-t border-gray-100">
          <span className="text-xs text-gray-400 truncate max-w-[120px]">{listing.sourceSite}</span>
          <a
            href={listing.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-blue-700 hover:underline focus:outline-none focus:ring-1 focus:ring-blue-700 rounded"
          >
            View listing →
          </a>
        </div>
      </div>
    </article>
  );
}
