const axios = require('axios');
const crypto = require('crypto');

const GRAPHQL_API = 'https://tr.fd-api.com/graphql';
const VENDOR_API = 'https://tr.fd-api.com/api/v5/vendors';
const PERSISTED_QUERY_HASH = '93b9ca670837160efbb882589196c597acdd3be370a2c520b799a52728a38495';

const DEFAULT_LAT = 41.076703;
const DEFAULT_LON = 29.010804;
const MAX_VENDORS_TO_FETCH = 5;

function generatePerseusId() {
  return `${Date.now()}.${Math.floor(Math.random() * 1e18)}.${crypto.randomBytes(5).toString('hex')}`;
}

/**
 * Fetch a single vendor's menu and return its products
 */
async function fetchVendorMenu(vendorCode, vendorInfo, lat, lon, perseusId) {
  try {
    const response = await axios.get(`${VENDOR_API}/${vendorCode}`, {
      params: {
        include: 'menus',
        language_id: 2,
        opening_type: 'delivery',
        basket_currency: 'TRY',
        latitude: lat,
        longitude: lon
      },
      headers: {
        'accept': 'application/json',
        'api-version': '7',
        'x-fp-api-key': 'volo',
        'x-pd-language-id': '2',
        'perseus-client-id': perseusId,
        'perseus-session-id': perseusId,
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    const vendor = response.data?.data;
    if (!vendor) return [];

    const restaurantName = vendor.name || vendorInfo.name;
    const restaurantImage = vendor.hero_listing_image || vendor.hero_image || vendorInfo.image;
    const rating = vendor.rating || vendorInfo.rating;
    const etaRange = vendor.delivery_duration_range;
    const etaLower = etaRange?.lower_limit_in_minutes || 0;
    const etaUpper = etaRange?.upper_limit_in_minutes || 0;
    const etaMinutes = etaLower || etaUpper || vendorInfo.etaMinutes;
    const restaurantEta = etaLower && etaUpper
      ? `${etaLower}-${etaUpper} mins`
      : `${etaMinutes} mins`;
    const urlKey = vendor.url_key || vendorInfo.urlKey;

    const products = [];
    const menus = vendor.menus || [];

    for (const menu of menus) {
      for (const category of menu.menu_categories || []) {
        for (const product of category.products || []) {
          if (product.is_sold_out) continue;

          const variation = product.product_variations?.[0];
          const price = variation?.price || null;
          let image = product.file_path || '';
          if (image.includes('%s')) {
            image = image.replace('%s', '400');
          }

          products.push({
            product_name: product.name || '',
            product_price: price,
            product_image: image,
            product_url: `https://www.yemeksepeti.com/restaurant/${urlKey}`,
            restaurant_name: restaurantName,
            restaurant_image: restaurantImage,
            restaurant_rating: rating,
            restaurant_eta: restaurantEta,
            eta_minutes: etaMinutes,
            source: 'Yemeksepeti'
          });
        }
      }
    }

    return products;
  } catch (err) {
    console.error(`[Yemeksepeti] Failed to fetch menu for ${vendorCode}:`, err.message);
    return [];
  }
}

/**
 * Search Yemeksepeti: find restaurants via GraphQL, then fetch menus for top 20
 */
async function searchYemeksepeti(query, lat = DEFAULT_LAT, lon = DEFAULT_LON) {
  console.log(`[Yemeksepeti] Searching for: "${query}" at (${lat}, ${lon})`);

  try {
    const perseusId = generatePerseusId();

    // Step 1: Search for restaurants
    const searchResponse = await axios.post(GRAPHQL_API, {
      extensions: {
        persistedQuery: { sha256Hash: PERSISTED_QUERY_HASH, version: 1 }
      },
      variables: {
        searchResultsParams: {
          query,
          latitude: lat,
          longitude: lon,
          locale: 'tr_TR',
          languageId: 2,
          expeditionType: 'DELIVERY',
          customerType: 'B2C',
          verticalTypes: ['RESTAURANTS']
        },
        skipQueryCorrection: true
      }
    }, {
      headers: {
        'accept': 'application/json',
        'apollographql-client-name': 'web',
        'apollographql-client-version': 'VENDOR-LIST-MICROFRONTEND.26.07.0026',
        'content-type': 'application/json',
        'customer-latitude': String(lat),
        'customer-longitude': String(lon),
        'display-context': 'SEARCH',
        'locale': 'tr_TR',
        'platform': 'web',
        'x-fp-api-key': 'volo',
        'perseus-client-id': perseusId,
        'perseus-session-id': perseusId,
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      },
      timeout: 15000
    });

    const components = searchResponse.data?.data?.searchPage?.components || [];
    console.log(`[Yemeksepeti] Found ${components.length} restaurants`);

    // Step 2: Take top open restaurants
    const vendors = [];
    for (const component of components) {
      if (vendors.length >= MAX_VENDORS_TO_FETCH) break;
      const vd = component.vendorData;
      if (!vd || vd.availability?.status !== 'OPEN') continue;

      const delivery = vd.timeEstimations?.delivery?.duration;
      vendors.push({
        code: vd.code,
        name: vd.name || '',
        urlKey: vd.urlKey || '',
        image: vd.images?.listing || vd.images?.logo || '',
        rating: vd.vendorRating?.value || 'N/A',
        etaMinutes: delivery?.lowerLimitInMinutes || delivery?.upperLimitInMinutes || 30
      });
    }

    console.log(`[Yemeksepeti] Fetching menus for ${vendors.length} restaurants...`);

    // Step 3: Fetch all menus in parallel
    const results = await Promise.all(
      vendors.map(v => fetchVendorMenu(v.code, v, lat, lon, perseusId))
    );
    const allProducts = results.flat();

    console.log(`[Yemeksepeti] Returning ${allProducts.length} products from ${vendors.length} restaurants`);
    return allProducts;
  } catch (error) {
    console.error('[Yemeksepeti] Error:', error.message);
    if (error.response) {
      console.error('[Yemeksepeti] Response:', error.response.status, JSON.stringify(error.response.data)?.slice(0, 500));
    }
    return [];
  }
}

module.exports = { searchYemeksepeti };
