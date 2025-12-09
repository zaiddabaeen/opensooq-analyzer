import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { createProxyMiddleware } from 'http-proxy-middleware';
import scrapeRouter from './routes/scrape';

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || 'localhost';
const NODE_ENV = process.env.NODE_ENV || 'development';
const VITE_DEV_SERVER = process.env.VITE_DEV_SERVER || 'http://localhost:5173';

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api', scrapeRouter);

// Serve frontend
const frontendPath = path.join(__dirname, '../../frontend/dist');

if (NODE_ENV === 'production' && fs.existsSync(frontendPath)) {
  // Production: serve static files
  app.use(express.static(frontendPath));

  // Fallback to index.html for SPA routing
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
} else if (NODE_ENV === 'development') {
  // Development: proxy to Vite dev server
  app.use(
    '/',
    createProxyMiddleware({
      target: VITE_DEV_SERVER,
      changeOrigin: true,
      ws: true, // Enable WebSocket proxy for HMR
    })
  );
}

app.listen(Number(PORT), HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});

