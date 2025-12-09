import React, { useState, useMemo, useCallback } from 'react';
import { ScrapeResult, ScrapedItem } from './types';
import { PriceSummary } from './components/PriceSummary';
import { Filters } from './components/Filters';
import { DataTable } from './components/DataTable';
import { PriceChart } from './components/PriceChart';

// Detect outliers using IQR method
function detectOutliers(items: ScrapedItem[]): Set<string> {
  const prices = items
    .filter(item => item.price !== null && item.price > 0)
    .map(item => ({ link: item.link, price: item.price as number }));

  if (prices.length < 4) return new Set();

  // Sort prices
  const sortedPrices = prices.map(p => p.price).sort((a, b) => a - b);

  // Calculate Q1, Q3, and IQR
  const q1Index = Math.floor(sortedPrices.length * 0.25);
  const q3Index = Math.floor(sortedPrices.length * 0.75);
  const q1 = sortedPrices[q1Index];
  const q3 = sortedPrices[q3Index];
  const iqr = q3 - q1;

  // Define outlier bounds (1.5 * IQR is standard, using 2.0 for less aggressive filtering)
  const lowerBound = q1 - 2.0 * iqr;
  const upperBound = q3 + 2.0 * iqr;

  // Find outliers
  const outliers = new Set<string>();
  prices.forEach(({ link, price }) => {
    if (price < lowerBound || price > upperBound) {
      outliers.add(link);
    }
  });

  return outliers;
}

function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ScrapeResult | null>(null);
  const [filters, setFilters] = useState<Record<string, string[]>>({});
  const [excludedItems, setExcludedItems] = useState<Set<string>>(new Set());
  const [autoExcludeOutliers, setAutoExcludeOutliers] = useState(true);
  const [chartFilterKey, setChartFilterKey] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setData(null);
    setFilters({});
    setExcludedItems(new Set());

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch data');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: string, values: string[]) => {
    setFilters(prev => {
      if (values.length === 0) {
        const newFilters = { ...prev };
        delete newFilters[key];
        return newFilters;
      }
      return { ...prev, [key]: values };
    });
  };

  const handleClearFilters = () => {
    setFilters({});
  };

  const handleToggleExclude = useCallback((link: string) => {
    setExcludedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(link)) {
        newSet.delete(link);
      } else {
        newSet.add(link);
      }
      return newSet;
    });
  }, []);

  // Detect outliers from all items
  const detectedOutliers = useMemo(() => {
    if (!data || !autoExcludeOutliers) return new Set<string>();
    return detectOutliers(data.items);
  }, [data, autoExcludeOutliers]);

  // Helper to parse kilometer values like "+200,000" or "100,000 - 149,999"
  const parseKilometers = (value: string): number => {
    const cleaned = value.replace(/[+,]/g, '').trim();
    const match = cleaned.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  };

  // Apply filters to items
  const filteredItems = useMemo(() => {
    if (!data) return [];

    return data.items.filter(item => {
      // Check price range filter (OR logic for multiple selections)
      const priceRangeFilters = filters['_priceRange'];
      if (priceRangeFilters && priceRangeFilters.length > 0) {
        const price = item.price;
        if (price === null) return false;

        const matchesAnyRange = priceRangeFilters.some(range => {
          const [min, max] = range.split('-').map(Number);
          if (min && price < min) return false;
          if (max && price > max) return false;
          return true;
        });

        if (!matchesAnyRange) return false;
      }

      // Check year range filter
      const yearFrom = filters['_yearFrom']?.[0];
      const yearTo = filters['_yearTo']?.[0];
      if (yearFrom || yearTo) {
        const itemYear = parseInt(item.attributes['Year'] as string, 10);
        if (isNaN(itemYear)) return false;
        if (yearFrom && itemYear < parseInt(yearFrom, 10)) return false;
        if (yearTo && itemYear > parseInt(yearTo, 10)) return false;
      }

      // Check kilometers range filter
      const kmFrom = filters['_kmFrom']?.[0];
      const kmTo = filters['_kmTo']?.[0];
      if (kmFrom || kmTo) {
        const itemKm = parseKilometers(item.attributes['Kilometers'] as string || '');
        const kmFromVal = kmFrom ? parseKilometers(kmFrom) : 0;
        const kmToVal = kmTo ? parseKilometers(kmTo) : Infinity;
        if (itemKm < kmFromVal || itemKm > kmToVal) return false;
      }

      // Check attribute filters (OR logic within same attribute, AND across attributes)
      for (const [key, filterValues] of Object.entries(filters)) {
        if (key === '_priceRange' || key === '_yearFrom' || key === '_yearTo' || key === '_kmFrom' || key === '_kmTo') continue;
        if (filterValues.length === 0) continue;

        const itemValue = item.attributes[key];
        if (!itemValue) return false;

        // Check if item value matches any of the selected filter values (OR logic)
        const matchesAny = filterValues.some(filterValue => {
          if (Array.isArray(itemValue)) {
            return itemValue.includes(filterValue);
          } else {
            return itemValue === filterValue;
          }
        });

        if (!matchesAny) return false;
      }

      return true;
    });
  }, [data, filters]);

  // Items for statistics (excluding manually excluded and outliers)
  const itemsForStats = useMemo(() => {
    return filteredItems.filter(item =>
      !excludedItems.has(item.link) && !detectedOutliers.has(item.link)
    );
  }, [filteredItems, excludedItems, detectedOutliers]);

  // Calculate price statistics for non-excluded items
  const priceStats = useMemo(() => {
    const prices = itemsForStats
      .map(item => item.price)
      .filter((p): p is number => p !== null && p > 0);

    if (prices.length === 0) {
      return { minPrice: null, maxPrice: null, avgPrice: null };
    }

    return {
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
      avgPrice: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
    };
  }, [itemsForStats]);

  // Export to CSV (only non-excluded items)
  const handleExportCSV = useCallback(() => {
    if (itemsForStats.length === 0) return;

    // Collect all attribute keys
    const allKeys = new Set<string>();
    itemsForStats.forEach(item => {
      Object.keys(item.attributes).forEach(key => allKeys.add(key));
    });
    const attributeKeys = Array.from(allKeys).sort();

    // Build CSV headers
    const headers = ['Link', 'Image', 'Price', ...attributeKeys, 'Description'];

    // Build CSV rows
    const rows = itemsForStats.map(item => {
      const row = [
        item.link,
        item.image,
        item.priceText,
        ...attributeKeys.map(key => {
          const value = item.attributes[key];
          if (!value) return '';
          if (Array.isArray(value)) return value.join('; ');
          return value;
        }),
        item.description,
      ];
      // Escape values for CSV
      return row.map(val => {
        const str = String(val || '');
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      });
    });

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `opensooq-export-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }, [itemsForStats]);

  return (
    <div className="container">
      <h1>🚗 OpenSooq Listings Analyzer</h1>

      <form className="search-form" onSubmit={handleSubmit}>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter OpenSooq search URL (e.g., https://jo.opensooq.com/en/cars/cars-for-sale/honda/civic)"
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Scraping...' : 'Scrape'}
        </button>
      </form>

      {loading && (
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>Fetching and parsing listings... This may take a moment.</p>
        </div>
      )}

      {error && (
        <div className="error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {data && !loading && (
        <>
          <div className="outlier-toggle">
            <label>
              <input
                type="checkbox"
                checked={autoExcludeOutliers}
                onChange={(e) => setAutoExcludeOutliers(e.target.checked)}
              />
              Auto-exclude price outliers ({detectedOutliers.size} detected)
            </label>
          </div>

          <div className="sticky-summary">
            <PriceSummary
              minPrice={priceStats.minPrice}
              maxPrice={priceStats.maxPrice}
              avgPrice={priceStats.avgPrice}
              totalItems={data.totalItems}
              filteredCount={itemsForStats.length}
              excludedCount={excludedItems.size + detectedOutliers.size}
            />
          </div>

          <Filters
            items={data.items}
            filters={filters}
            onFilterChange={handleFilterChange}
            onClearFilters={handleClearFilters}
            onShowChart={setChartFilterKey}
          />

          {chartFilterKey && (
            <PriceChart
              items={filteredItems}
              filterKey={chartFilterKey}
              excludedItems={excludedItems}
              outlierItems={detectedOutliers}
              onClose={() => setChartFilterKey(null)}
            />
          )}

          <DataTable
            items={filteredItems}
            onExportCSV={handleExportCSV}
            excludedItems={excludedItems}
            outlierItems={detectedOutliers}
            onToggleExclude={handleToggleExclude}
          />
        </>
      )}
    </div>
  );
}

export default App;
