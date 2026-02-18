const axios = require('axios');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = 'gpt-4o-mini';

/**
 * OpenAI chat
 * Latency: ~2s | Quality: excellent | Cost: $0.15/1M input tokens
 * More reliable JSON output, slower than Groq
 */
async function chat(messages) {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');

  const start = Date.now();
  console.log('[TIMING] OpenAI chat — request started');
  const result = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: OPENAI_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 150,
      response_format: { type: 'json_object' }
    },
    {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );
  console.log(`[TIMING] OpenAI chat — ${Date.now() - start}ms`);

  return result.data.choices?.[0]?.message?.content || '';
}

module.exports = { chat };
