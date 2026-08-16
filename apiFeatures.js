// Builds a MongoDB filter object for product listing from query params, e.g.
// GET /api/products?keyword=shoe&category=Fashion&minPrice=10&maxPrice=100&rating=4
const buildProductFilter = (query) => {
  const filter = {};

  if (query.keyword) {
    filter.name = { $regex: query.keyword, $options: 'i' };
  }
  if (query.category && query.category !== 'All') {
    filter.category = query.category;
  }
  if (query.minPrice || query.maxPrice) {
    filter.price = {};
    if (query.minPrice) filter.price.$gte = Number(query.minPrice);
    if (query.maxPrice) filter.price.$lte = Number(query.maxPrice);
  }
  if (query.rating) {
    filter.rating = { $gte: Number(query.rating) };
  }
  if (query.inStock === 'true') {
    filter.stock = { $gt: 0 };
  }

  return filter;
};

// Maps a friendly sort key to a Mongoose sort string.
const getSortOption = (sort) => {
  const map = {
    price_asc: 'price',
    price_desc: '-price',
    newest: '-createdAt',
    oldest: 'createdAt',
    rating: '-rating',
    name_asc: 'name',
  };
  return map[sort] || '-createdAt';
};

const getPagination = (query, defaultLimit = 12) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.max(Number(query.limit) || defaultLimit, 1);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

module.exports = { buildProductFilter, getSortOption, getPagination };
