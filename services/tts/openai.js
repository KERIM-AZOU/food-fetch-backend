const axios = require('axios');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const VOICES = [
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

const DEFAULT_VOICE = 'nova';

/**
 * OpenAI TTS (tts-1)
 * Latency: ~2s | Quality: good | Cost: $15/1M chars
 * Supports multilingual text input
 */
async function synthesize(text, { voice = DEFAULT_VOICE, model = 'tts-1', speed = 1.0 } = {}) {
  if (!OPENAI_API_KEY) return null;

  try {
    const start = Date.now();
    const response = await axios.post(
      'https://api.openai.com/v1/audio/speech',
      {
        model,
        input: text,
        voice,
        speed,
        response_format: 'mp3'
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        responseType: 'arraybuffer',
        timeout: 15000
      }
    );
    console.log(`[TIMING] OpenAI TTS — ${Date.now() - start}ms`);
    return {
      data: Buffer.from(response.data).toString('base64'),
      contentType: 'audio/mpeg'
    };
  } catch (err) {
    console.error('OpenAI TTS error:', err.response?.status, err.response?.data ? JSON.stringify(err.response.data) : err.message);
    return null;
  }
}

module.exports = { synthesize, VOICES, DEFAULT_VOICE };
