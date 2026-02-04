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
app.use(express.static(publicDir, { index: 'html/quiz_assessment.html' }));

app.get('/api/questions', async (req, res) => {
  if (API_KEY) {
    const key = req.get('x-api-key') || req.query.api_key;
    if (key !== API_KEY) return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const file = path.join(__dirname, 'questions', 'questions.json');
    const data = await fs.readFile(file, 'utf8');
    res.type('application/json').send(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read questions' });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

module.exports = app;
