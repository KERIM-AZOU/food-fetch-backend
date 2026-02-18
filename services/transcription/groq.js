const axios = require('axios');
const FormData = require('form-data');

const GROQ_API_KEY = process.env.GROQ_API_KEY;

// Map misdetected languages to the correct one (Whisper quirks)
const LANG_MAP = {
  ar: 'ar', fa: 'ar', ur: 'ar', ps: 'ar', sd: 'ar', ku: 'ar',
  en: 'en',
  fr: 'fr',
  es: 'es',
  de: 'de', it: 'it', pt: 'pt', ru: 'ru', zh: 'zh', ja: 'ja', ko: 'ko',
  tr: 'tr', nl: 'nl', hi: 'hi', id: 'id', ms: 'ms', th: 'th',
};

function normalizeLanguage(detected) {
  return LANG_MAP[detected] || 'en';
}

/**
 * Groq Whisper transcription (whisper-large-v3-turbo)
 * Latency: ~200ms | Quality: excellent | Cost: free tier available
 * 10x faster than OpenAI, same Whisper model family
 */
async function transcribe(audioBase64, mimeType = 'audio/webm', { languageHint = null } = {}) {
  if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY not configured');

  const audioBuffer = Buffer.from(audioBase64, 'base64');
  const ext = mimeType.includes('webm') ? 'webm' : mimeType.includes('mp3') ? 'mp3' : 'wav';

  const form = new FormData();
  form.append('file', audioBuffer, { filename: `audio.${ext}`, contentType: mimeType });
  form.append('model', 'whisper-large-v3-turbo');
  form.append('response_format', 'verbose_json');
  if (languageHint) {
    form.append('language', languageHint);
  }

  const start = Date.now();
  const response = await axios.post(
    'https://api.groq.com/openai/v1/audio/transcriptions',
    form,
    {
      headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, ...form.getHeaders() },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    }
  );
  console.log(`[TIMING] Groq Whisper — ${Date.now() - start}ms`);

  const rawLang = response.data.language || 'en';
  const language = normalizeLanguage(rawLang);
  if (rawLang !== language) {
    console.log(`[LANG] Corrected "${rawLang}" → "${language}"`);
  }

  return {
    text: response.data.text || '',
    language
  };
}

module.exports = { transcribe };
