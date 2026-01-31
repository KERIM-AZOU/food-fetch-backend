function normalizeProductName(name) {
  if (!name) return '';
  return name.toLowerCase().trim().split(/\s+/).join(' ');
}

function normalizeRestaurantName(name) {
  if (!name) return '';
  return name.toLowerCase().trim();
}

function groupProductsBySimilarity(products, sortBy = 'price') {
  if (!products || !products.length) return [];

  // Step 1: Group by restaurant (case-insensitive)
  const restaurantGroups = {};
  for (const product of products) {
    const key = normalizeRestaurantName(product.restaurant_name);
    if (!key) continue;
    if (!restaurantGroups[key]) restaurantGroups[key] = [];
    restaurantGroups[key].push(product);
  }

  // Step 2: Within each restaurant, group identical products
  const resultGroups = [];

  for (const [restaurantKey, restaurantProducts] of Object.entries(restaurantGroups)) {
    const productNameGroups = {};

    for (const product of restaurantProducts) {
      const normalizedName = normalizeProductName(product.product_name);
      if (!normalizedName) continue;
      if (!productNameGroups[normalizedName]) productNameGroups[normalizedName] = [];
      productNameGroups[normalizedName].push(product);
    }

    // Step 3: Create comparison groups
    for (const [normalizedName, group] of Object.entries(productNameGroups)) {
      const variants = group.map(p => ({
        source: p.source,
        price: p.product_price,
        product_url: p.product_url,
        product_image: p.product_image,
        restaurant_rating: p.restaurant_rating,
        restaurant_eta: p.restaurant_eta,
        eta_minutes: p.eta_minutes,
        is_lowest: false
      }));

      // Sort variants by price (nulls last)
      variants.sort((a, b) => {
        if (a.price === null) return 1;
        if (b.price === null) return -1;
        return a.price - b.price;
      });

      // Find and mark lowest price
      const lowestPrice = variants.find(v => v.price !== null)?.price || null;
      variants.forEach(v => {
        if (v.price === lowestPrice && lowestPrice !== null) {
          v.is_lowest = true;
        }
      });

      // Use longest product name as representative
      const representativeName = group
        .map(p => p.product_name)
        .reduce((a, b) => a.length >= b.length ? a : b);

      resultGroups.push({
        product_name: representativeName,
        restaurant_name: group[0].restaurant_name,
        restaurant_image: group[0].restaurant_image,
        product_image: variants[0]?.product_image,
        variants,
        lowest_price: lowestPrice,
        platform_count: variants.length,
        has_comparison: variants.length > 1
      });
    }
  }

  // Step 4: Sort results - ALWAYS prioritize multi-platform items first
  resultGroups.sort((a, b) => {
    // Primary sort: products available on multiple platforms come first
    if (b.platform_count !== a.platform_count) {
      return b.platform_count - a.platform_count;
    }

    // Secondary sort based on sortBy parameter
    if (sortBy === 'price') {
      if (a.lowest_price === null) return 1;
      if (b.lowest_price === null) return -1;
      return a.lowest_price - b.lowest_price;
    } else if (sortBy === 'distance') {
      const etaA = a.variants[0]?.eta_minutes ?? 999;
      const etaB = b.variants[0]?.eta_minutes ?? 999;
      return etaA - etaB;
    }

    return 0;
  });

  return resultGroups;
}

function applyFilters(products, filters = {}) {
  const { price_min, price_max, time_min, time_max, restaurant_filter, platforms } = filters;

  return products.filter(product => {
    // Platform filter
    if (platforms && platforms.length > 0) {
      if (!platforms.includes(product.source.toLowerCase())) {
        return false;
      }
    }

    // Price filter
    if (price_min !== undefined && product.product_price !== null) {
      if (product.product_price < price_min) return false;
    }
    if (price_max !== undefined && product.product_price !== null) {
      if (product.product_price > price_max) return false;
    }

    // Time filter
    if (time_min !== undefined && product.eta_minutes < time_min) return false;
    if (time_max !== undefined && product.eta_minutes > time_max) return false;

    // Restaurant filter
    if (restaurant_filter && restaurant_filter.trim()) {
      const normalizedFilter = restaurant_filter.toLowerCase().trim();
      const normalizedRestaurant = (product.restaurant_name || '').toLowerCase();
      if (!normalizedRestaurant.includes(normalizedFilter)) return false;
    }

    return true;
  });
}

function paginateResults(products, page = 1, perPage = 12) {
  const totalProducts = products.length;
  const totalPages = Math.ceil(totalProducts / perPage);
  const startIndex = (page - 1) * perPage;
  const endIndex = startIndex + perPage;
  const paginatedProducts = products.slice(startIndex, endIndex);

  return {
    products: paginatedProducts,
    pagination: {
      current_page: page,
      per_page: perPage,
      total_products: totalProducts,
      total_pages: totalPages,
      has_next: page < totalPages,
      has_prev: page > 1
    }
  };
}

function getAllRestaurants(products) {
  const restaurants = new Set();
  for (const product of products) {
    if (product.restaurant_name) {
      restaurants.add(product.restaurant_name);
    }
  }
  return Array.from(restaurants).sort();
}

module.exports = {
  groupProductsBySimilarity,
  applyFilters,
  paginateResults,
  getAllRestaurants,
  normalizeProductName,
  normalizeRestaurantName
};
