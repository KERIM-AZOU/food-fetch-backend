const express = require('express');
const router = express.Router();

// ── TTS provider: swap import to change provider ──
// const ttsProvider = require('../services/tts/groq');
const ttsProvider = require('../services/tts/gemini');
// const ttsProvider = require('../services/tts/elevenlabs');
// const ttsProvider = require('../services/tts/openai');

// POST /api/tts
router.post('/', async (req, res) => {
  const { text, voice = ttsProvider.DEFAULT_VOICE, language = 'en' } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'Text is required' });
  }

  try {
    const result = await ttsProvider.synthesize(text, { voice });

    if (!result) {
      return res.status(500).json({
        error: 'TTS not available',
        setup: 'Check your API key in .env'
      });
    }

    res.json({
      audio: result.data,
      contentType: result.contentType
    });

  } catch (error) {
    console.error('TTS error:', error.response?.data || error.message);

    if (error.response?.status === 401) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
    if (error.response?.status === 429) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }

    res.status(500).json({
      error: 'Text-to-speech failed',
      details: error.response?.data?.error?.message || error.message
    });
  }
});

// GET /api/tts/voices - List available voices for current provider
router.get('/voices', (req, res) => {
  res.json(ttsProvider.VOICES);
});

module.exports = router;
