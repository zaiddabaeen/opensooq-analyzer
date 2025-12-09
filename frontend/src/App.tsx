import React, { useState, useMemo, useCallback } from 'react';
import { ScrapeResult } from './types';
import { PriceSummary } from './components/PriceSummary';
import { Filters } from './components/Filters';
import { DataTable } from './components/DataTable';

function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ScrapeResult | null>(null);
  const [filters, setFilters] = useState<Record<string, string[]>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setData(null);
    setFilters({});

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

      // Check attribute filters (OR logic within same attribute, AND across attributes)
      for (const [key, filterValues] of Object.entries(filters)) {
        if (key === '_priceRange') continue;
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

  // Calculate price statistics for filtered items
  const priceStats = useMemo(() => {
    const prices = filteredItems
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
  }, [filteredItems]);

  // Export to CSV
  const handleExportCSV = useCallback(() => {
    if (filteredItems.length === 0) return;

    // Collect all attribute keys
    const allKeys = new Set<string>();
    filteredItems.forEach(item => {
      Object.keys(item.attributes).forEach(key => allKeys.add(key));
    });
    const attributeKeys = Array.from(allKeys).sort();

    // Build CSV headers
    const headers = ['Link', 'Image', 'Price', ...attributeKeys, 'Description'];

    // Build CSV rows
    const rows = filteredItems.map(item => {
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
  }, [filteredItems]);

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
          <PriceSummary
            minPrice={priceStats.minPrice}
            maxPrice={priceStats.maxPrice}
            avgPrice={priceStats.avgPrice}
            totalItems={data.totalItems}
            filteredCount={filteredItems.length}
          />

          <Filters
            items={data.items}
            filters={filters}
            onFilterChange={handleFilterChange}
            onClearFilters={handleClearFilters}
          />

          <DataTable items={filteredItems} onExportCSV={handleExportCSV} />
        </>
      )}
    </div>
  );
}

export default App;
