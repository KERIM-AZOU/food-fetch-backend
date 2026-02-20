const axios = require('axios');
const FormData = require('form-data');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Whisper returns full names like "arabic", we need ISO codes
// Languages close to Arabic (Persian, Urdu, etc.) map to "ar"
const LANGUAGE_TO_CODE = {
  arabic: 'ar', persian: 'ar', urdu: 'ar', pashto: 'ar', sindhi: 'ar', kurdish: 'ar',
  english: 'en', french: 'fr', spanish: 'es', german: 'de',
  chinese: 'zh', hindi: 'hi', portuguese: 'pt', russian: 'ru',
  japanese: 'ja', korean: 'ko', italian: 'it', turkish: 'tr',
  dutch: 'nl', polish: 'pl', swedish: 'sv', norwegian: 'no',
  danish: 'da', finnish: 'fi', greek: 'el', hebrew: 'he',
  thai: 'th', vietnamese: 'vi', indonesian: 'id', malay: 'ms',
};

// ISO code mapping for close-to-Arabic languages
const CODE_TO_NORMALIZED = {
  fa: 'ar', ur: 'ar', ps: 'ar', sd: 'ar', ku: 'ar',
};

function normalizeLanguage(lang) {
  if (!lang) return 'en';
  const lower = lang.toLowerCase();
  // Full name like "arabic"
  if (LANGUAGE_TO_CODE[lower]) return LANGUAGE_TO_CODE[lower];
  // ISO code — check if it maps to Arabic
  if (lower.length <= 3) return CODE_TO_NORMALIZED[lower] || lower;
  return 'en';
}

/**
 * OpenAI Whisper transcription (whisper-1)
 * Latency: ~2s | Quality: excellent | Cost: $0.006/min
 */
async function transcribe(audioBase64, mimeType = 'audio/webm', languageHint) {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');

  const audioBuffer = Buffer.from(audioBase64, 'base64');
  const ext = mimeType.includes('webm') ? 'webm' : mimeType.includes('mp3') ? 'mp3' : 'wav';

  const form = new FormData();
  form.append('file', audioBuffer, { filename: `audio.${ext}`, contentType: mimeType });
  form.append('model', 'whisper-1');
  form.append('response_format', 'verbose_json');
  // Use frontend language as hint for better transcription accuracy
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
    language: normalizeLanguage(response.data.language)
  };
}

module.exports = { transcribe };
