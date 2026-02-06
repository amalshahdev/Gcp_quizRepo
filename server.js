const path = require('path');
const fs = require('fs').promises;
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || '';

const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';

app.use(helmet());
app.use(compression());
app.use(morgan('combined'));
app.use(express.json());
app.use(cors({ origin: allowedOrigin, optionsSuccessStatus: 200 }));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Too many requests' }
});
app.use('/api/', limiter);

// Serve static site from project root (serves html/, css/, js/, questions/)
const publicDir = path.join(__dirname);
app.use(express.static(publicDir, { index: 'html/index.html' }));

app.get('/api/questions', async (req, res) => {
  if (API_KEY) {
    const key = req.get('x-api-key') || req.query.api_key;
    if (key !== API_KEY) return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const fileParam = req.query.file || 'questions.json';
    // sanitize basename to avoid path traversal
    const base = path.basename(fileParam);
    const questionsDir = path.join(__dirname, 'questions');
    const file = path.join(questionsDir, base);
    const resolved = path.resolve(file);
    if (!resolved.startsWith(path.resolve(questionsDir))) return res.status(400).json({ error: 'Invalid file' });
    const data = await fs.readFile(resolved, 'utf8');
    res.type('application/json').send(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read questions' });
  }
});

// List available exam JSON files in the questions directory
app.get('/api/exams', async (req, res) => {
  try {
    const questionsDir = path.join(__dirname, 'questions');
    const files = await fs.readdir(questionsDir);
    const jsonFiles = files.filter(f => f.toLowerCase().endsWith('.json'));
    const list = jsonFiles.map(f => ({ file: f, name: f.replace(/\.json$/i, '') }));
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list exams' });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

module.exports = app;
