const axios = require('axios');
const FormData = require('form-data');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * OpenAI Whisper transcription (whisper-1)
 * Latency: ~2s | Quality: excellent | Cost: $0.006/min
 * Reliable language detection, good accuracy
 */
async function transcribe(audioBase64, mimeType = 'audio/webm', { languageHint = null } = {}) {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');

  const audioBuffer = Buffer.from(audioBase64, 'base64');
  const ext = mimeType.includes('webm') ? 'webm' : mimeType.includes('mp3') ? 'mp3' : 'wav';

  const form = new FormData();
  form.append('file', audioBuffer, { filename: `audio.${ext}`, contentType: mimeType });
  form.append('model', 'whisper-1');
  form.append('response_format', 'verbose_json');
  if (languageHint) {
    form.append('language', languageHint);
  }

  const start = Date.now();
  const response = await axios.post(
    'https://api.openai.com/v1/audio/transcriptions',
    form,
    {
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, ...form.getHeaders() },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    }
  );
  console.log(`[TIMING] OpenAI Whisper — ${Date.now() - start}ms`);

  return {
    text: response.data.text || '',
    language: response.data.language || 'en'
  };
}

module.exports = { transcribe };
