import React from 'react';
import { ScrapedItem } from '../types';

interface FiltersProps {
  items: ScrapedItem[];
  filters: Record<string, string[]>;
  onFilterChange: (key: string, values: string[]) => void;
  onClearFilters: () => void;
  onShowChart: (filterKey: string) => void;
}

// Helper to parse kilometer values like "+200,000" or "100,000 - 149,999"
function parseKilometers(value: string): number {
  // Remove + and commas, take first number
  const cleaned = value.replace(/[+,]/g, '').trim();
  const match = cleaned.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

export const Filters: React.FC<FiltersProps> = ({
  items,
  filters,
  onFilterChange,
  onClearFilters,
  onShowChart,
}) => {
  // Collect all unique attribute keys and their values
  const attributeOptions: Record<string, Set<string>> = {};

  items.forEach(item => {
    Object.entries(item.attributes).forEach(([key, value]) => {
      if (!attributeOptions[key]) {
        attributeOptions[key] = new Set();
      }
      if (Array.isArray(value)) {
        value.forEach(v => attributeOptions[key].add(v));
      } else {
        attributeOptions[key].add(value);
      }
    });
  });

  // Sort attribute keys for consistent display
  const sortedKeys = Object.keys(attributeOptions).sort();

  // Get year options for range filter
  const yearOptions = attributeOptions['Year']
    ? Array.from(attributeOptions['Year'])
        .map(y => parseInt(y, 10))
        .filter(y => !isNaN(y))
        .sort((a, b) => a - b)
    : [];

  // Get kilometers options for range filter
  const kmOptions = attributeOptions['Kilometers']
    ? Array.from(attributeOptions['Kilometers'])
        .sort((a, b) => parseKilometers(a) - parseKilometers(b))
    : [];

  // Get current year filter values
  const yearFromFilter = filters['_yearFrom']?.[0] || '';
  const yearToFilter = filters['_yearTo']?.[0] || '';

  // Get current kilometers filter values
  const kmFromFilter = filters['_kmFrom']?.[0] || '';
  const kmToFilter = filters['_kmTo']?.[0] || '';

  const handleYearFromChange = (value: string) => {
    onFilterChange('_yearFrom', value ? [value] : []);
  };

  const handleYearToChange = (value: string) => {
    onFilterChange('_yearTo', value ? [value] : []);
  };

  const handleKmFromChange = (value: string) => {
    onFilterChange('_kmFrom', value ? [value] : []);
  };

  const handleKmToChange = (value: string) => {
    onFilterChange('_kmTo', value ? [value] : []);
  };

  // Add price range filter
  const priceRanges = [
    { label: 'Under 5,000', value: '0-5000' },
    { label: '5,000 - 10,000', value: '5000-10000' },
    { label: '10,000 - 20,000', value: '10000-20000' },
    { label: '20,000 - 50,000', value: '20000-50000' },
    { label: 'Over 50,000', value: '50000-' },
  ];

  const handleMultiSelectChange = (key: string, value: string) => {
    const currentValues = filters[key] || [];
    let newValues: string[];

    if (currentValues.includes(value)) {
      newValues = currentValues.filter(v => v !== value);
    } else {
      newValues = [...currentValues, value];
    }

    onFilterChange(key, newValues);
  };

  const activeFilterCount = Object.values(filters).filter(v => v.length > 0).length;

  // Filter out Year and Kilometers from sortedKeys since we handle them separately
  const regularKeys = sortedKeys.filter(k => k !== 'Year' && k !== 'Kilometers');

  return (
    <div className="filters-section">
      <h2>Filters {activeFilterCount > 0 && <span className="filter-count">({activeFilterCount} active)</span>}</h2>
      <div className="filters-grid">
        <div className="filter-item">
          <label>Price Range</label>
          <div className="multi-select">
            {priceRanges.map(range => (
              <label key={range.value} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={(filters['_priceRange'] || []).includes(range.value)}
                  onChange={() => handleMultiSelectChange('_priceRange', range.value)}
                />
                <span>{range.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Year Range Filter */}
        {yearOptions.length > 0 && (
          <div className="filter-item">
            <div className="filter-label-row">
              <label>Year</label>
              <button
                className="chart-icon-btn"
                onClick={() => onShowChart('Year')}
                title="Show Year vs Average Price chart"
              >
                📊
              </button>
            </div>
            <div className="range-filter">
              <div className="range-input-group">
                <label>From</label>
                <select
                  value={yearFromFilter}
                  onChange={(e) => handleYearFromChange(e.target.value)}
                >
                  <option value="">Any</option>
                  {yearOptions.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
              <div className="range-input-group">
                <label>To</label>
                <select
                  value={yearToFilter}
                  onChange={(e) => handleYearToChange(e.target.value)}
                >
                  <option value="">Any</option>
                  {yearOptions.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Kilometers Range Filter */}
        {kmOptions.length > 0 && (
          <div className="filter-item">
            <div className="filter-label-row">
              <label>Kilometers</label>
              <button
                className="chart-icon-btn"
                onClick={() => onShowChart('Kilometers')}
                title="Show Kilometers vs Average Price chart"
              >
                📊
              </button>
            </div>
            <div className="range-filter">
              <div className="range-input-group">
                <label>From</label>
                <select
                  value={kmFromFilter}
                  onChange={(e) => handleKmFromChange(e.target.value)}
                >
                  <option value="">Any</option>
                  {kmOptions.map(km => (
                    <option key={km} value={km}>{km}</option>
                  ))}
                </select>
              </div>
              <div className="range-input-group">
                <label>To</label>
                <select
                  value={kmToFilter}
                  onChange={(e) => handleKmToChange(e.target.value)}
                >
                  <option value="">Any</option>
                  {kmOptions.map(km => (
                    <option key={km} value={km}>{km}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {regularKeys.map(key => {
          const options = Array.from(attributeOptions[key]).sort();
          const selectedValues = filters[key] || [];

          return (
            <div key={key} className="filter-item">
              <div className="filter-label-row">
                <label>{key}</label>
                <button
                  className="chart-icon-btn"
                  onClick={() => onShowChart(key)}
                  title={`Show ${key} vs Average Price chart`}
                >
                  📊
                </button>
              </div>
              <div className="multi-select">
                {options.slice(0, 10).map(option => (
                  <label key={option} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={selectedValues.includes(option)}
                      onChange={() => handleMultiSelectChange(key, option)}
                    />
                    <span title={option}>{option.length > 20 ? option.substring(0, 20) + '...' : option}</span>
                  </label>
                ))}
                {options.length > 10 && (
                  <details className="more-options">
                    <summary>{options.length - 10} more options</summary>
                    {options.slice(10).map(option => (
                      <label key={option} className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={selectedValues.includes(option)}
                          onChange={() => handleMultiSelectChange(key, option)}
                        />
                        <span title={option}>{option.length > 20 ? option.substring(0, 20) + '...' : option}</span>
                      </label>
                    ))}
                  </details>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {activeFilterCount > 0 && (
        <button className="clear-filters" onClick={onClearFilters}>
          Clear All Filters
        </button>
      )}
    </div>
  );
};
