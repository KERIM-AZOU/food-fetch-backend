const express = require('express');
const router = express.Router();
const axios = require('axios');
const FormData = require('form-data');

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
// Groq TTS with PlayAI (fast)
// async function groqTTS(text) {
//   if (!GROQ_API_KEY) return null;

//   try {
//     const start = Date.now();
//     const response = await axios.post(
//       'https://api.groq.com/openai/v1/audio/speech',
//       {
//         model: 'playai-tts',
//         input: text,
//         voice: 'Arista-PlayAI',
//         response_format: 'wav'
//       },
//       {
//         headers: {
//           'Authorization': `Bearer ${GROQ_API_KEY}`,
//           'Content-Type': 'application/json',
//         },
//         responseType: 'arraybuffer',
//         timeout: 15000
//       }
//     );
//     console.log(`[TIMING] Groq TTS — ${Date.now() - start}ms`);
//     return {
//       data: Buffer.from(response.data).toString('base64'),
//       contentType: 'audio/wav'
//     };
//   } catch (err) {
//     console.error('Groq TTS error:', err.response?.status, err.response?.data ? Buffer.isBuffer(err.response.data) ? err.response.data.toString() : JSON.stringify(err.response.data) : err.message);
//     return null;
//   }
// }

// // OpenAI TTS with nova voice (slower, ~2s)
async function openaiTTS(text) {
  if (!OPENAI_API_KEY) return null;

  try {
    const start = Date.now();
    const response = await axios.post(
      'https://api.openai.com/v1/audio/speech',
      {
        model: 'gpt-4o-mini-tts',
        input: text,
        voice: 'coral',
        instructions: 'Affect: warm and friendly.\n\nTone: casual, like chatting with a friend.\n\nPronunciation: native fluency in whatever language the text is in.\n\nEmotion: genuinely enthusiastic about food.',
        response_format: 'mp3'
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        responseType: 'arraybuffer',
        timeout: 15000
      }
    );
    console.log(`[TIMING] OpenAI TTS — ${Date.now() - start}ms`);
    return {
      data: Buffer.from(response.data).toString('base64'),
      contentType: 'audio/mpeg'
    };
  } catch (err) {
    console.error('OpenAI TTS error:', err.response?.status, err.response?.data ? JSON.stringify(err.response.data) : err.message);
    return null;
  }
}

// Groq Whisper transcription (fast, ~200ms)
async function groqTranscribe(audioBase64, mimeType = 'audio/webm') {
  if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY not configured');

  const audioBuffer = Buffer.from(audioBase64, 'base64');
  const ext = mimeType.includes('webm') ? 'webm' : mimeType.includes('mp3') ? 'mp3' : 'wav';

  const form = new FormData();
  form.append('file', audioBuffer, { filename: `audio.${ext}`, contentType: mimeType });
  form.append('model', 'whisper-large-v3-turbo');
  form.append('response_format', 'verbose_json');

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

  return {
    text: response.data.text || '',
    language: response.data.language || 'en'
  };
}

// // OpenAI Whisper transcription (slower, ~2s)
// async function openaiTranscribe(audioBase64, mimeType = 'audio/webm') {
//   if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');
//
//   const audioBuffer = Buffer.from(audioBase64, 'base64');
//   const ext = mimeType.includes('webm') ? 'webm' : mimeType.includes('mp3') ? 'mp3' : 'wav';
//
//   const form = new FormData();
//   form.append('file', audioBuffer, { filename: `audio.${ext}`, contentType: mimeType });
//   form.append('model', 'whisper-1');
//   form.append('response_format', 'verbose_json');
//
//   const start = Date.now();
//   const response = await axios.post(
//     'https://api.openai.com/v1/audio/transcriptions',
//     form,
//     {
//       headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, ...form.getHeaders() },
//       maxContentLength: Infinity,
//       maxBodyLength: Infinity,
//     }
//   );
//   console.log(`[TIMING] OpenAI Whisper — ${Date.now() - start}ms`);
//
//   return {
//     text: response.data.text || '',
//     language: response.data.language || 'en'
//   };
// }

// Active TTS: OpenAI
async function textToSpeech(text) {
  return openaiTTS(text);
}

// Active transcription: Groq Whisper
async function transcribeAudio(audioBase64, mimeType) {
  return groqTranscribe(audioBase64, mimeType);
  // return openaiTranscribe(audioBase64, mimeType);
}

const { chat, generateGreeting } = require('../services/chatService');

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
    const result = await chat(message, conversation.history, language);
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
    const result = await generateGreeting(language);
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

    // Transcribe audio to text - returns { text, language }
    let stepStart = Date.now();
    const transcriptionResult = await transcribeAudio(audio, mimeType);
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
    const result = await chat(transcript, conversation.history, detectedLanguage);
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
