import axios, { AxiosError } from 'axios';
import * as cheerio from 'cheerio';
import { ScrapedItem, ScrapeResult } from '../types';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const CONCURRENT_REQUESTS = 5;
const INITIAL_DELAY = 300;
const MAX_RETRIES = 3;

async function fetchPageWithRetry(url: string, retries = MAX_RETRIES, delayMs = INITIAL_DELAY): Promise<string> {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
      },
      timeout: 30000,
    });
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError;
    const status = axiosError.response?.status;

    // Rate limited or server error - retry with backoff
    if (retries > 0 && (status === 429 || status === 503 || status === 502 || !status)) {
      const backoffDelay = delayMs * 2;
      console.log(`Request failed (${status || 'network error'}), retrying in ${backoffDelay}ms... (${retries} retries left)`);
      await delay(backoffDelay);
      return fetchPageWithRetry(url, retries - 1, backoffDelay);
    }
    throw error;
  }
}

function parsePrice(priceText: string): number | null {
  if (!priceText) return null;
  // Remove currency symbols, commas, and non-numeric chars except dots
  const cleaned = priceText.replace(/[^\d.]/g, '');
  const price = parseFloat(cleaned);
  return isNaN(price) ? null : price;
}

async function scrapeItemDetails(url: string): Promise<Partial<ScrapedItem>> {
  try {
    const html = await fetchPageWithRetry(url);
    const $ = cheerio.load(html);

    // Get price
    const priceElement = $('[data-id="post_price"]');
    const priceText = priceElement.text().trim();
    const price = parsePrice(priceText);

    // Get description
    const description = $('[data-id="postViewDescription"]').text().trim();

    // Get attributes from singeInfoField elements
    const attributes: Record<string, string | string[]> = {};

    $('[data-id^="singeInfoField_"]').each((_, element) => {
      const $el = $(element);
      const key = $el.find('p').first().text().trim();

      // Check if it's a full row (like Interior Options)
      if ($el.hasClass('fullRow') || $el.find('p.width-75').length > 0) {
        const valueText = $el.find('p.width-75').text().trim();
        if (valueText) {
          // Split by comma for array values
          const values = valueText.split(',').map(v => v.trim()).filter(v => v);
          attributes[key] = values.length > 1 ? values : valueText;
        }
      } else {
        // Regular key-value pair
        const valueEl = $el.find('a.bold, span.bold').first();
        const value = valueEl.text().trim();
        if (key && value) {
          attributes[key] = value;
        }
      }
    });

    // Also check for Interior Options in fullRow format
    $('li.fullRow').each((_, element) => {
      const $el = $(element);
      const key = $el.find('p').first().text().trim();
      const valueText = $el.find('p.width-75').text().trim();

      if (key && valueText && key !== 'VIN Number') {
        const values = valueText.split(',').map(v => v.trim()).filter(v => v);
        attributes[key] = values.length > 1 ? values : valueText;
      }
    });

    return { price, priceText, description, attributes };
  } catch (error) {
    console.error(`Error scraping item details from ${url}:`, error);
    return { price: null, priceText: '', description: '', attributes: {} };
  }
}

function getBaseUrl(url: string): string {
  const urlObj = new URL(url);
  return `${urlObj.protocol}//${urlObj.host}`;
}

interface ListingItem {
  link: string;
  title: string;
  image: string;
}

interface PageExtractionResult {
  listings: ListingItem[];
  hasRecommendedListings: boolean;
  nextPageUrl: string | null;
}

function extractListingsFromPage($: cheerio.CheerioAPI, baseUrl: string): PageExtractionResult {
  const listings: ListingItem[] = [];

  // Get the main content element
  let mainContent = $('#serpMainContent');
  if (mainContent.length === 0) {
    mainContent = $('[id*="serp"]').first();
  }

  // Check if page contains "Recommended Listings"
  const mainHtml = mainContent.html() || '';
  const hasRecommendedListings = mainHtml.includes('Recommended Listings');

  // Get content before "Recommended Listings" if present
  let filteredHtml = mainHtml;
  if (hasRecommendedListings) {
    const recommendedIndex = mainHtml.indexOf('Recommended Listings');
    filteredHtml = mainHtml.substring(0, recommendedIndex);
  }

  const $filtered = cheerio.load(filteredHtml);
  const itemElements = $filtered('.postListItemData');

  itemElements.each((_, element) => {
    const $item = $filtered(element);

    // Get the link
    let link = $item.find('a').first().attr('href') || '';
    if (!link) {
      link = $item.parent('a').attr('href') || '';
    }
    if (!link) {
      link = $item.closest('a').attr('href') || '';
    }

    // Make absolute URL
    if (link && !link.startsWith('http')) {
      link = baseUrl + link;
    }

    // Get title
    const title = $item.find('h2, h3, .postTitle').text().trim() ||
                  $item.text().trim().substring(0, 100);

    // Get image - find the closest parent that contains the image gallery
    const $postContainer = $item.closest('[class*="post"]').length > 0
      ? $item.closest('[class*="post"]')
      : $item.parent().parent();

    let image = $postContainer.find('div.image-gallery-image img').first().attr('src') || '';

    // If not found, try other common image selectors
    if (!image) {
      image = $postContainer.find('img').first().attr('src') || '';
    }

    if (link) {
      listings.push({ link, title, image });
    }
  });

  // Get next page URL from pagination
  let nextPageUrl: string | null = null;
  const pagination = $('#pagination');
  if (pagination.length > 0) {
    // Find the next page arrow link (data-id="nextPageArrow")
    const nextPageLink = pagination.find('[data-id="nextPageArrow"]');
    if (nextPageLink.length > 0 && !nextPageLink.hasClass('disabled')) {
      const href = nextPageLink.attr('href');
      if (href) {
        nextPageUrl = href.startsWith('http') ? href : baseUrl + href;
      }
    }
  }

  return { listings, hasRecommendedListings, nextPageUrl };
}

// Process items in batches with concurrency
async function processInBatches<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  concurrency: number,
  delayBetweenBatches: number
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    console.log(`Processing batch ${Math.floor(i / concurrency) + 1}/${Math.ceil(items.length / concurrency)}`);

    const batchResults = await Promise.all(
      batch.map((item, batchIndex) => processor(item, i + batchIndex))
    );

    results.push(...batchResults);

    // Add delay between batches to avoid rate limiting
    if (i + concurrency < items.length) {
      await delay(delayBetweenBatches);
    }
  }

  return results;
}

export async function scrapeOpenSooq(url: string): Promise<ScrapeResult> {
  console.log(`Scraping search results from: ${url}`);

  const baseUrl = getBaseUrl(url);
  const allListings: ListingItem[] = [];
  let currentPageUrl: string | null = url;
  let pageNumber = 1;
  const seenLinks = new Set<string>();

  // Fetch all pages until we hit "Recommended Listings" or run out of pages
  while (currentPageUrl) {
    console.log(`Fetching page ${pageNumber}: ${currentPageUrl}`);

    const html = await fetchPageWithRetry(currentPageUrl);
    const $ = cheerio.load(html);

    const { listings, hasRecommendedListings, nextPageUrl } = extractListingsFromPage($, baseUrl);

    // Add unique listings
    for (const listing of listings) {
      if (!seenLinks.has(listing.link)) {
        seenLinks.add(listing.link);
        allListings.push(listing);
      }
    }

    console.log(`Page ${pageNumber}: Found ${listings.length} items (total: ${allListings.length})`);

    // Stop if we hit "Recommended Listings"
    if (hasRecommendedListings) {
      console.log('Hit "Recommended Listings" - stopping pagination');
      break;
    }

    // Move to next page
    currentPageUrl = nextPageUrl;
    pageNumber++;

    // Add delay between page fetches
    if (currentPageUrl) {
      await delay(500);
    }
  }

  console.log(`Total listings found across ${pageNumber} page(s): ${allListings.length}`);

  // Process detail pages in parallel batches
  const items = await processInBatches(
    allListings,
    async (listing, index) => {
      console.log(`Scraping item ${index + 1}/${allListings.length}: ${listing.link}`);
      const details = await scrapeItemDetails(listing.link);

      return {
        link: listing.link,
        title: listing.title,
        image: listing.image,
        price: details.price ?? null,
        priceText: details.priceText || '',
        description: details.description || '',
        attributes: details.attributes || {},
      } as ScrapedItem;
    },
    CONCURRENT_REQUESTS,
    500 // delay between batches
  );

  // Filter out items without prices
  const itemsWithPrices = items.filter(item => item.price !== null && item.price > 0);
  console.log(`Filtered to ${itemsWithPrices.length} items with prices`);

  // Calculate price statistics
  const prices = itemsWithPrices.map(item => item.price).filter((p): p is number => p !== null);

  const minPrice = prices.length > 0 ? Math.min(...prices) : null;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : null;
  const avgPrice = prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null;

  return {
    items: itemsWithPrices,
    minPrice,
    maxPrice,
    avgPrice,
    totalItems: itemsWithPrices.length,
  };
}
