export interface ScrapedItem {
  link: string;
  title: string;
  image: string;
  price: number | null;
  priceText: string;
  description: string;
  attributes: Record<string, string | string[]>;
}

export interface ScrapeResult {
  items: ScrapedItem[];
  minPrice: number | null;
  maxPrice: number | null;
  avgPrice: number | null;
  totalItems: number;
}

