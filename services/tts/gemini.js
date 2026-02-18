const axios = require('axios');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const VOICES = [
  { id: 'Puck', name: 'Puck', category: 'gemini' },
  { id: 'Charon', name: 'Charon', category: 'gemini' },
  { id: 'Kore', name: 'Kore', category: 'gemini' },
  { id: 'Fenrir', name: 'Fenrir', category: 'gemini' },
  { id: 'Aoede', name: 'Aoede', category: 'gemini' },
];

const DEFAULT_VOICE = 'Kore';

/**
 * Gemini TTS (via generateContent with audio output)
 * Latency: ~1-2s | Quality: good | Cost: varies
 * Good multilingual support
 */
async function synthesize(text, { voice = DEFAULT_VOICE } = {}) {
  if (!GEMINI_API_KEY) return null;

  try {
    const start = Date.now();
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [{ text: `Read this aloud naturally: ${text}` }]
          }
        ],
        generationConfig: {
          response_modalities: ['AUDIO'],
          speech_config: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice }
            }
          }
        }
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000
      }
    );

    const audioData = response.data?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (!audioData) {
      console.error('Gemini TTS: no audio in response');
      return null;
    }

    console.log(`[TIMING] Gemini TTS — ${Date.now() - start}ms`);
    return {
      data: audioData.data,
      contentType: audioData.mimeType || 'audio/mp3'
    };
  } catch (err) {
    console.error('Gemini TTS error:', err.response?.status, err.response?.data ? JSON.stringify(err.response.data) : err.message);
    return null;
  }
}

module.exports = { synthesize, VOICES, DEFAULT_VOICE };
