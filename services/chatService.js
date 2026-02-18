/**
 * Chat Service - shared logic for AI conversations with food detection
 * Provider-specific code lives in services/chat/{groq,openai}.js
 */

// System prompt
function getChatSystemPrompt(language = 'en') {
  const dialectNote = language === 'ar'
    ? 'You MUST reply in casual Gulf/Saudi Arabic dialect (خليجي/سعودي), NOT formal/MSA Arabic. Use words like: يلا، وش تبي، أبي، حلو، طيب.'
    : `Reply in the SAME language as the user. The user's language is "${language}".`;

  return `You are a friendly food-ordering assistant. You help people find food.

${dialectNote}
Keep replies short (under 25 words). Be casual and friendly.
If the user mentions food, extract the food items into foodItems (always in English).

Respond with ONLY this JSON:
{"response":"your reply","foodMentioned":false,"foodItems":[],"shouldSearch":false,"shouldStop":false}

- foodItems: English only. e.g. user says "بيتزا" → foodItems: ["pizza"]
- shouldSearch: true when foodItems is not empty
- shouldStop: true when user says bye/goodbye/done

Examples:
User (ar): "أهلاً كيف حالك" → {"response":"هلا والله! تمام الحمدلله، وش تبي تاكل اليوم؟","foodMentioned":false,"foodItems":[],"shouldSearch":false,"shouldStop":false}
User (ar): "أبي بيتزا" → {"response":"يلا أجيب لك بيتزا! تبيها بأي نوع؟","foodMentioned":true,"foodItems":["pizza"],"shouldSearch":true,"shouldStop":false}
User (en): "I want burger" → {"response":"On it! Any toppings you want?","foodMentioned":true,"foodItems":["burger"],"shouldSearch":true,"shouldStop":false}`;
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
 * Build the messages array for the chat provider
 * No conversation history — keeps language clean and TTS consistent
 */
function buildMessages(userMessage, language = 'en') {
  return [
    { role: 'system', content: getChatSystemPrompt(language) },
    { role: 'user', content: userMessage }
  ];
}

/**
 * Generate a greeting message in the user's language
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
  buildMessages,
  parseAIResponse,
  generateGreeting
};
