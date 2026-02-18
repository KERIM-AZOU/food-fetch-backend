const axios = require('axios');

const GROQ_API_KEY = process.env.GROQ_API_KEY;

const VOICES = [
  { id: 'Arista-PlayAI', name: 'Arista', category: 'groq-playai' },
  { id: 'Atlas-PlayAI', name: 'Atlas', category: 'groq-playai' },
  { id: 'Celeste-PlayAI', name: 'Celeste', category: 'groq-playai' },
  { id: 'Cheyenne-PlayAI', name: 'Cheyenne', category: 'groq-playai' },
  { id: 'Fritz-PlayAI', name: 'Fritz', category: 'groq-playai' },
  { id: 'Gail-PlayAI', name: 'Gail', category: 'groq-playai' },
  { id: 'Indigo-PlayAI', name: 'Indigo', category: 'groq-playai' },
  { id: 'Jennifer-PlayAI', name: 'Jennifer', category: 'groq-playai' },
  { id: 'Nova-PlayAI', name: 'Nova', category: 'groq-playai' },
  { id: 'Quinn-PlayAI', name: 'Quinn', category: 'groq-playai' },
  { id: 'Ruby-PlayAI', name: 'Ruby', category: 'groq-playai' },
];

const DEFAULT_VOICE = 'Arista-PlayAI';

/**
 * Groq PlayAI TTS
 * Latency: ~500ms | Quality: good | Cost: free tier available
 * Fast but limited voice options
 */
async function synthesize(text, { voice = DEFAULT_VOICE } = {}) {
  if (!GROQ_API_KEY) return null;

  try {
    const start = Date.now();
    const response = await axios.post(
      'https://api.groq.com/openai/v1/audio/speech',
      {
        model: 'playai-tts',
        input: text,
        voice,
        response_format: 'wav'
      },
      {
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        responseType: 'arraybuffer',
        timeout: 15000
      }
    );
    console.log(`[TIMING] Groq TTS — ${Date.now() - start}ms`);
    return {
      data: Buffer.from(response.data).toString('base64'),
      contentType: 'audio/wav'
    };
  } catch (err) {
    console.error('Groq TTS error:', err.response?.status, err.response?.data ? Buffer.isBuffer(err.response.data) ? err.response.data.toString() : JSON.stringify(err.response.data) : err.message);
    return null;
  }
}

module.exports = { synthesize, VOICES, DEFAULT_VOICE };
