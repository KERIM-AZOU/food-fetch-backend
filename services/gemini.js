const axios = require('axios');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const VERTEX_AI_BASE = 'https://aiplatform.googleapis.com/v1/publishers/google/models';
const MODEL = 'gemini-2.5-flash-lite';
const TTS_MODEL = 'gemini-2.5-flash-preview-tts';

/**
 * Call Vertex AI generateContent endpoint
 */
async function callVertexAI(model, body) {
  const response = await axios.post(
    `${VERTEX_AI_BASE}/${model}:generateContent?key=${GEMINI_API_KEY}`,
    body,
    { headers: { 'Content-Type': 'application/json' } }
  );
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

// Check if Gemini is enabled
function isGeminiEnabled() {
  return process.env.USE_GEMINI === 'true' && !!GEMINI_API_KEY;
}

/**
 * Transcribe audio using Gemini's native audio understanding
 * @param {Buffer} audioBuffer - The audio buffer
 * @param {string} mimeType - The audio mime type (e.g., 'audio/webm')
 * @returns {Promise<{text: string, language: string}>}
 */
async function transcribeAudio(audioBuffer, mimeType = 'audio/webm') {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured');
  }

  const audioBase64 = audioBuffer.toString('base64');

  const result = await callVertexAI(MODEL, {
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType: mimeType, data: audioBase64 } },
        { text: `Transcribe this audio exactly as spoken. Also detect the language.
Return your response in this exact JSON format:
{"text": "the transcription here", "language": "language code like en, ar, fr, es, etc"}

If the audio is silent or contains no speech, return:
{"text": "", "language": "en"}

Only return the JSON, nothing else.` }
      ]
    }]
  });

  const responseText = extractText(result).trim();

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        text: parsed.text || '',
        language: parsed.language || 'en'
      };
    }
  } catch (e) {
    console.error('Failed to parse Gemini transcription response:', responseText);
  }

  return {
    text: responseText,
    language: 'en'
  };
}

/**
 * Extract food keywords from text using Gemini
 * @param {string} text - The text to extract keywords from
 * @returns {Promise<string|null>} - Extracted keywords or 'NOT_FOOD_RELATED'
 */
async function extractFoodKeywords(text) {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured');
  }

  const result = await callVertexAI(MODEL, {
    contents: [{
      role: 'user',
      parts: [{ text: `Extract food/drink items in English. If NO food/drink found, return exactly: NOT_FOOD_RELATED

Rules: Translate to English, space-separate items, ignore filler words.

Examples: "frites"->fries | "pizza" ->pizza | "poulet avec riz"->chicken rice | "what's the weather"->NOT_FOOD_RELATED | "hello"->NOT_FOOD_RELATED

Input: "${text}"

Output only the extracted keywords or NOT_FOOD_RELATED, nothing else:` }]
    }]
  });

  const extracted = extractText(result).trim();
  console.log('Gemini extracted:', extracted, 'from:', text);
  return extracted;
}

/**
 * Translate text to a target language using Gemini
 * @param {string} text - Text to translate
 * @param {string} targetLanguage - Target language name or code
 * @returns {Promise<string>}
 */
async function translateText(text, targetLanguage) {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured');
  }

  const result = await callVertexAI(MODEL, {
    contents: [{
      role: 'user',
      parts: [{ text: `Translate to ${targetLanguage}. Only output the translation, nothing else:
"${text}"` }]
    }]
  });

  return extractText(result).trim();
}

/**
 * Convert raw PCM audio (L16) to WAV format
 */
function pcmToWav(pcmBuffer, sampleRate = 24000, channels = 1, bitsPerSample = 16) {
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const dataSize = pcmBuffer.length;
  const headerSize = 44;
  const fileSize = headerSize + dataSize - 8;

  const wavBuffer = Buffer.alloc(headerSize + dataSize);

  // RIFF header
  wavBuffer.write('RIFF', 0);
  wavBuffer.writeUInt32LE(fileSize, 4);
  wavBuffer.write('WAVE', 8);

  // fmt subchunk
  wavBuffer.write('fmt ', 12);
  wavBuffer.writeUInt32LE(16, 16);
  wavBuffer.writeUInt16LE(1, 20);
  wavBuffer.writeUInt16LE(channels, 22);
  wavBuffer.writeUInt32LE(sampleRate, 24);
  wavBuffer.writeUInt32LE(byteRate, 28);
  wavBuffer.writeUInt16LE(blockAlign, 32);
  wavBuffer.writeUInt16LE(bitsPerSample, 34);

  // data subchunk
  wavBuffer.write('data', 36);
  wavBuffer.writeUInt32LE(dataSize, 40);
  pcmBuffer.copy(wavBuffer, 44);

  return wavBuffer;
}

/**
 * Generate speech audio from text using Gemini's native TTS model
 * @param {string} text - Text to convert to speech
 * @param {string} language - Language code
 * @returns {Promise<{audio: string, contentType: string}|null>}
 */
async function textToSpeech(text, language = 'en') {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured');
  }

  try {
    const response = await axios.post(
      `${VERTEX_AI_BASE}/${TTS_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [
          {
            role: 'user',
            parts: [
              { text: text }
            ]
          }
        ],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Kore'
              }
            }
          }
        }
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    const candidates = response.data?.candidates || [];

    for (const candidate of candidates) {
      const parts = candidate.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData && part.inlineData.mimeType?.includes('audio')) {
          console.log('Gemini TTS: Audio generated successfully');

          const pcmBase64 = part.inlineData.data;
          const pcmBuffer = Buffer.from(pcmBase64, 'base64');

          const mimeType = part.inlineData.mimeType;
          const rateMatch = mimeType.match(/rate=(\d+)/);
          const sampleRate = rateMatch ? parseInt(rateMatch[1]) : 24000;

          const wavBuffer = pcmToWav(pcmBuffer, sampleRate);
          const wavBase64 = wavBuffer.toString('base64');

          return {
            audio: wavBase64,
            contentType: 'audio/wav'
          };
        }
      }
    }

    console.log('Gemini TTS: No audio in response, response:', JSON.stringify(response.data).substring(0, 200));
    return null;
  } catch (error) {
    console.error('Gemini TTS error:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Process audio end-to-end: transcribe, extract food keywords, and generate response
 * @param {Buffer} audioBuffer - The audio buffer
 * @param {string} mimeType - The audio mime type
 * @returns {Promise<{text: string, language: string, searchQuery: string, isFood: boolean}>}
 */
async function processAudioForFood(audioBuffer, mimeType = 'audio/webm') {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured');
  }

  const audioBase64 = audioBuffer.toString('base64');

  const result = await callVertexAI(MODEL, {
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType: mimeType, data: audioBase64 } },
        { text: `You are an AI assistant. Listen to this audio and:
1. Transcribe exactly what was said.
2. Detect the language.
3. Extract any food/drink items mentioned (in English).
4. Determine if the request is about food.

Return JSON in this exact format:
{
  "transcription": "words spoken",
  "language": "language code (e.g., en, ar)",
  "foodKeywords": "food items, space-separated",
  "isFood": boolean
}

If silent or unclear, set transcription to "" and isFood to false.
Return only JSON.` }
      ]
    }]
  });

  const responseText = extractText(result).trim();

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        text: parsed.transcription || '',
        language: parsed.language || 'en',
        searchQuery: parsed.foodKeywords || '',
        isFood: parsed.isFood || false
      };
    }
  } catch (e) {
    console.error('Failed to parse Gemini food processing response:', responseText);
  }

  return {
    text: responseText,
    language: 'en',
    searchQuery: '',
    isFood: false
  };
}

/**
 * Conversational AI chat with food ordering capability
 * @param {string} userMessage - The user's message
 * @param {Array} conversationHistory - Previous messages [{role: 'user'|'assistant', content: string}]
 * @returns {Promise<{response: string, foodMentioned: boolean, foodItems: string[], shouldSearch: boolean}>}
 */
async function chat(userMessage, conversationHistory = []) {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured');
  }

  const systemPrompt = `You are a general-purpose, friendly, and conversational AI assistant.

**Your primary goal is to have an engaging conversation with the user on ANY topic.**

Always be curious and ask a follow-up question to keep the conversation flowing naturally.

You also have a special skill: you can help users find food.
- If the user explicitly mentions wanting to eat, being hungry, or asks for food, offer to help.
- If they accept your help for a food search, set \`shouldSearch\` to true.
- Extract mentioned food items into the \`foodItems\` array.

**IMPORTANT:** Do NOT mention food or ordering unless the user brings it up first. Your main role is conversation.

Respond in this exact JSON format:
{
  "response": "Your conversational reply, ending with a question.",
  "foodMentioned": boolean,
  "foodItems": string[],
  "shouldSearch": boolean
}

Example (Non-Food):
User: I'm thinking of getting a new laptop.
AI: {"response": "That's great! What are you looking for in a new laptop?", "foodMentioned": false, "foodItems": [], "shouldSearch": false}

Example (Food):
User: I'm starving.
AI: {"response": "Oh no! I can help with that. What kind of food are you craving?", "foodMentioned": true, "foodItems": [], "shouldSearch": false}`;

  const contents = [];

  for (const msg of conversationHistory) {
    contents.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    });
  }

  contents.push({
    role: 'user',
    parts: [{ text: userMessage }]
  });

  try {
    const result = await callVertexAI(MODEL, {
      contents,
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 500,
      }
    });

    const responseText = extractText(result).trim();

    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          response: parsed.response || responseText,
          foodMentioned: parsed.foodMentioned || false,
          foodItems: parsed.foodItems || [],
          shouldSearch: parsed.shouldSearch || false
        };
      }
    } catch (e) {
      console.error('Failed to parse chat response as JSON:', responseText);
    }

    return {
      response: responseText,
      foodMentioned: false,
      foodItems: [],
      shouldSearch: false
    };
  } catch (error) {
    console.error('Gemini chat error:', error.message);
    throw error;
  }
}

/**
 * Generate a greeting message
 * @returns {Promise<string>}
 */
async function generateGreeting() {
  if (!GEMINI_API_KEY) {
    return "Hey there! What's on your mind?";
  }

  try {
    const result = await callVertexAI(MODEL, {
      contents: [{
        role: 'user',
        parts: [{ text: 'Generate a short, warm, friendly greeting for a general-purpose AI assistant. Keep it under 25 words. Be casual and inviting.' }]
      }],
      generationConfig: {
        temperature: 0.9,
        maxOutputTokens: 100,
      }
    });

    return extractText(result).trim();
  } catch (error) {
    console.error('Greeting generation error:', error.message);
    return "Hey there! What's on your mind?";
  }
}

module.exports = {
  isGeminiEnabled,
  transcribeAudio,
  extractFoodKeywords,
  translateText,
  textToSpeech,
  processAudioForFood,
  chat,
  generateGreeting
};
