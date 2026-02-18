const express = require('express');
const router = express.Router();

// ── TTS provider: swap import to change provider ──
// const ttsProvider = require('../services/tts/groq');
// const ttsProvider = require('../services/tts/gemini');
const ttsProvider = require('../services/tts/elevenlabs');
// const ttsProvider = require('../services/tts/openai');

// ── Transcription provider: swap import to change provider ──
// const transcriptionProvider = require('../services/transcription/groq');
const transcriptionProvider = require('../services/transcription/openai');
// const transcriptionProvider = require('../services/transcription/gemini');

// ── Chat provider: swap import to change provider ──
const chatProvider = require('../services/chat/groq');
// const chatProvider = require('../services/chat/openai');

const { buildMessages, parseAIResponse, generateGreeting } = require('../services/chatService');

async function textToSpeech(text) {
  return ttsProvider.synthesize(text);
}

async function transcribeAudio(audioBase64, mimeType) {
  return transcriptionProvider.transcribe(audioBase64, mimeType);
}

async function chat(userMessage, language = 'en') {
  const messages = buildMessages(userMessage, language);
  try {
    const responseText = await chatProvider.chat(messages);
    return parseAIResponse(responseText);
  } catch (error) {
    console.error('Chat provider error:', error.response?.data || error.message);

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

// In-memory conversation storage (use Redis/DB in production for multi-server)
const conversations = new Map();

// Clean up old conversations (older than 1 hour)
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [sessionId, data] of conversations) {
    if (data.lastActivity < oneHourAgo) {
      conversations.delete(sessionId);
    }
  }
}, 5 * 60 * 1000);

/**
 * POST /api/chat
 * Main conversational endpoint - text in, text + optional audio out
 * Body: { message: string, sessionId?: string, generateAudio?: boolean }
 */
router.post('/', async (req, res) => {
  const { message, sessionId = 'default', generateAudio = true, language = 'en' } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    // Get or create conversation history
    let conversation = conversations.get(sessionId);
    if (!conversation) {
      conversation = { history: [], lastActivity: Date.now(), lastFoodItems: [] };
      conversations.set(sessionId, conversation);
    }

    // Get AI response
    let stepStart = Date.now();
    const result = await chat(message, language);
    console.log(`[TIMING] /chat text chat — ${Date.now() - stepStart}ms`);

    // Update conversation history
    conversation.history.push({ role: 'user', content: message });
    conversation.history.push({ role: 'assistant', content: result.response });
    conversation.lastActivity = Date.now();

    // Track food items for context
    if (result.foodMentioned && result.foodItems?.length > 0) {
      conversation.lastFoodItems = result.foodItems;
    }

    // Use last known food items if shouldSearch but no items in current response
    const foodItems = result.foodItems?.length > 0 ? result.foodItems : conversation.lastFoodItems;

    // Keep history manageable
    if (conversation.history.length > 20) {
      conversation.history = conversation.history.slice(-20);
    }

    // Generate TTS audio if requested
    let audio = null;
    if (generateAudio && result.response) {
      stepStart = Date.now();
      try {
        audio = await textToSpeech(result.response);
      } catch (ttsError) {
        console.error('TTS error:', ttsError.message);
        // Continue without audio
      }
      console.log(`[TIMING] /chat text TTS — ${Date.now() - stepStart}ms`);
    }

    res.json({
      response: result.response,
      foodMentioned: result.foodMentioned,
      foodItems: foodItems,
      shouldSearch: result.shouldSearch,
      shouldStop: result.shouldStop || false,
      sessionId,
      audio
    });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Chat failed', details: error.message });
  }
});

/**
 * POST /api/chat/start
 * Start a new conversation with a greeting
 * Body: { sessionId?: string, generateAudio?: boolean }
 */
router.post('/start', async (req, res) => {
  const { sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2)}`, generateAudio = true, language = 'en' } = req.body;

  try {
    const routeStart = Date.now();

    // Generate greeting in the user's language
    const result = generateGreeting(language);
    console.log(`[TIMING] /chat/start greeting — ${Date.now() - routeStart}ms`);

    // Initialize conversation
    const conversation = {
      history: [{ role: 'assistant', content: result.greeting }],
      lastActivity: Date.now(),
      lastFoodItems: []
    };
    conversations.set(sessionId, conversation);

    // Generate TTS audio if requested
    let audio = null;
    if (generateAudio && result.greeting) {
      const ttsStart = Date.now();
      try {
        audio = await textToSpeech(result.greeting);
      } catch (ttsError) {
        console.error('TTS error:', ttsError.message);
      }
      console.log(`[TIMING] /chat/start TTS — ${Date.now() - ttsStart}ms`);
    }

    console.log(`[TIMING] /chat/start TOTAL — ${Date.now() - routeStart}ms`);
    res.json({
      greeting: result.greeting,
      sessionId,
      audio
    });

  } catch (error) {
    console.error('Chat start error:', error);
    res.status(500).json({ error: 'Failed to start chat', details: error.message });
  }
});

/**
 * POST /api/chat/audio
 * Audio input endpoint - transcribes audio then processes as text
 * Body: { audio: string (base64), mimeType: string, sessionId?: string }
 */
router.post('/audio', async (req, res) => {
  const { audio, mimeType = 'audio/webm', sessionId = 'default' } = req.body;

  if (!audio) {
    return res.status(400).json({ error: 'Audio data is required' });
  }

  try {
    const routeStart = Date.now();
    console.log(`Received audio: ${audio.length} chars base64, type: ${mimeType}`);

    // Transcribe audio — language is auto-detected by Whisper
    let stepStart = Date.now();
    let transcriptionResult;
    try {
      transcriptionResult = await transcribeAudio(audio, mimeType);
    } catch (err) {
      console.error('Transcription error details:', JSON.stringify(err.response?.data || err.message));
      throw err;
    }
    const transcript = transcriptionResult?.text || '';
    const detectedLanguage = transcriptionResult?.language || 'en';
    console.log(`[TIMING] /chat/audio transcribe — ${Date.now() - stepStart}ms`);
    console.log('Transcribed:', transcript, 'Language:', detectedLanguage);

    if (!transcript.trim()) {
      return res.json({
        response: "I didn't catch that. Could you try again?",
        transcript: '',
        foodMentioned: false,
        foodItems: [],
        shouldSearch: false,
        sessionId,
        audio: null
      });
    }

    // Get or create conversation
    let conversation = conversations.get(sessionId);
    if (!conversation) {
      conversation = { history: [], lastActivity: Date.now(), lastFoodItems: [], language: detectedLanguage };
      conversations.set(sessionId, conversation);
    }
    // Update language if detected
    conversation.language = detectedLanguage;

    // Process the transcribed text with detected language
    stepStart = Date.now();
    const result = await chat(transcript, detectedLanguage);
    console.log(`[TIMING] /chat/audio chat — ${Date.now() - stepStart}ms`);

    // Update history
    conversation.history.push({ role: 'user', content: transcript });
    conversation.history.push({ role: 'assistant', content: result.response });
    conversation.lastActivity = Date.now();

    if (result.foodMentioned && result.foodItems?.length > 0) {
      conversation.lastFoodItems = result.foodItems;
    }

    const foodItems = result.foodItems?.length > 0 ? result.foodItems : conversation.lastFoodItems;

    if (conversation.history.length > 20) {
      conversation.history = conversation.history.slice(-20);
    }

    // Generate TTS
    stepStart = Date.now();
    let audioResponse = null;
    try {
      audioResponse = await textToSpeech(result.response);
    } catch (ttsError) {
      console.error('TTS error:', ttsError.message);
    }
    console.log(`[TIMING] /chat/audio TTS — ${Date.now() - stepStart}ms`);

    console.log(`[TIMING] /chat/audio TOTAL — ${Date.now() - routeStart}ms`);
    res.json({
      response: result.response,
      transcript,
      foodMentioned: result.foodMentioned,
      foodItems: foodItems,
      shouldSearch: result.shouldSearch,
      shouldStop: result.shouldStop || false,
      sessionId,
      audio: audioResponse
    });

  } catch (error) {
    console.error('Audio chat error:', error);
    res.status(500).json({ error: 'Audio chat failed', details: error.message });
  }
});

/**
 * GET /api/chat/history/:sessionId
 */
router.get('/history/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const conversation = conversations.get(sessionId);

  if (!conversation) {
    return res.status(404).json({ error: 'Conversation not found' });
  }

  res.json({
    sessionId,
    history: conversation.history,
    lastActivity: conversation.lastActivity
  });
});

/**
 * DELETE /api/chat/:sessionId
 */
router.delete('/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  conversations.delete(sessionId);
  res.json({ success: true, message: 'Conversation cleared' });
});

module.exports = router;
