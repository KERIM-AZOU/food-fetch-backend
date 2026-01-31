const express = require('express');
const router = express.Router();
const { searchSnoonu } = require('../platforms/snoonu');
const { searchRafeeq } = require('../platforms/rafeeq');
const { searchTalabat } = require('../platforms/talabat');
const {
  groupProductsBySimilarity,
  applyFilters,
  paginateResults,
  getAllRestaurants
} = require('../utils/comparison');

// POST /api/search
router.post('/', async (req, res) => {
  const {
    term,
    lat = 25.2855,
    lon = 51.5314,
    sort = 'price',
    page = 1,
    platforms = ['snoonu', 'rafeeq', 'talabat'],
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

  try {
    // Fetch from selected platforms in parallel
    const platformPromises = [];

    if (platforms.includes('snoonu')) {
      platformPromises.push(searchSnoonu(term, lat, lon));
    }
    if (platforms.includes('rafeeq')) {
      platformPromises.push(searchRafeeq(term, lat, lon));
    }
    if (platforms.includes('talabat')) {
      platformPromises.push(searchTalabat(term, lat, lon));
    }

    const results = await Promise.all(platformPromises);
    let allProducts = results.flat();

    // Get all restaurants before filtering
    const allRestaurants = getAllRestaurants(allProducts);

    // Apply filters
    allProducts = applyFilters(allProducts, {
      price_min,
      price_max,
      time_min,
      time_max,
      restaurant_filter,
      platforms
    });

    // Group products by similarity
    const groupedProducts = groupProductsBySimilarity(allProducts, sort);

    // Paginate results
    const { products, pagination } = paginateResults(groupedProducts, page, 12);

    res.json({
      grouped: group_by_restaurant,
      products,
      pagination,
      all_restaurants: allRestaurants
    });
  } catch (error) {
    console.error('Error in search route:', error);
    res.status(500).json({ error: 'An error occurred while searching' });
  }
});

module.exports = router;
