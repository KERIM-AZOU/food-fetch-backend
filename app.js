require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' })); // Increased limit for audio data

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'food-finder' });
});

// Routes
const searchRouter = require('./routes/search');
const voiceRouter = require('./routes/voice');
const transcribeRouter = require('./routes/transcribe');
const ttsRouter = require('./routes/tts');
const translateRouter = require('./routes/translate');

app.use('/api/search', searchRouter);
app.use('/api/process-voice', voiceRouter);
app.use('/api/transcribe', transcribeRouter);
app.use('/api/tts', ttsRouter);
app.use('/api/translate', translateRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(port, () => {
  console.log(`Food Finder API running at http://localhost:${port}`);
  console.log(`Health check: http://localhost:${port}/health`);
});

module.exports = app;
