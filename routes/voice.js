const express = require('express');
const axios = require('axios');
const router = express.Router();
const { extractKeywords } = require('../utils/voiceProcessor');
const { searchSnoonu } = require('../platforms/snoonu');
const { isGeminiEnabled, extractFoodKeywords, translateText } = require('../services/gemini');

const GROQ_API_KEY = process.env.GROQ_API_KEY;

// Extract food keywords using Groq Llama (multilingual)
async function extractWithGroq(text) {
  try {
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.1-8b-instant', // Fast and free
        messages: [
          {
            role: 'system',
            content: `Extract food/drink items in English. If NO food/drink found, return: NOT_FOOD_RELATED

Rules: Translate to English, space-separate items, ignore filler words.

Examples: "frites"→fries | "أريد بيتزا"→pizza | "poulet avec riz"→chicken rice | "what's the weather"→NOT_FOOD_RELATED | "مرحبا"→NOT_FOOD_RELATED`
          },
          {
            role: 'user',
            content: text
          }
        ],
        temperature: 0.1,
        max_tokens: 100
      },
      {
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const extracted = response.data.choices[0]?.message?.content?.trim() || '';
    console.log('Groq AI extracted:', extracted, 'from:', text);
    return extracted;
  } catch (error) {
    console.error('Groq AI extraction error:', error.response?.data || error.message);
    return null; // Fallback to simple extraction
  }
}

// Unified extraction function - uses Gemini or Groq based on toggle
async function extractWithAI(text) {
  if (isGeminiEnabled()) {
    console.log('Using Gemini for food extraction');
    try {
      const result = await extractFoodKeywords(text);
      return result;
    } catch (error) {
      console.error('Gemini extraction error, falling back to Groq:', error.message);
      return extractWithGroq(text);
    }
  }
  return extractWithGroq(text);
}

// Generate "not food related" message in the user's language
async function generateNotFoodMessage(language) {
  const defaultMessage = "Your request doesn't seem to be about food. Please ask about food items you'd like to search for.";

  if (language === 'en') {
    return defaultMessage;
  }

  // Use Gemini if enabled
  if (isGeminiEnabled()) {
    try {
      return await translateText(defaultMessage, LANGUAGE_NAMES[language] || language);
    } catch (error) {
      console.error('Gemini translation error, falling back to Groq:', error.message);
    }
  }

  // Groq fallback
  try {
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'user',
            content: `Translate to ${LANGUAGE_NAMES[language] || language} (only output translation): ${defaultMessage}`
          }
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

    return response.data.choices[0]?.message?.content?.trim() || defaultMessage;
  } catch (error) {
    console.error('Translation error for not food message:', error.message);
    return defaultMessage;
  }
}

// Language name mapping for TTS responses
const LANGUAGE_NAMES = {
  en: 'English', ar: 'Arabic', fr: 'French', es: 'Spanish', de: 'German',
  it: 'Italian', pt: 'Portuguese', ru: 'Russian', zh: 'Chinese', ja: 'Japanese',
  ko: 'Korean', hi: 'Hindi', tr: 'Turkish', nl: 'Dutch', pl: 'Polish',
  sv: 'Swedish', da: 'Danish', no: 'Norwegian', fi: 'Finnish', cs: 'Czech'
};

// Generate "Searching for X" message in the user's language
async function generateSearchMessage(searchQuery, language) {
  const defaultMessage = `Searching for ${searchQuery}`;

  if (language === 'en') {
    return defaultMessage;
  }

  // Use Gemini if enabled
  if (isGeminiEnabled()) {
    try {
      return await translateText(defaultMessage, LANGUAGE_NAMES[language] || language);
    } catch (error) {
      console.error('Gemini translation error, falling back to Groq:', error.message);
    }
  }

  // Groq fallback
  try {
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'user',
            content: `Translate to ${LANGUAGE_NAMES[language] || language} (only output translation): ${defaultMessage}`
          }
        ],
        temperature: 0.1,
        max_tokens: 100
      },
      {
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.choices[0]?.message?.content?.trim() || defaultMessage;
  } catch (error) {
    console.error('Translation error:', error.message);
    return defaultMessage;
  }
}

// POST /api/process-voice
router.post('/', async (req, res) => {
  const {
    text,
    language = 'en', // Detected language from transcription
    lat = 25.2855,
    lon = 51.5314,
    validate = false,
    useAI = true // Use AI by default for better multilingual support
  } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'Text is required' });
  }

  try {
    let search_query;
    let search_terms;

    // Try AI extraction first if enabled
    if (useAI) {
      const aiResult = await extractWithAI(text);

      // Check if the request is not food related
      if (aiResult === 'NOT_FOOD_RELATED') {
        const notFoodMessage = await generateNotFoodMessage(language);
        return res.json({
          search_terms: [],
          search_query: '',
          search_message: notFoodMessage,
          language,
          original_text: text,
          validated: false,
          result_count: 0,
          ai_extracted: true,
          not_food_related: true
        });
      }

      if (aiResult) {
        search_query = aiResult;
        search_terms = aiResult.split(/\s+/).filter(w => w.length > 0);
      }
    }

    // Fallback to simple extraction
    if (!search_query) {
      const simple = extractKeywords(text);
      search_query = simple.search_query;
      search_terms = simple.search_terms;
    }

    let result_count = 0;
    let validated = false;

    // Optionally validate query against Snoonu API
    if (validate && search_query) {
      const testResults = await searchSnoonu(search_query, lat, lon);
      result_count = testResults.length;
      validated = result_count > 0;

      // If no results, try progressively shorter keyword combinations
      if (!validated && search_terms.length > 1) {
        for (let i = search_terms.length - 1; i >= 1; i--) {
          const shorterQuery = search_terms.slice(0, i).join(' ');
          const shorterResults = await searchSnoonu(shorterQuery, lat, lon);
          if (shorterResults.length >= 3) {
            result_count = shorterResults.length;
            validated = true;
            break;
          }
        }
      }
    }

    // Generate search message in user's language
    const searchMessage = await generateSearchMessage(search_query, language);

    res.json({
      search_terms,
      search_query,
      search_message: searchMessage, // "Searching for X" in user's language
      language, // Pass back the detected language
      original_text: text,
      validated,
      result_count,
      ai_extracted: useAI
    });
  } catch (error) {
    console.error('Error in voice route:', error);
    res.status(500).json({ error: 'An error occurred while processing voice command' });
  }
});

module.exports = router;
