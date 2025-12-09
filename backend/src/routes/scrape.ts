import { Router, Request, Response } from 'express';
import { scrapeOpenSooq } from '../services/scraper';

const router = Router();

router.post('/scrape', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Validate it's an OpenSooq URL
    if (!url.includes('opensooq.com')) {
      return res.status(400).json({ error: 'Please provide a valid OpenSooq URL' });
    }

    console.log(`Received scrape request for: ${url}`);

    const result = await scrapeOpenSooq(url);

    res.json(result);
  } catch (error) {
    console.error('Scrape error:', error);
    res.status(500).json({
      error: 'Failed to scrape the URL',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;

