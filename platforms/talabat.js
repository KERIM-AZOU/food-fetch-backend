const axios = require('axios');

const TALABAT_API_ENDPOINT = 'https://www.talabat.com/nextSearchApi/v3/vendor';

async function searchTalabat(query, lat = 25.2855, lon = 51.5314) {
  console.log(`[Talabat] Searching for: "${query}" at (${lat}, ${lon})`);

  try {
    const headers = {
      'accept': 'application/json, text/plain, */*',
      'accept-language': 'en-US,en;q=0.9',
      'appbrand': '1',
      'content-type': 'application/json',
      'origin': 'https://www.talabat.com',
      'referer': 'https://www.talabat.com/qatar',
      'sourceapp': 'web',
      'x-device-source': '0',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };

    const payload = {
      latitude: lat,
      longitude: lon,
      query: query,
      vertical_ids: [0, 1, 2, 3, 4, 5, 6],
      limit: 150,
      country_id: 6,
      page_number: 0,
      sort: { by: 'RELEVANCE', order: 'ASC' }
    };

    const response = await axios.post(TALABAT_API_ENDPOINT, payload, {
      headers,
      timeout: 15000
    });

    console.log(`[Talabat] Response status: ${response.status}`);

    const products = [];
    const vendors = response.data?.result?.vendors || response.data?.vendors || [];

    console.log(`[Talabat] Found ${vendors.length} vendors`);

    for (const vendor of vendors) {
      const vendorName = vendor.vendor_name || vendor.name || '';
      const vendorId = vendor.vendor_id || vendor.id || '';
      let vendorImage = vendor.vendor_image || vendor.logo || '';

      if (vendorImage && !vendorImage.startsWith('http')) {
        vendorImage = `https://images.deliveryhero.io/image/talabat/restaurants/${vendorImage}`;
      }

      let rating = vendor.total_ratings || vendor.rating || 'N/A';
      if (typeof rating === 'string' && rating.length >= 2) {
        rating = parseInt(rating.slice(0, 2)) / 10;
      }

      const pickupTime = vendor.pickup_time || vendor.delivery_time || 30;
      const restaurantEta = `${pickupTime} mins`;

      const vendorProducts = vendor.products || [];
      for (const product of vendorProducts) {
        const productName = product.name || '';
        const productPrice = product.price || null;
        let productImage = product.image || '';

        if (productImage && !productImage.startsWith('http')) {
          productImage = `https://images.deliveryhero.io/image/talabat/products/${productImage}`;
        }

        const vendorSlug = vendorName.toLowerCase().replace(/ /g, '-');
        const productUrl = `https://www.talabat.com/qatar/restaurant/${vendorId}/${vendorSlug}?aid=3855`;

        products.push({
          product_name: productName,
          product_price: productPrice,
          product_image: productImage,
          product_url: productUrl,
          restaurant_name: vendorName,
          restaurant_image: vendorImage,
          restaurant_rating: rating,
          restaurant_eta: restaurantEta,
          eta_minutes: pickupTime,
          source: 'Talabat'
        });
      }
    }

    console.log(`[Talabat] Returning ${products.length} products`);
    return products;
  } catch (error) {
    console.error('[Talabat] Error:', error.message);
    if (error.response) {
      console.error('[Talabat] Response status:', error.response.status);
    }
    return [];
  }
}

module.exports = {
  searchTalabat
};
