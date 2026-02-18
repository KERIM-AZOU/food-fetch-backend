const axios = require('axios');

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = 'llama-3.3-70b-versatile';

/**
 * Groq Llama chat
 * Latency: ~200ms | Quality: good | Cost: free tier available
 * Very fast inference, good for real-time conversations
 */
async function chat(messages) {
  if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY not configured');

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

  return result.data.choices?.[0]?.message?.content || '';
}

module.exports = { chat };
