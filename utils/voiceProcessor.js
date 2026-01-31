const STOP_WORDS = new Set([
  // Articles & determiners
  'a', 'an', 'the', 'some', 'any', 'this', 'that', 'these', 'those',
  // Pronouns
  'i', 'me', 'my', 'we', 'our', 'you', 'your', 'it', 'its',
  // Common verbs in food requests
  'want', 'need', 'get', 'give', 'have', 'like', 'love', 'crave', 'craving',
  'order', 'find', 'search', 'looking', 'show', 'bring', 'make',
  'would', 'could', 'can', 'please', 'just', 'really', 'very', 'wanna',
  'gonna', 'gotta', 'lemme', 'let', 'im', "i'm", 'id', "i'd",
  // Filler words
  'um', 'uh', 'hmm', 'oh', 'ah', 'er', 'basically', 'actually',
  'maybe', 'probably', 'think', 'guess', 'something', 'anything', 'stuff',
  // Prepositions & conjunctions
  'for', 'to', 'from', 'with', 'without', 'and', 'or', 'but', 'of', 'in', 'on', 'at',
  // Time/place words
  'tonight', 'today', 'now', 'right', 'later', 'soon',
  'here', 'there', 'nearby', 'near', 'close', 'around', 'somewhere', 'anywhere',
  // Food-related but not searchable
  'food', 'eat', 'eating', 'hungry', 'meal', 'dinner', 'lunch', 'breakfast',
  'snack', 'delivery', 'deliver', 'delivered', 'ordering',
  // Other common words
  'be', 'is', 'are', 'was', 'were', 'been', 'being',
  'do', 'does', 'did', 'doing', 'done',
  'go', 'going', 'went', 'gone',
  'know', 'see', 'feel', 'look',
  'good', 'great', 'nice', 'best', 'better',
  'one', 'two', 'three', 'first', 'second',
  'also', 'too', 'so', 'then', 'than', 'as', 'if',
  'yes', 'no', 'ok', 'okay', 'sure', 'alright',
  'hey', 'hi', 'hello', 'thanks', 'thank'
]);

function extractKeywords(text) {
  if (!text?.trim()) {
    return { search_terms: [], search_query: '', original_text: '' };
  }

  const original = text.trim();

  // Lowercase, remove punctuation (keep apostrophes for names like McDonald's)
  const cleaned = original.toLowerCase().replace(/[^\w\s']/g, ' ');

  // Split and filter
  const words = cleaned.split(/\s+/).filter(word => {
    word = word.replace(/^'+|'+$/g, ''); // Remove surrounding apostrophes
    return word.length >= 2 && !STOP_WORDS.has(word);
  });

  // Remove duplicates while preserving order
  const uniqueKeywords = [...new Set(words)];

  return {
    search_terms: uniqueKeywords,
    search_query: uniqueKeywords.join(' '),
    original_text: original
  };
}

module.exports = {
  extractKeywords,
  STOP_WORDS
};
