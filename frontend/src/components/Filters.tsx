import React from 'react';
import { ScrapedItem } from '../types';

interface FiltersProps {
  items: ScrapedItem[];
  filters: Record<string, string[]>;
  onFilterChange: (key: string, values: string[]) => void;
  onClearFilters: () => void;
}

export const Filters: React.FC<FiltersProps> = ({
  items,
  filters,
  onFilterChange,
  onClearFilters,
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

        {sortedKeys.map(key => {
          const options = Array.from(attributeOptions[key]).sort();
          const selectedValues = filters[key] || [];

          return (
            <div key={key} className="filter-item">
              <label>{key}</label>
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
