import { type ChangeEvent } from 'react';
import { PARISHES, PROPERTY_TYPES, DEFAULT_FILTERS } from '../types';
import type { FilterState, Currency } from '../types';

interface FilterBarProps {
  filters: FilterState;
  onChange: (f: FilterState) => void;
}

const BEDROOM_OPTIONS = [
  { label: 'Any', value: '' },
  { label: 'Studio', value: '0' },
  { label: '1', value: '1' },
  { label: '2', value: '2' },
  { label: '3', value: '3' },
  { label: '4+', value: '4' },
];

const SORT_OPTIONS = [
  { label: 'Newest first', value: 'newest' },
  { label: 'Price: low to high', value: 'price_asc' },
  { label: 'Price: high to low', value: 'price_desc' },
];

export function FilterBar({ filters, onChange }: FilterBarProps) {
  function set<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    onChange({ ...filters, [key]: value });
  }

  function handleText(key: keyof FilterState) {
    return (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      set(key, e.target.value as FilterState[typeof key]);
  }

  function handleCurrency(c: Currency) {
    onChange({ ...filters, currency: c, minPrice: '', maxPrice: '' });
  }

  function handleReset() {
    onChange(DEFAULT_FILTERS);
  }

  const isFiltered =
    filters.parish !== DEFAULT_FILTERS.parish ||
    filters.area !== DEFAULT_FILTERS.area ||
    filters.minPrice !== DEFAULT_FILTERS.minPrice ||
    filters.maxPrice !== DEFAULT_FILTERS.maxPrice ||
    filters.bedrooms !== DEFAULT_FILTERS.bedrooms ||
    filters.propertyType !== DEFAULT_FILTERS.propertyType;

  const pricePlaceholder = filters.currency === 'JMD' ? 'e.g. 80000' : 'e.g. 800';

  return (
    <section className="bg-white border-b border-gray-200 py-4">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Parish */}
          <div className="flex flex-col gap-1 min-w-[140px]">
            <label className="text-xs font-medium text-gray-600">Parish</label>
            <select
              value={filters.parish}
              onChange={handleText('parish')}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-700 focus:border-blue-700"
            >
              <option value="">All parishes</option>
              {PARISHES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Area */}
          <div className="flex flex-col gap-1 min-w-[140px]">
            <label className="text-xs font-medium text-gray-600">Area / Street</label>
            <input
              type="text"
              placeholder="e.g. New Kingston"
              value={filters.area}
              onChange={handleText('area')}
              maxLength={100}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-700 focus:border-blue-700"
            />
          </div>

          {/* Property type */}
          <div className="flex flex-col gap-1 min-w-[130px]">
            <label className="text-xs font-medium text-gray-600">Type</label>
            <select
              value={filters.propertyType}
              onChange={handleText('propertyType')}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-700 focus:border-blue-700"
            >
              <option value="">All types</option>
              {PROPERTY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Bedrooms */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Bedrooms</label>
            <div className="flex">
              {BEDROOM_OPTIONS.map(({ label, value }, i) => (
                <button
                  key={value}
                  onClick={() => set('bedrooms', value)}
                  className={[
                    'px-3 py-1.5 text-sm border-y border-r border-gray-300 first:border-l first:rounded-l last:rounded-r',
                    'focus:outline-none focus:relative focus:ring-1 focus:ring-blue-700',
                    filters.bedrooms === value
                      ? 'bg-blue-700 text-white border-blue-700'
                      : 'bg-white text-gray-700 hover:bg-gray-50',
                    i === 0 ? 'rounded-l border-l' : '',
                    i === BEDROOM_OPTIONS.length - 1 ? 'rounded-r' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Currency toggle */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Currency</label>
            <div className="flex">
              {(['JMD', 'USD'] as Currency[]).map((c) => (
                <button
                  key={c}
                  onClick={() => handleCurrency(c)}
                  className={[
                    'px-3 py-1.5 text-sm border-y border-r border-gray-300 first:border-l first:rounded-l last:rounded-r',
                    'focus:outline-none focus:ring-1 focus:ring-blue-700',
                    filters.currency === c
                      ? 'bg-blue-700 text-white border-blue-700'
                      : 'bg-white text-gray-700 hover:bg-gray-50',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Price range */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">
              Price / month ({filters.currency})
            </label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                placeholder={pricePlaceholder}
                value={filters.minPrice}
                min={0}
                onChange={handleText('minPrice')}
                className="border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-900 w-28 focus:outline-none focus:ring-1 focus:ring-blue-700 focus:border-blue-700"
              />
              <span className="text-gray-400 text-sm">—</span>
              <input
                type="number"
                placeholder={pricePlaceholder}
                value={filters.maxPrice}
                min={0}
                onChange={handleText('maxPrice')}
                className="border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-900 w-28 focus:outline-none focus:ring-1 focus:ring-blue-700 focus:border-blue-700"
              />
            </div>
          </div>

          {/* Sort */}
          <div className="flex flex-col gap-1 min-w-[160px]">
            <label className="text-xs font-medium text-gray-600">Sort by</label>
            <select
              value={filters.sort}
              onChange={handleText('sort')}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-700 focus:border-blue-700"
            >
              {SORT_OPTIONS.map(({ label, value }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Reset */}
          {isFiltered && (
            <button
              onClick={handleReset}
              className="mt-auto px-3 py-1.5 text-sm text-blue-700 border border-blue-700 rounded hover:bg-blue-50 focus:outline-none focus:ring-1 focus:ring-blue-700"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
