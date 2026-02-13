const express = require('express');
const axios = require('axios');
const FormData = require('form-data');
const router = express.Router();

const GROQ_API_KEY = process.env.GROQ_API_KEY;
// const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Common Whisper hallucinations to filter out (happens with silence/noise)
const HALLUCINATION_PATTERNS = [
  /^i'?m ready to translate\.?$/i,
  /^thanks for watching\.?$/i,
  /^thank you for watching\.?$/i,
  /^subscribe\.?$/i,
  /^please subscribe\.?$/i,
  /^like and subscribe\.?$/i,
  /^see you (next time|later)\.?$/i,
  /^bye\.?$/i,
  /^goodbye\.?$/i,
  /^thank you\.?$/i,
  /^you$/i,
  /^\s*$/,  // Empty or whitespace only
];

function isHallucination(text) {
  if (!text) return true;
  const trimmed = text.trim();
  if (trimmed.length < 2) return true;
  return HALLUCINATION_PATTERNS.some(pattern => pattern.test(trimmed));
}

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
    form.append('model', 'whisper-large-v3-turbo');
    form.append('response_format', 'verbose_json');

    // Groq Whisper API (fast, ~200ms)
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

    // // OpenAI Whisper API (slower, ~2s)
    // const response = await axios.post(
    //   'https://api.openai.com/v1/audio/transcriptions',
    //   form,
    //   {
    //     headers: {
    //       'Authorization': `Bearer ${OPENAI_API_KEY}`,
    //       ...form.getHeaders(),
    //     },
    //     maxContentLength: Infinity,
    //     maxBodyLength: Infinity,
    //   }
    // );

    const detectedLanguage = response.data.language || 'en';
    const rawText = response.data.text || '';

    // Filter out Whisper hallucinations (common with silence/background noise)
    if (isHallucination(rawText)) {
      console.log('Filtered hallucination:', rawText);
      res.json({ text: '', language: detectedLanguage });
      return;
    }

    console.log('Transcription result:', rawText, '| Language:', detectedLanguage);
    res.json({
      text: rawText,
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
