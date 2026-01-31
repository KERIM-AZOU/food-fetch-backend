const express = require('express');
const axios = require('axios');
const router = express.Router();

const GROQ_API_KEY = process.env.GROQ_API_KEY;

// Language name mapping
const LANGUAGE_NAMES = {
  en: 'English', ar: 'Arabic', fr: 'French', es: 'Spanish', de: 'German',
  it: 'Italian', pt: 'Portuguese', ru: 'Russian', zh: 'Chinese', ja: 'Japanese',
  ko: 'Korean', hi: 'Hindi', tr: 'Turkish', nl: 'Dutch', pl: 'Polish',
  sv: 'Swedish', da: 'Danish', no: 'Norwegian', fi: 'Finnish', cs: 'Czech'
};

// Common phrases in different languages (pre-translated for speed)
const PHRASES = {
  greeting: {
    en: 'What would you like to order today?',
    ar: 'ماذا تريد أن تطلب اليوم؟',
    fr: 'Que souhaitez-vous commander aujourd\'hui?',
    es: '¿Qué te gustaría pedir hoy?',
    de: 'Was möchten Sie heute bestellen?',
    it: 'Cosa vorresti ordinare oggi?',
    pt: 'O que você gostaria de pedir hoje?',
    ru: 'Что бы вы хотели заказать сегодня?',
    zh: '你今天想点什么？',
    ja: '今日は何を注文しますか？',
    ko: '오늘 무엇을 주문하시겠습니까?',
    hi: 'आज आप क्या ऑर्डर करना चाहेंगे?',
    tr: 'Bugün ne sipariş etmek istersiniz?'
  },
  no_results: {
    en: 'No results found. Try something else!',
    ar: 'لم يتم العثور على نتائج. جرب شيئًا آخر!',
    fr: 'Aucun résultat trouvé. Essayez autre chose!',
    es: 'No se encontraron resultados. ¡Prueba otra cosa!',
    de: 'Keine Ergebnisse gefunden. Versuchen Sie etwas anderes!',
    it: 'Nessun risultato trovato. Prova qualcos\'altro!',
    pt: 'Nenhum resultado encontrado. Tente outra coisa!',
    ru: 'Ничего не найдено. Попробуйте что-то другое!',
    zh: '没有找到结果。试试别的吧！',
    ja: '結果が見つかりませんでした。他のものを試してください！',
    ko: '결과를 찾을 수 없습니다. 다른 것을 시도해 보세요!',
    hi: 'कोई परिणाम नहीं मिला। कुछ और आज़माएं!',
    tr: 'Sonuç bulunamadı. Başka bir şey deneyin!'
  }
};

// Translate a phrase using Groq
async function translatePhrase(text, targetLang) {
  if (targetLang === 'en') return text;

  try {
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: `Translate to ${LANGUAGE_NAMES[targetLang] || targetLang}. Return ONLY the translation, nothing else. Keep numbers as-is.`
          },
          { role: 'user', content: text }
        ],
        temperature: 0.1,
        max_tokens: 150
      },
      {
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.choices[0]?.message?.content?.trim() || text;
  } catch (error) {
    console.error('Translation error:', error.message);
    return text;
  }
}

// POST /api/translate
router.post('/', async (req, res) => {
  const { text, language = 'en', type } = req.body;

  if (!text && !type) {
    return res.status(400).json({ error: 'Text or type is required' });
  }

  try {
    let translated;

    // Use pre-translated phrases if available
    if (type && PHRASES[type] && PHRASES[type][language]) {
      translated = PHRASES[type][language];
    } else if (type && PHRASES[type]) {
      // Translate the English version
      translated = await translatePhrase(PHRASES[type].en, language);
    } else if (text) {
      translated = await translatePhrase(text, language);
    } else {
      translated = text;
    }

    res.json({ translated, language });
  } catch (error) {
    console.error('Translation route error:', error);
    res.status(500).json({ error: 'Translation failed' });
  }
});

// GET /api/translate/phrases/:language
// Get all pre-translated phrases for a language
router.get('/phrases/:language', (req, res) => {
  const { language } = req.params;

  const phrases = {};
  for (const [key, translations] of Object.entries(PHRASES)) {
    phrases[key] = translations[language] || translations.en;
  }

  res.json({ language, phrases });
});

// GET /api/translate/languages
// List supported languages
router.get('/languages', (req, res) => {
  res.json({
    languages: Object.entries(LANGUAGE_NAMES).map(([code, name]) => ({
      code,
      name,
      hasPreTranslated: !!PHRASES.greeting[code]
    }))
  });
});

module.exports = router;
