const axios = require('axios');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

/**
 * Gemini transcription (via generateContent with audio input)
 * Latency: ~1-2s | Quality: good | Cost: varies
 * Supports multilingual audio, good for Arabic
 */
async function transcribe(audioBase64, mimeType = 'audio/webm') {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');

  const prompt = 'Transcribe this audio. Return JSON: {"text":"transcription","language":"ISO 639-1 code"}. Nothing else.';

  try {
    const start = Date.now();
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType,
                  data: audioBase64
                }
              }
            ]
          }
        ]
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000
      }
    );

    const raw = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log(`[TIMING] Gemini Transcription — ${Date.now() - start}ms`);

    // Try to parse JSON response, fallback to raw text
    try {
      const parsed = JSON.parse(raw);
      return { text: parsed.text || raw.trim(), language: parsed.language || 'en' };
    } catch {
      return { text: raw.trim(), language: 'en' };
    }
  } catch (err) {
    console.error('Gemini transcription error:', err.response?.status, err.response?.data ? JSON.stringify(err.response.data) : err.message);
    throw err;
  }
}

module.exports = { transcribe };
