const axios = require('axios');
const crypto = require('crypto');

const SNOONU_API_ENDPOINT = 'https://admin.snoonu.com/api/v5/search/global';

async function searchSnoonu(query, lat = 25.2855, lon = 51.5314) {
  try {
    const headers = {
      'appversion': '3.0.0',
      'deviceid': `web-${crypto.randomUUID()}`,
      'latitude': lat.toString(),
      'longitude': lon.toString(),
      'snoonu-app-platform': 'Web',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };

    const params = {
      page: '0',
      page_size: '150',
      product_size: '110',
      category_id: 62,
      term: query
    };

    const response = await axios.get(SNOONU_API_ENDPOINT, {
      headers,
      params,
      timeout: 10000
    });

    const products = [];
    const merchants = response.data?.data?.merchants || [];

    for (const merchant of merchants) {
      const timeValueRaw = merchant.time_value;
      const timeUnitRaw = merchant.time_unit;
      const restaurantEta = `${timeValueRaw} ${timeUnitRaw}`;

      let etaMinutes = 999;
      if (timeValueRaw) {
        try {
          const timeValue = parseInt(timeValueRaw, 10);
          const timeUnit = timeUnitRaw ? timeUnitRaw.toLowerCase() : '';
          if (!isNaN(timeValue)) {
            if (timeUnit.includes('hour')) {
              etaMinutes = timeValue * 60;
            } else {
              etaMinutes = timeValue;
            }
          }
        } catch (e) {
          // Keep default etaMinutes = 999
        }
      }

      const restaurantName = merchant.name || '';

      for (const product of merchant.products || []) {
        const productName = product.name || '';

        let productUrl = null;
        if (productName) {
          const searchQuery = encodeURIComponent(productName) + "%20" + encodeURIComponent(restaurantName);
          productUrl = `https://snoonu.com/search?q=${searchQuery}`;
        }

        const rawPrice = product.price_without_discount || product.price;
        let price = null;
        if (rawPrice) {
          try {
            price = parseFloat(rawPrice);
          } catch (e) {
            price = null;
          }
        }

        products.push({
          product_name: productName,
          product_price: price,
          product_image: product.image_url,
          restaurant_name: restaurantName,
          restaurant_image: merchant.image_url,
          restaurant_rating: merchant.rating,
          restaurant_eta: restaurantEta,
          eta_minutes: etaMinutes,
          source: 'Snoonu',
          product_url: productUrl,
        });
      }
    }
    return products;
  } catch (error) {
    console.error(`Snoonu processing failed: ${error.message}`);
    return [];
  }
}

module.exports = {
  searchSnoonu
};
