const express = require('express');
const axios = require('axios');
const router = express.Router();

// ElevenLabs API - Get free key at https://elevenlabs.io
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

// Default voice ID (Rachel - natural female voice)
// Other free voices: 21m00Tcm4TlvDq8ikWAM (Rachel), EXAVITQu4vr4xnSDxMaL (Bella)
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';

// POST /api/tts
// Converts text to speech using ElevenLabs
router.post('/', async (req, res) => {
  const { text, voiceId = DEFAULT_VOICE_ID } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'Text is required' });
  }

  if (!ELEVENLABS_API_KEY) {
    return res.status(500).json({
      error: 'ElevenLabs API key not configured',
      setup: 'Set ELEVENLABS_API_KEY environment variable. Get free key at https://elevenlabs.io'
    });
  }

  try {
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        text,
        model_id: 'eleven_multilingual_v2', // Supports 29 languages
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        }
      },
      {
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        responseType: 'arraybuffer',
      }
    );

    // Convert to base64 for easy frontend playback
    const audioBase64 = Buffer.from(response.data).toString('base64');

    res.json({
      audio: audioBase64,
      contentType: 'audio/mpeg'
    });

  } catch (error) {
    console.error('TTS error:', error.response?.data || error.message);

    // Check for quota exceeded
    if (error.response?.status === 401) {
      return res.status(401).json({ error: 'Invalid ElevenLabs API key' });
    }
    if (error.response?.status === 429) {
      return res.status(429).json({ error: 'ElevenLabs quota exceeded. Free tier: 10k chars/month' });
    }

    res.status(500).json({
      error: 'Text-to-speech failed',
      details: error.response?.data?.detail || error.message
    });
  }
});

// GET /api/tts/voices - List available voices
router.get('/voices', async (req, res) => {
  if (!ELEVENLABS_API_KEY) {
    return res.status(500).json({ error: 'ElevenLabs API key not configured' });
  }

  try {
    const response = await axios.get('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': ELEVENLABS_API_KEY }
    });

    res.json(response.data.voices.map(v => ({
      id: v.voice_id,
      name: v.name,
      category: v.category
    })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch voices' });
  }
});

module.exports = router;
