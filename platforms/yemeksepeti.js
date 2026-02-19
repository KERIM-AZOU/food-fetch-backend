const axios = require('axios');
const crypto = require('crypto');

const GRAPHQL_API = 'https://tr.fd-api.com/graphql';
const PERSISTED_QUERY_HASH = '93b9ca670837160efbb882589196c597acdd3be370a2c520b799a52728a38495';

const DEFAULT_LAT = 41.076703;
const DEFAULT_LON = 29.010804;

function generatePerseusId() {
  return `${Date.now()}.${Math.floor(Math.random() * 1e18)}.${crypto.randomBytes(5).toString('hex')}`;
}

/**
 * Search Yemeksepeti: return restaurants (not individual products)
 */
async function searchYemeksepeti(query, lat = DEFAULT_LAT, lon = DEFAULT_LON) {
  console.log(`[Yemeksepeti] Searching for: "${query}" at (${lat}, ${lon})`);

  try {
    const perseusId = generatePerseusId();

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

    const restaurants = [];
    for (const component of components) {
      const vd = component.vendorData;
      if (!vd || vd.availability?.status !== 'OPEN') continue;

      const delivery = vd.timeEstimations?.delivery?.duration;
      const etaLower = delivery?.lowerLimitInMinutes;
      const etaUpper = delivery?.upperLimitInMinutes;
      const etaMinutes = etaLower || etaUpper || 30;
      const restaurantEta = etaLower && etaUpper
        ? `${etaLower}-${etaUpper} mins`
        : `${etaMinutes} mins`;

      restaurants.push({
        restaurant_name: vd.name || '',
        restaurant_image: vd.images?.listing || vd.images?.logo || '',
        restaurant_rating: vd.vendorRating?.value || 'N/A',
        restaurant_eta: restaurantEta,
        eta_minutes: etaMinutes,
        restaurant_url: `https://www.yemeksepeti.com/restaurant/${vd.urlKey || ''}`,
        source: 'Yemeksepeti'
      });
    }

    console.log(`[Yemeksepeti] Returning ${restaurants.length} restaurants`);
    return restaurants;
  } catch (error) {
    console.error('[Yemeksepeti] Error:', error.message);
    if (error.response) {
      console.error('[Yemeksepeti] Response:', error.response.status, JSON.stringify(error.response.data)?.slice(0, 500));
    }
    return [];
  }
}

module.exports = { searchYemeksepeti };
