const express = require('express');
const axios = require('axios');
const router = express.Router();

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const DEFAULT_VOICE = 'coral';

// POST /api/tts
// Converts text to speech using Groq PlayAI TTS
router.post('/', async (req, res) => {
  const { text, voice = DEFAULT_VOICE, language = 'en' } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'Text is required' });
  }

  if (!GROQ_API_KEY) {
    return res.status(500).json({
      error: 'TTS not available',
      setup: 'Set GROQ_API_KEY in .env'
    });
  }

  try {
    // Groq PlayAI TTS (fast)
    // const response = await axios.post(
    //   'https://api.groq.com/openai/v1/audio/speech',
    //   {
    //     model: 'playai-tts',
    //     input: text,
    //     voice: voice,
    //     response_format: 'wav'
    //   },
    //   {
    //     headers: {
    //       'Authorization': `Bearer ${GROQ_API_KEY}`,
    //       'Content-Type': 'application/json',
    //     },
    //     responseType: 'arraybuffer',
    //   }
    // );

    // const audioBase64 = Buffer.from(response.data).toString('base64');

    // res.json({
    //   audio: audioBase64,
    //   contentType: 'audio/wav'
    // });

    // // OpenAI TTS (slower, ~2s)
    const response = await axios.post(
      'https://api.openai.com/v1/audio/speech',
      {
        model: 'tts-1-hd',
        input: text,
        voice: voice,
        speed: 0.9,
        response_format: 'mp3'
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        responseType: 'arraybuffer',
      }
    );
    
    const audioBase64 = Buffer.from(response.data).toString('base64');
    
    res.json({
      audio: audioBase64,
      contentType: 'audio/mpeg'
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

// GET /api/tts/voices - List available voices
router.get('/voices', (req, res) => {
  // // Groq PlayAI voices
  // const voices = [
  //   { id: 'Arista-PlayAI', name: 'Arista', category: 'groq-playai' },
  //   { id: 'Atlas-PlayAI', name: 'Atlas', category: 'groq-playai' },
  //   { id: 'Celeste-PlayAI', name: 'Celeste', category: 'groq-playai' },
  //   { id: 'Cheyenne-PlayAI', name: 'Cheyenne', category: 'groq-playai' },
  //   { id: 'Fritz-PlayAI', name: 'Fritz', category: 'groq-playai' },
  //   { id: 'Gail-PlayAI', name: 'Gail', category: 'groq-playai' },
  //   { id: 'Indigo-PlayAI', name: 'Indigo', category: 'groq-playai' },
  //   { id: 'Jennifer-PlayAI', name: 'Jennifer', category: 'groq-playai' },
  //   { id: 'Nova-PlayAI', name: 'Nova', category: 'groq-playai' },
  //   { id: 'Quinn-PlayAI', name: 'Quinn', category: 'groq-playai' },
  //   { id: 'Ruby-PlayAI', name: 'Ruby', category: 'groq-playai' },
  // ];

  // OpenAI voices
  const voices = [
    { id: 'nova', name: 'Nova', category: 'openai' },
    { id: 'alloy', name: 'Alloy', category: 'openai' },
    { id: 'ash', name: 'Ash', category: 'openai' },
    { id: 'coral', name: 'Coral', category: 'openai' },
    { id: 'echo', name: 'Echo', category: 'openai' },
    { id: 'fable', name: 'Fable', category: 'openai' },
    { id: 'onyx', name: 'Onyx', category: 'openai' },
    { id: 'sage', name: 'Sage', category: 'openai' },
    { id: 'shimmer', name: 'Shimmer', category: 'openai' },
  ];

  res.json(voices);
});

module.exports = router;
