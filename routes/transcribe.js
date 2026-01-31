const express = require('express');
const axios = require('axios');
const FormData = require('form-data');
const router = express.Router();

const GROQ_API_KEY = process.env.GROQ_API_KEY;

// POST /api/transcribe
// Accepts audio as base64 in JSON body
router.post('/', async (req, res) => {
  const { audio, mimeType = 'audio/webm' } = req.body;

  if (!audio) {
    return res.status(400).json({ error: 'Audio data is required' });
  }

  try {
    // Convert base64 to buffer
    const audioBuffer = Buffer.from(audio, 'base64');

    // Determine file extension from mime type
    const ext = mimeType.includes('webm') ? 'webm' : mimeType.includes('mp3') ? 'mp3' : 'wav';

    // Create form data
    const form = new FormData();
    form.append('file', audioBuffer, {
      filename: `audio.${ext}`,
      contentType: mimeType,
    });
    form.append('model', 'whisper-large-v3');
    // Don't specify language - let Whisper auto-detect
    form.append('response_format', 'verbose_json'); // Get language detection

    // Call Groq Whisper API using axios
    const response = await axios.post(
      'https://api.groq.com/openai/v1/audio/transcriptions',
      form,
      {
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          ...form.getHeaders(),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );

    const detectedLanguage = response.data.language || 'en';
    console.log('Transcription result:', response.data.text, '| Language:', detectedLanguage);
    res.json({
      text: response.data.text || '',
      language: detectedLanguage
    });

  } catch (error) {
    console.error('Transcription error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Transcription failed',
      details: error.response?.data?.error?.message || error.message
    });
  }
});

module.exports = router;
