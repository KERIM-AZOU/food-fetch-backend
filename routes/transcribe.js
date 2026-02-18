const express = require('express');
const router = express.Router();

// ── Transcription provider: swap import to change provider ──
const transcriptionProvider = require('../services/transcription/groq');
// const transcriptionProvider = require('../services/transcription/openai');
// const transcriptionProvider = require('../services/transcription/gemini');

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
  /^\s*$/,
];

function isHallucination(text) {
  if (!text) return true;
  const trimmed = text.trim();
  if (trimmed.length < 2) return true;
  return HALLUCINATION_PATTERNS.some(pattern => pattern.test(trimmed));
}

// POST /api/transcribe
router.post('/', async (req, res) => {
  const { audio, mimeType = 'audio/webm' } = req.body;

  if (!audio) {
    return res.status(400).json({ error: 'Audio data is required' });
  }

  try {
    const result = await transcriptionProvider.transcribe(audio, mimeType);

    const rawText = result.text || '';
    const detectedLanguage = result.language || 'en';

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
