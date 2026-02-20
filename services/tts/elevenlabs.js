const axios = require('axios');

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

const VOICES = [
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', category: 'elevenlabs' },
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', category: 'elevenlabs' },
  { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', category: 'elevenlabs' },
  { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli', category: 'elevenlabs' },
  { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', category: 'elevenlabs' },
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', category: 'elevenlabs' },
];

const DEFAULT_VOICE = 'EXAVITQu4vr4xnSDxMaL'; // Bella

/**
 * ElevenLabs TTS (eleven_multilingual_v2)
 * Latency: ~1-2s | Quality: excellent | Cost: ~$0.30/1K chars
 * Best multilingual quality, especially Arabic
 */
async function synthesize(text, { voice = DEFAULT_VOICE, stability = 0.75, similarity_boost = 0.75, style = 0 } = {}) {
  if (!ELEVENLABS_API_KEY) return null;

  try {
    const start = Date.now();
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice}`,
      {
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability, similarity_boost, style }
      },
      {
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        responseType: 'arraybuffer',
        timeout: 15000
      }
    );
    console.log(`[TIMING] ElevenLabs TTS — ${Date.now() - start}ms`);
    return {
      data: Buffer.from(response.data).toString('base64'),
      contentType: 'audio/mpeg'
    };
  } catch (err) {
    console.error('ElevenLabs TTS error:', err.response?.status, err.response?.data ? JSON.stringify(err.response.data) : err.message);
    return null;
  }
}

module.exports = { synthesize, VOICES, DEFAULT_VOICE };
