const axios = require('axios');

const RAFEEQ_API_ENDPOINT = 'https://www.gorafeeq.com/api/general';

async function searchRafeeq(query, lat = 25.2855, lon = 51.5314) {
  console.log(`[Rafeeq] Searching for: "${query}" at (${lat}, ${lon})`);

  try {
    const headers = {
      'content-type': 'application/json',
      'accept': 'application/json, text/plain, */*',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'origin': 'https://www.gorafeeq.com',
      'referer': 'https://www.gorafeeq.com/'
    };

    const payload = {
      payload: {
        search: query,
        latitude: lat,
        longitude: lon,
        its_from_landing_page: true,
        country_code: 1,
        currency_code: 'QAR',
        AppVersion: '3.4.24',
        language_id: 0,
        location_id: null,
        platform_id: 1
      },
      method: 'POST',
      endpoint: 'customer/v2/search'
    };

    const response = await axios.post(RAFEEQ_API_ENDPOINT, payload, {
      headers,
      timeout: 15000
    });

    console.log(`[Rafeeq] Response status: ${response.status}`);

    const products = [];
    const items = response.data?.items || response.data?.data?.items || [];

    console.log(`[Rafeeq] Found ${items.length} items`);

    for (const item of items) {
      const restaurantName = item.name_english || item.name || '';
      const restaurantImage = item.image || '';
      const restaurantRating = item.rating || 'N/A';
      const eta = item.eta || '30 mins';
      const etaMinutes = parseInt(eta) || 30;

      const itemProducts = item.products || [];
      for (const product of itemProducts) {
        const productName = product.name_english || product.name || '';
        const productPrice = product.product_price || null;
        const productImage = product.product_img || '';

        let productUrl = null;
        if (product.share_product_message) {
          const urlMatch = product.share_product_message.match(/https:\/\/[^\s]+/);
          productUrl = urlMatch ? urlMatch[0] : null;
        }

        products.push({
          product_name: productName,
          product_price: productPrice,
          product_image: productImage,
          product_url: productUrl,
          restaurant_name: restaurantName,
          restaurant_image: restaurantImage,
          restaurant_rating: restaurantRating,
          restaurant_eta: eta,
          eta_minutes: etaMinutes,
          source: 'Rafeeq'
        });
      }
    }

    console.log(`[Rafeeq] Returning ${products.length} products`);
    return products;
  } catch (error) {
    console.error('[Rafeeq] Error:', error.message);
    if (error.response) {
      console.error('[Rafeeq] Response status:', error.response.status);
    }
    return [];
  }
}

module.exports = {
  searchRafeeq
};
