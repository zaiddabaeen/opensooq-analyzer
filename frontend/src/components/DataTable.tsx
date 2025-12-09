import React, { useState, useMemo } from 'react';
import { ScrapedItem } from '../types';

type SortDirection = 'asc' | 'desc' | null;
type SortConfig = { key: string; direction: SortDirection };

interface DataTableProps {
  items: ScrapedItem[];
  onExportCSV: () => void;
  excludedItems: Set<string>;
  outlierItems: Set<string>;
  onToggleExclude: (link: string) => void;
}

export const DataTable: React.FC<DataTableProps> = ({
  items,
  onExportCSV,
  excludedItems,
  outlierItems,
  onToggleExclude,
}) => {
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: '', direction: null });

  // Collect all unique attribute keys across all items
  const allKeys = useMemo(() => {
    const keys = new Set<string>();
    items.forEach(item => {
      Object.keys(item.attributes).forEach(key => keys.add(key));
    });
    return keys;
  }, [items]);

  const sortedKeys = useMemo(() => Array.from(allKeys).sort(), [allKeys]);

  // Move some important columns to the front
  const priorityKeys = ['Condition', 'Car Make', 'Model', 'Year', 'Kilometers', 'City'];
  const orderedKeys = useMemo(() => [
    ...priorityKeys.filter(k => allKeys.has(k)),
    ...sortedKeys.filter(k => !priorityKeys.includes(k)),
  ], [allKeys, sortedKeys]);

  // Sort items
  const sortedItems = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) return items;

    return [...items].sort((a, b) => {
      let aVal: string | number | null = null;
      let bVal: string | number | null = null;

      if (sortConfig.key === '_price') {
        aVal = a.price;
        bVal = b.price;
      } else {
        const aAttr = a.attributes[sortConfig.key];
        const bAttr = b.attributes[sortConfig.key];
        aVal = Array.isArray(aAttr) ? aAttr.join(', ') : aAttr || '';
        bVal = Array.isArray(bAttr) ? bAttr.join(', ') : bAttr || '';
      }

      // Handle nulls
      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;

      // Compare
      let comparison = 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      } else {
        comparison = String(aVal).localeCompare(String(bVal));
      }

      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [items, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig(prev => {
      if (prev.key !== key) {
        return { key, direction: 'asc' };
      }
      if (prev.direction === 'asc') {
        return { key, direction: 'desc' };
      }
      return { key: '', direction: null };
    });
  };

  const getSortIndicator = (key: string) => {
    if (sortConfig.key !== key) return '↕';
    if (sortConfig.direction === 'asc') return '↑';
    if (sortConfig.direction === 'desc') return '↓';
    return '↕';
  };

  if (items.length === 0) {
    return <div className="no-data">No items to display</div>;
  }

  const formatValue = (value: string | string[] | undefined) => {
    if (!value) return '-';
    if (Array.isArray(value)) {
      return (
        <span className="array-value" title={value.join(', ')}>
          {value.join(', ')}
        </span>
      );
    }
    return value;
  };

  const getRowClassName = (item: ScrapedItem) => {
    const isExcluded = excludedItems.has(item.link);
    const isOutlier = outlierItems.has(item.link);
    const classes: string[] = [];
    if (isExcluded) classes.push('excluded-row');
    if (isOutlier && !isExcluded) classes.push('outlier-row');
    return classes.join(' ');
  };

  const includedCount = items.filter(
    item => !excludedItems.has(item.link) && !outlierItems.has(item.link)
  ).length;

  return (
    <div className="data-table-container">
      <div className="table-header">
        <h2>Results ({includedCount} included / {items.length} total)</h2>
        <button className="export-btn" onClick={onExportCSV}>
          📥 Export to CSV
        </button>
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Include</th>
              <th>Image</th>
              <th>Link</th>
              <th className="sortable" onClick={() => handleSort('_price')}>
                Price <span className="sort-indicator">{getSortIndicator('_price')}</span>
              </th>
              {orderedKeys.map(key => (
                <th key={key} className="sortable" onClick={() => handleSort(key)}>
                  {key} <span className="sort-indicator">{getSortIndicator(key)}</span>
                </th>
              ))}
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {sortedItems.map((item, index) => {
              const isExcluded = excludedItems.has(item.link);
              const isOutlier = outlierItems.has(item.link);

              return (
                <tr key={index} className={getRowClassName(item)}>
                  <td className="exclude-cell">
                    <button
                      className={`exclude-btn ${isExcluded ? 'excluded' : isOutlier ? 'outlier' : 'included'}`}
                      onClick={() => onToggleExclude(item.link)}
                      title={isExcluded ? 'Click to include' : isOutlier ? 'Auto-excluded outlier (click to include)' : 'Click to exclude'}
                    >
                      {isExcluded ? '➕' : isOutlier ? '➕' : '✓'}
                    </button>
                  </td>
                  <td className="image-cell">
                    {item.image ? (
                      <img src={item.image} alt={item.title} className="thumbnail" />
                    ) : (
                      <span className="no-image">No image</span>
                    )}
                  </td>
                  <td>
                    <a href={item.link} target="_blank" rel="noopener noreferrer">
                      View Post
                    </a>
                  </td>
                  <td>{item.priceText || '-'}</td>
                  {orderedKeys.map(key => (
                    <td key={key}>{formatValue(item.attributes[key])}</td>
                  ))}
                  <td className="description-cell" title={item.description}>
                    {item.description || '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
