const express = require('express');
const router = express.Router();
const { searchSnoonu } = require('../platforms/snoonu');
const { searchRafeeq } = require('../platforms/rafeeq');
const { searchTalabat } = require('../platforms/talabat');
const { searchTgoyemek } = require('../platforms/tgoyemek');
const {
  groupProductsBySimilarity,
  applyFilters,
  paginateResults,
  getAllRestaurants
} = require('../utils/comparison');
const { generateResultSummary } = require('../services/chatService');

// ── TTS provider (same as chat route) ──
const ttsProvider = require('../services/tts/elevenlabs');

// Region configs: default coordinates + available platforms
const REGIONS = {
  qatar: {
    lat: 25.2855,
    lon: 51.5314,
    platforms: ['snoonu', 'rafeeq', 'talabat']
  },
  turkey: {
    lat: 41.076703,
    lon: 29.010804,
    platforms: ['tgoyemek']
  }
};

// Platform search functions
const PLATFORM_SEARCH = {
  snoonu: searchSnoonu,
  rafeeq: searchRafeeq,
  talabat: searchTalabat,
  tgoyemek: searchTgoyemek
};

// POST /api/search
router.post('/', async (req, res) => {
  const {
    term,
    region = 'qatar',
    lat,
    lon,
    sort = 'price',
    page = 1,
    price_min,
    price_max,
    time_min,
    time_max,
    restaurant_filter = '',
    group_by_restaurant = false
  } = req.body;

  if (!term) {
    return res.status(400).json({ error: 'Search term is required' });
  }

  // Resolve region defaults
  const regionConfig = REGIONS[region] || REGIONS.qatar;
  const searchLat = lat || regionConfig.lat;
  const searchLon = lon || regionConfig.lon;
  const searchPlatforms = regionConfig.platforms;

  try {
    // Fetch from selected platforms in parallel
    const platformPromises = [];

    for (const platform of searchPlatforms) {
      const searchFn = PLATFORM_SEARCH[platform];
      if (searchFn) {
        platformPromises.push(searchFn(term, searchLat, searchLon));
      }
    }

    const results = await Promise.all(platformPromises);
    let allItems = results.flat();

    const { language = 'en', generateAudio = false } = req.body;

    const allRestaurants = getAllRestaurants(allItems);

    allItems = applyFilters(allItems, {
      price_min,
      price_max,
      time_min,
      time_max,
      restaurant_filter
    });

    const groupedProducts = groupProductsBySimilarity(allItems, sort);
    const { products, pagination } = paginateResults(groupedProducts, page, 12);

    const summary = generateResultSummary(allItems, language);

    let audio = null;
    if (generateAudio && summary) {
      try {
        audio = await ttsProvider.synthesize(summary);
      } catch (err) {
        console.error('Search TTS error:', err.message);
      }
    }

    res.json({
      region,
      grouped: group_by_restaurant,
      products,
      pagination,
      all_restaurants: allRestaurants,
      summary,
      audio
    });
  } catch (error) {
    console.error('Error in search route:', error);
    res.status(500).json({ error: 'An error occurred while searching' });
  }
});

module.exports = router;
