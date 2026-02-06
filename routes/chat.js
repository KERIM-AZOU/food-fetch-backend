const express = require('express');
const router = express.Router();
const axios = require('axios');
const { isGeminiEnabled, textToSpeech: geminiTTS, transcribeAudio } = require('../services/gemini');

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';

// ElevenLabs TTS (higher limits than Gemini TTS)
async function elevenLabsTTS(text) {
  if (!ELEVENLABS_API_KEY) return null;

  try {
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${DEFAULT_VOICE_ID}`,
      {
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 }
      },
      {
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        responseType: 'arraybuffer',
        timeout: 15000
      }
    );
    return {
      data: Buffer.from(response.data).toString('base64'),
      contentType: 'audio/mpeg'
    };
  } catch (err) {
    console.error('ElevenLabs TTS error:', err.message);
    return null;
  }
}

// Smart TTS: Try ElevenLabs first (higher limits), fallback to Gemini
async function textToSpeech(text) {
  // Try ElevenLabs first
  // const elevenResult = await elevenLabsTTS(text);
  // if (elevenResult) {
  //   console.log('Using ElevenLabs TTS');
  //   return elevenResult;
  // }

  // // Fallback to Gemini TTS
  // console.log('Using Gemini TTS');
  try {
    const geminiResult = await geminiTTS(text);
    if (geminiResult?.audio) {
      return { data: geminiResult.audio, contentType: geminiResult.contentType || 'audio/wav' };
    }
  } catch (err) {
    console.error('Gemini TTS error:', err.message);
  }

  return null;
}
const { chat, generateGreeting } = require('../services/geminiLive');

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
  const { message, sessionId = 'default', generateAudio = true } = req.body;

  if (!isGeminiEnabled()) {
    return res.status(400).json({
      error: 'Chat requires Gemini to be enabled',
      setup: 'Set USE_GEMINI=true in .env'
    });
  }

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
    const result = await chat(message, conversation.history);

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
      try {
        audio = await textToSpeech(result.response);
      } catch (ttsError) {
        console.error('TTS error:', ttsError.message);
        // Continue without audio
      }
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
  const { sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2)}`, generateAudio = true } = req.body;

  if (!isGeminiEnabled()) {
    return res.status(400).json({
      error: 'Chat requires Gemini to be enabled',
      setup: 'Set USE_GEMINI=true in .env'
    });
  }

  try {
    // Generate greeting
    const result = await generateGreeting();

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
      try {
        audio = await textToSpeech(result.greeting);
      } catch (ttsError) {
        console.error('TTS error:', ttsError.message);
      }
    }

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

  if (!isGeminiEnabled()) {
    return res.status(400).json({
      error: 'Audio chat requires Gemini to be enabled',
      setup: 'Set USE_GEMINI=true in .env'
    });
  }

  if (!audio) {
    return res.status(400).json({ error: 'Audio data is required' });
  }

  try {
    console.log(`Received audio: ${audio.length} chars base64, type: ${mimeType}`);

    // Transcribe audio to text - returns { text, language }
    const transcriptionResult = await transcribeAudio(audio, mimeType);
    const transcript = transcriptionResult?.text || '';
    const detectedLanguage = transcriptionResult?.language || 'en';
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
    const result = await chat(transcript, conversation.history, detectedLanguage);

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
    let audioResponse = null;
    try {
      audioResponse = await textToSpeech(result.response);
    } catch (ttsError) {
      console.error('TTS error:', ttsError.message);
    }

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
