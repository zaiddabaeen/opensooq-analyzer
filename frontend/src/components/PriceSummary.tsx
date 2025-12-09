import React from 'react';

interface PriceSummaryProps {
  minPrice: number | null;
  maxPrice: number | null;
  avgPrice: number | null;
  totalItems: number;
  filteredCount: number;
}

export const PriceSummary: React.FC<PriceSummaryProps> = ({
  minPrice,
  maxPrice,
  avgPrice,
  totalItems,
  filteredCount,
}) => {
  const formatPrice = (price: number | null) => {
    if (price === null) return 'N/A';
    return price.toLocaleString() + ' JOD';
  };

  return (
    <div className="price-summary">
      <div className="price-card min">
        <h3>Minimum Price</h3>
        <div className="value">{formatPrice(minPrice)}</div>
      </div>
      <div className="price-card avg">
        <h3>Average Price</h3>
        <div className="value">{formatPrice(avgPrice)}</div>
      </div>
      <div className="price-card max">
        <h3>Maximum Price</h3>
        <div className="value">{formatPrice(maxPrice)}</div>
      </div>
      <div className="price-card total">
        <h3>Items</h3>
        <div className="value">{filteredCount} / {totalItems}</div>
      </div>
    </div>
  );
};

