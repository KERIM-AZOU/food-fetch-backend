const axios = require('axios');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

/**
 * Gemini transcription (via generateContent with audio input)
 * Latency: ~1-2s | Quality: good | Cost: varies
 * Supports multilingual audio, good for Arabic
 */
async function transcribe(audioBase64, mimeType = 'audio/webm', { languageHint = null } = {}) {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');

  const prompt = languageHint
    ? `Transcribe this audio. The language is likely ${languageHint}. Return ONLY the transcription text, nothing else.`
    : 'Transcribe this audio. Return ONLY the transcription text, nothing else. Also detect the language.';

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

    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log(`[TIMING] Gemini Transcription — ${Date.now() - start}ms`);

    return {
      text: text.trim(),
      language: languageHint || 'en'
    };
  } catch (err) {
    console.error('Gemini transcription error:', err.response?.status, err.response?.data ? JSON.stringify(err.response.data) : err.message);
    throw err;
  }
}

module.exports = { transcribe };
