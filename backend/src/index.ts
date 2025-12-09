import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import scrapeRouter from './routes/scrape';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api', scrapeRouter);

// Serve static frontend files in production
const frontendPath = path.join(__dirname, '../../frontend/dist');

// Only serve static files if the dist folder exists
if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath));

  // Fallback to index.html for SPA routing
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

