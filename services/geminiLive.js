/**
 * Gemini Chat Service - Vertex AI REST API approach
 * Handles AI conversations with food detection capability
 */
const axios = require('axios');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const VERTEX_AI_BASE = 'https://aiplatform.googleapis.com/v1/publishers/google/models';
const MODEL = 'gemini-2.5-flash-lite';

/**
 * Call Vertex AI generateContent endpoint
 */
async function callVertexAI(model, body, label = '') {
  const tag = label || model;
  const start = Date.now();
  console.log(`[TIMING] ${tag} — request started`);
  const response = await axios.post(
    `${VERTEX_AI_BASE}/${model}:generateContent?key=${GEMINI_API_KEY}`,
    body,
    { headers: { 'Content-Type': 'application/json' } }
  );
  console.log(`[TIMING] ${tag} — ${Date.now() - start}ms`);
  return response.data;
}

/**
 * Extract text from Vertex AI response
 */
function extractText(response) {
  const candidates = response.candidates || [];
  if (candidates.length > 0) {
    const parts = candidates[0].content?.parts || [];
    for (const part of parts) {
      if (part.text) return part.text;
    }
  }
  return '';
}

// System prompt
function getChatSystemPrompt(language = 'en') {
  return `Friendly concise assistant. Respond in ${language}. Max 20 words. End with a question.
JSON only: {"response":"text","foodMentioned":bool,"foodItems":["english"],"shouldSearch":bool,"shouldStop":bool}
foodItems in English. shouldSearch=true when food mentioned. shouldStop=true on bye/stop/done/quit.
"Hi"→{"response":"Hey! How's it going?","foodMentioned":false,"foodItems":[],"shouldSearch":false,"shouldStop":false}
"pizza"→{"response":"Searching for pizza! Want anything else?","foodMentioned":true,"foodItems":["pizza"],"shouldSearch":true,"shouldStop":false}
"bye"→{"response":"See you later!","foodMentioned":false,"foodItems":[],"shouldSearch":false,"shouldStop":true}`;
}

/**
 * Parse JSON response from Gemini
 */
function parseGeminiResponse(text) {
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
 * Chat with Gemini - handles conversation with food detection
 * @param {string} userMessage - The user's message
 * @param {Array} conversationHistory - Previous messages for context
 * @param {string} language - User's detected language code (e.g., 'en', 'ar', 'no')
 * @returns {Promise<{response: string, foodMentioned: boolean, foodItems: string[], shouldSearch: boolean}>}
 */
async function chat(userMessage, conversationHistory = [], language = 'en') {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API not configured');
  }

  try {
    const contents = [];

    const recentHistory = conversationHistory.slice(-10);
    for (const msg of recentHistory) {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      });
    }

    contents.push({
      role: 'user',
      parts: [{ text: userMessage }]
    });

    const result = await callVertexAI(MODEL, {
      contents,
      systemInstruction: { parts: [{ text: getChatSystemPrompt(language) }] },
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 150
      }
    });

    const responseText = extractText(result);
    return parseGeminiResponse(responseText);

  } catch (error) {
    console.error('Gemini chat error:', error);

    if (error.message?.includes('429') || error.message?.includes('quota')) {
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

/**
 * Generate a greeting message
 * @returns {Promise<{greeting: string}>}
 */
function generateGreeting() {
  const greetings = [
    "Hey there! What's on your mind?",
    "Hi! How can I help you today?",
    "Hey! What can I do for you?",
  ];
  return {
    greeting: greetings[Math.floor(Math.random() * greetings.length)]
  };
}

module.exports = {
  chat,
  generateGreeting,
  parseGeminiResponse
};
