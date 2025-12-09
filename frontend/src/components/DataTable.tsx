import React from 'react';
import { ScrapedItem } from '../types';

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
  if (items.length === 0) {
    return <div className="no-data">No items to display</div>;
  }

  // Collect all unique attribute keys across all items
  const allKeys = new Set<string>();
  items.forEach(item => {
    Object.keys(item.attributes).forEach(key => allKeys.add(key));
  });

  const sortedKeys = Array.from(allKeys).sort();

  // Move some important columns to the front
  const priorityKeys = ['Condition', 'Car Make', 'Model', 'Year', 'Kilometers', 'City'];
  const orderedKeys = [
    ...priorityKeys.filter(k => allKeys.has(k)),
    ...sortedKeys.filter(k => !priorityKeys.includes(k)),
  ];

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
              <th>Price</th>
              {orderedKeys.map(key => (
                <th key={key}>{key}</th>
              ))}
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
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
                      {isExcluded ? '➕' : isOutlier ? '📊' : '✓'}
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
