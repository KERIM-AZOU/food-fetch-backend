/**
 * Chat Service - Groq Llama (fast) with OpenAI fallback
 * Handles AI conversations with food detection capability
 */
const axios = require('axios');

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = 'llama-3.3-70b-versatile';

// // OpenAI (slower, ~2s but more reliable)
// const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
// const OPENAI_MODEL = 'gpt-4o-mini';

// System prompt
function getChatSystemPrompt(language = 'en') {
  return `You are a fun, friendly, and curious AI assistant who loves chatting. You're warm, witty, and genuinely interested in people.

**Rules:**
- CRITICAL: You MUST respond in the SAME language the user is speaking. If they speak Arabic, reply in Arabic. If English, reply in English. Detect the language from their message — the detected language code "${language}" is just a hint, always match the user's actual language.
- Keep responses under 30 words — be concise but expressive
- ALWAYS end with a follow-up question to keep the conversation going naturally
- Remember what the user said earlier and reference it when relevant
- Be playful and use casual language — like talking to a friend
- You can help find food! If the user mentions food, being hungry, or wanting to eat, extract the food items

**Response format — JSON only, no extra text:**
{"response":"your reply","foodMentioned":bool,"foodItems":["items in english"],"shouldSearch":bool,"shouldStop":bool}

- foodItems: always in English, even if the user speaks another language. Extract ALL food/drink items mentioned.
- foodMentioned: true whenever the user mentions ANY food, drink, or says they're hungry
- shouldSearch: true whenever foodItems is not empty — if they name a food, search for it
- shouldStop: true only when user says bye/stop/done/quit/goodbye

**Examples:**
User: "Hi"
{"response":"Hey there! I was just thinking about how cool today is. What's been on your mind?","foodMentioned":false,"foodItems":[],"shouldSearch":false,"shouldStop":false}

User: "I'm starving"
{"response":"Oh no, we can't have that! What kind of food are you craving right now?","foodMentioned":true,"foodItems":[],"shouldSearch":false,"shouldStop":false}

User: "pizza"
{"response":"Great choice! Let me find some pizza for you. Any particular style you love?","foodMentioned":true,"foodItems":["pizza"],"shouldSearch":true,"shouldStop":false}

User: "Je veux de la pizza s'il vous plaît"
{"response":"Excellent choix ! Je vais chercher de la pizza pour toi. Tu préfères quel style ?","foodMentioned":true,"foodItems":["pizza"],"shouldSearch":true,"shouldStop":false}

User: "bye"
{"response":"It was awesome chatting with you! Come back anytime!","foodMentioned":false,"foodItems":[],"shouldSearch":false,"shouldStop":true}`;
}

/**
 * Parse JSON response from AI
 */
function parseAIResponse(text) {
  try {
    const parsed = JSON.parse(text);
    return {
      response: parsed.response || text,
      foodMentioned: parsed.foodMentioned || false,
      foodItems: parsed.foodItems || [],
      shouldSearch: parsed.shouldSearch || false,
      shouldStop: parsed.shouldStop || false
    };
  } catch (e) {
    const jsonMatch = text.match(/\{[\s\S]*"response"[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          response: parsed.response || text,
          foodMentioned: parsed.foodMentioned || false,
          foodItems: parsed.foodItems || [],
          shouldSearch: parsed.shouldSearch || false,
          shouldStop: parsed.shouldStop || false
        };
      } catch (e2) {
        // Fall through to default
      }
    }

    return {
      response: text,
      foodMentioned: false,
      foodItems: [],
      shouldSearch: false,
      shouldStop: false
    };
  }
}

/**
 * Chat with Groq Llama - handles conversation with food detection
 * @param {string} userMessage - The user's message
 * @param {Array} conversationHistory - Previous messages for context
 * @param {string} language - User's detected language code (e.g., 'en', 'ar', 'no')
 * @returns {Promise<{response: string, foodMentioned: boolean, foodItems: string[], shouldSearch: boolean}>}
 */
async function chat(userMessage, conversationHistory = [], language = 'en') {
  if (!GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY not configured');
  }

  try {
    const messages = [
      { role: 'system', content: getChatSystemPrompt(language) }
    ];

    const recentHistory = conversationHistory.slice(-10);
    for (const msg of recentHistory) {
      messages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      });
    }

    messages.push({ role: 'user', content: userMessage });

    const start = Date.now();
    console.log('[TIMING] Groq chat — request started');
    const result = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: GROQ_MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 150,
        response_format: { type: 'json_object' }
      },
      {
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log(`[TIMING] Groq chat — ${Date.now() - start}ms`);

    const responseText = result.data.choices?.[0]?.message?.content || '';
    return parseAIResponse(responseText);

  } catch (error) {
    console.error('Groq chat error:', error.response?.data || error.message);

    if (error.response?.status === 429) {
      return {
        response: language === 'ar' ? "لحظة، جاري المحاولة..." : "I'm a bit busy right now. Give me a moment and try again!",
        foodMentioned: false,
        foodItems: [],
        shouldSearch: false
      };
    }

    throw error;
  }
}

// // OpenAI chat (slower, ~2s but more reliable JSON)
// async function chat(userMessage, conversationHistory = [], language = 'en') {
//   if (!OPENAI_API_KEY) {
//     throw new Error('OPENAI_API_KEY not configured');
//   }
//
//   try {
//     const messages = [
//       { role: 'system', content: getChatSystemPrompt(language) }
//     ];
//
//     const recentHistory = conversationHistory.slice(-10);
//     for (const msg of recentHistory) {
//       messages.push({
//         role: msg.role === 'user' ? 'user' : 'assistant',
//         content: msg.content
//       });
//     }
//
//     messages.push({ role: 'user', content: userMessage });
//
//     const start = Date.now();
//     console.log('[TIMING] OpenAI chat — request started');
//     const result = await axios.post(
//       'https://api.openai.com/v1/chat/completions',
//       {
//         model: OPENAI_MODEL,
//         messages,
//         temperature: 0.7,
//         max_tokens: 150,
//         response_format: { type: 'json_object' }
//       },
//       {
//         headers: {
//           'Authorization': `Bearer ${OPENAI_API_KEY}`,
//           'Content-Type': 'application/json'
//         }
//       }
//     );
//     console.log(`[TIMING] OpenAI chat — ${Date.now() - start}ms`);
//
//     const responseText = result.data.choices?.[0]?.message?.content || '';
//     return parseAIResponse(responseText);
//
//   } catch (error) {
//     console.error('OpenAI chat error:', error.response?.data || error.message);
//
//     if (error.response?.status === 429) {
//       return {
//         response: language === 'ar' ? "لحظة، جاري المحاولة..." : "I'm a bit busy right now. Give me a moment and try again!",
//         foodMentioned: false,
//         foodItems: [],
//         shouldSearch: false
//       };
//     }
//
//     throw error;
//   }
// }

/**
 * Generate a greeting message in the user's language
 * @param {string} language - Language code (e.g., 'en', 'ar', 'fr')
 * @returns {{greeting: string}}
 */
function generateGreeting(language = 'en') {
  const greetings = {
    en: ["Hey there! What's on your mind?", "Hi! How can I help you today?", "Hey! What can I do for you?"],
    ar: ["أهلاً! شو عبالك اليوم؟", "مرحبا! كيف أقدر أساعدك؟", "هلا! شو تبي؟"],
    fr: ["Salut ! Qu'est-ce qui te ferait plaisir ?", "Coucou ! Comment je peux t'aider ?", "Hey ! Quoi de neuf ?"],
    es: ["¡Hola! ¿Qué tienes en mente?", "¡Hey! ¿En qué te puedo ayudar?", "¡Hola! ¿Qué se te antoja?"],
    de: ["Hey! Was hast du auf dem Herzen?", "Hallo! Wie kann ich dir helfen?", "Hi! Was kann ich für dich tun?"],
    zh: ["嘿！你在想什么？", "你好！我能帮你什么？", "嗨！有什么需要的吗？"],
    hi: ["नमस्ते! क्या चल रहा है?", "हाय! मैं कैसे मदद कर सकता हूं?", "हेलो! क्या चाहिए?"],
    pt: ["Oi! O que está pensando?", "E aí! Como posso ajudar?", "Olá! O que posso fazer por você?"],
    ru: ["Привет! Что у тебя на уме?", "Хей! Чем могу помочь?", "Здравствуй! Что тебе нужно?"],
    ja: ["やあ！何を考えてる？", "こんにちは！何かお手伝いできる？", "ハイ！何でも聞いてね！"],
    ko: ["안녕! 무슨 생각 중이야?", "하이! 뭘 도와줄까?", "안녕하세요! 무엇이 필요하세요?"],
    it: ["Ciao! Cosa hai in mente?", "Hey! Come posso aiutarti?", "Ciao! Che mi racconti?"],
    tr: ["Selam! Aklında ne var?", "Merhaba! Nasıl yardımcı olabilirim?", "Hey! Ne yapabilirim senin için?"],
  };
  const list = greetings[language] || greetings.en;
  return {
    greeting: list[Math.floor(Math.random() * list.length)]
  };
}

module.exports = {
  chat,
  generateGreeting,
  parseAIResponse
};
