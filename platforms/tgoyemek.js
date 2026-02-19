const axios = require('axios');

const SEARCH_API = 'https://api.tgoapis.com/web-discovery-apidiscovery-santral/suggestions';
const RESTAURANT_API = 'https://api.tgoapis.com/web-restaurant-apirestaurant-santral/restaurants';

const DEFAULT_LAT = 41.07087;
const DEFAULT_LON = 28.996586;
const MAX_RESTAURANTS = 5;

const AUTH_TOKEN = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJTdGFuZGFyZFVzZXIiOiIwIiwidW5pcXVlX25hbWUiOiJzZWRldjMua2lnQGdtYWlsLmNvbSIsInN1YiI6InNlZGV2My5raWdAZ21haWwuY29tIiwicm9sZSI6InVzZXIiLCJhdHdydG1rIjoiZTZmYTZlNDYtMGQ4ZC0xMWYxLTgzN2UtZjI2MTM2ODIwNThjIiwidXNlcklkIjoiMjQ5NTIzOTgxIiwiZW1haWwiOiJzZWRldjMua2lnQGdtYWlsLmNvbSIsImFwcE5hbWUiOiJsYyIsImF1ZCI6IlVQd1FKT1lqU0xSU3RET1NHVGVHZnVlRXhJQlJhcHpNIiwiZXhwIjoxOTI5MjkxODU0LCJpc3MiOiJhdXRoLnRyZW5keW9sLmNvbSIsIm5iZiI6MTc3MTUwMzg1NH0.G7Gn9CAQM5T8MhQxNfdK7xwDFyBGa6tAv5g1Tyz1IqM';

const COMMON_HEADERS = {
  'accept': 'application/json',
  'origin': 'https://tgoyemek.com',
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'authorization': AUTH_TOKEN
};

/**
 * Fetch a restaurant's menu and return products matching the search query
 */
async function fetchRestaurantProducts(restaurantId, restaurantInfo, query, lat, lon) {
  try {
    const response = await axios.get(`${RESTAURANT_API}/${restaurantId}`, {
      params: { latitude: lat, longitude: lon },
      headers: COMMON_HEADERS,
      timeout: 10000
    });

    const data = response.data?.restaurant;
    if (!data) return [];

    const info = data.info || {};
    const restaurantName = info.name || restaurantInfo.name;
    const restaurantImage = info.imageUrl || restaurantInfo.imageUrl;
    const rating = info.score?.overall || restaurantInfo.rating;
    const eta = info.deliveryInfo?.eta || restaurantInfo.eta;

    const products = [];
    const sections = data.sections || [];
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/);

    for (const section of sections) {
      for (const product of section.products || []) {
        if (!product.active && product.active !== undefined && info.status === 'CLOSED') continue;

        const productName = (product.name || '').toLowerCase();
        const matches = queryWords.some(word => productName.includes(word));
        if (!matches) continue;

        products.push({
          product_name: product.name || '',
          product_price: product.price?.salePrice || null,
          product_image: product.imageUrl || '',
          product_url: `https://tgoyemek.com/restoranlar/${restaurantId}#${section.slug || ''}`,
          restaurant_name: restaurantName,
          restaurant_image: restaurantImage,
          restaurant_rating: rating,
          restaurant_eta: eta,
          eta_minutes: parseInt(eta) || 30,
          source: 'tgoyemek'
        });
      }
    }

    return products;
  } catch (err) {
    console.error(`[tgoyemek] Failed to fetch menu for ${restaurantId}:`, err.message);
    return [];
  }
}

/**
 * Search tgoyemek: find restaurants, fetch their menus, filter products by query
 */
async function searchTgoyemek(query, lat = DEFAULT_LAT, lon = DEFAULT_LON) {
  console.log(`[tgoyemek] Searching for: "${query}" at (${lat}, ${lon})`);

  try {
    // Step 1: Search for restaurants
    const searchResponse = await axios.get(SEARCH_API, {
      params: { text: query, latitude: lat, longitude: lon },
      headers: COMMON_HEADERS,
      timeout: 15000
    });

    const suggestionGroups = searchResponse.data?.suggestions || [];

    // Find the restaurant suggestions (type !== 'TEXT')
    const restaurants = [];
    for (const group of suggestionGroups) {
      if (group.type === 'TEXT') continue;
      for (const item of group.items || []) {
        if (restaurants.length >= MAX_RESTAURANTS) break;
        if (item.status !== 'OPEN') continue;
        restaurants.push({
          id: item.restaurantId,
          name: item.title || '',
          imageUrl: item.imageUrl || '',
          rating: item.rating || 'N/A',
          eta: item.averageDeliveryInterval || '30dk'
        });
      }
    }

    console.log(`[tgoyemek] Found ${restaurants.length} open restaurants, fetching menus...`);

    // Step 2: Fetch menus in parallel and filter by query
    const results = await Promise.all(
      restaurants.map(r => fetchRestaurantProducts(r.id, r, query, lat, lon))
    );
    const allProducts = results.flat();

    console.log(`[tgoyemek] Returning ${allProducts.length} matching products from ${restaurants.length} restaurants`);
    return allProducts;
  } catch (error) {
    console.error('[tgoyemek] Error:', error.message);
    return [];
  }
}

module.exports = { searchTgoyemek };
