import React from 'react';
import { ScrapedItem } from '../types';

interface PriceChartProps {
  items: ScrapedItem[];
  filterKey: string;
  excludedItems: Set<string>;
  outlierItems: Set<string>;
  onClose: () => void;
}

interface ChartData {
  label: string;
  avgPrice: number;
  count: number;
}

export const PriceChart: React.FC<PriceChartProps> = ({
  items,
  filterKey,
  excludedItems,
  outlierItems,
  onClose,
}) => {
  // Calculate average price for each value of the filter
  const chartData: ChartData[] = React.useMemo(() => {
    const valueGroups: Record<string, number[]> = {};

    items.forEach(item => {
      // Skip excluded and outlier items
      if (excludedItems.has(item.link) || outlierItems.has(item.link)) return;
      if (item.price === null || item.price <= 0) return;

      const attrValue = item.attributes[filterKey];
      if (!attrValue) return;

      const values = Array.isArray(attrValue) ? attrValue : [attrValue];
      values.forEach(val => {
        if (!valueGroups[val]) {
          valueGroups[val] = [];
        }
        valueGroups[val].push(item.price as number);
      });
    });

    // Calculate averages and sort by average price
    return Object.entries(valueGroups)
      .map(([label, prices]) => ({
        label,
        avgPrice: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
        count: prices.length,
      }))
      .sort((a, b) => b.avgPrice - a.avgPrice);
  }, [items, filterKey, excludedItems, outlierItems]);

  if (chartData.length === 0) {
    return (
      <div className="chart-modal">
        <div className="chart-container">
          <div className="chart-header">
            <h3>{filterKey} vs Average Price</h3>
            <button className="close-btn" onClick={onClose}>✕</button>
          </div>
          <p className="no-chart-data">No data available for this filter</p>
        </div>
      </div>
    );
  }

  const maxPrice = Math.max(...chartData.map(d => d.avgPrice));

  return (
    <div className="chart-modal" onClick={onClose}>
      <div className="chart-container" onClick={e => e.stopPropagation()}>
        <div className="chart-header">
          <h3>{filterKey} vs Average Price</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="chart-body">
          {chartData.map((data, index) => (
            <div key={index} className="chart-row">
              <div className="chart-label" title={data.label}>
                {data.label.length > 20 ? data.label.substring(0, 20) + '...' : data.label}
                <span className="chart-count">({data.count})</span>
              </div>
              <div className="chart-bar-container">
                <div
                  className="chart-bar"
                  style={{ width: `${(data.avgPrice / maxPrice) * 100}%` }}
                />
                <span className="chart-value">{data.avgPrice.toLocaleString()} JOD</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

