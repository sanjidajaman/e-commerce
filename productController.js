const Product = require('../models/Product');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');
const { buildProductFilter, getSortOption, getPagination } = require('../utils/apiFeatures');

// @desc    Get products - supports ?keyword=&category=&minPrice=&maxPrice=
//          &rating=&inStock=&sort=&page=&limit=
// @route   GET /api/products
// @access  Public
exports.getProducts = asyncHandler(async (req, res) => {
  const filter = buildProductFilter(req.query);
  const sort = getSortOption(req.query.sort);
  const { page, limit, skip } = getPagination(req.query);

  const [products, total] = await Promise.all([
    Product.find(filter).sort(sort).skip(skip).limit(limit),
    Product.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    count: products.length,
    total,
    page,
    pages: Math.ceil(total / limit) || 1,
    products,
  });
});

// @desc    Get top-rated products (used on the landing page)
// @route   GET /api/products/top
// @access  Public
exports.getTopProducts = asyncHandler(async (req, res) => {
  const limit = Number(req.query.limit) || 8;
  const products = await Product.find({}).sort({ rating: -1, numReviews: -1 }).limit(limit);
  res.status(200).json({ success: true, products });
});

// @desc    Get the distinct list of categories currently in use
// @route   GET /api/products/categories
// @access  Public
exports.getCategories = asyncHandler(async (req, res) => {
  const categories = await Product.distinct('category');
  res.status(200).json({ success: true, categories: categories.sort() });
});

// @desc    Get a single product, plus a few related products
// @route   GET /api/products/:id
// @access  Public
exports.getProductById = asyncHandler(async (req, res, next) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    return next(new ErrorResponse('Product not found', 404));
  }

  const relatedProducts = await Product.find({
    category: product.category,
    _id: { $ne: product._id },
  }).limit(4);

  res.status(200).json({ success: true, product, relatedProducts });
});

// @desc    Create a product
// @route   POST /api/products
// @access  Private/Admin
exports.createProduct = asyncHandler(async (req, res) => {
  const product = await Product.create({ ...req.body, user: req.user._id });
  res.status(201).json({ success: true, product });
});

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Private/Admin
exports.updateProduct = asyncHandler(async (req, res, next) => {
  const exists = await Product.findById(req.params.id);
  if (!exists) {
    return next(new ErrorResponse('Product not found', 404));
  }

  const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({ success: true, product });
});

// @desc    Delete a product
// @route   DELETE /api/products/:id
// @access  Private/Admin
exports.deleteProduct = asyncHandler(async (req, res, next) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    return next(new ErrorResponse('Product not found', 404));
  }

  await product.deleteOne();
  res.status(200).json({ success: true, message: 'Product removed' });
});

// @desc    Add a review to a product (one review per user)
// @route   POST /api/products/:id/reviews
// @access  Private
exports.createProductReview = asyncHandler(async (req, res, next) => {
  const { rating, comment } = req.body;
  const product = await Product.findById(req.params.id);

  if (!product) {
    return next(new ErrorResponse('Product not found', 404));
  }

  const alreadyReviewed = product.reviews.find(
    (r) => r.user.toString() === req.user._id.toString()
  );
  if (alreadyReviewed) {
    return next(new ErrorResponse('You have already reviewed this product', 400));
  }

  product.reviews.push({
    user: req.user._id,
    name: req.user.name,
    rating: Number(rating),
    comment,
  });

  product.numReviews = product.reviews.length;
  product.rating = product.reviews.reduce((acc, r) => acc + r.rating, 0) / product.reviews.length;

  await product.save();
  res.status(201).json({ success: true, message: 'Review added', reviews: product.reviews });
});

// @desc    Delete a review (owner or admin)
// @route   DELETE /api/products/:id/reviews/:reviewId
// @access  Private
exports.deleteProductReview = asyncHandler(async (req, res, next) => {
  const product = await Product.findById(req.params.id);
  if (!product) return next(new ErrorResponse('Product not found', 404));

  const review = product.reviews.id(req.params.reviewId);
  if (!review) return next(new ErrorResponse('Review not found', 404));

  if (review.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to delete this review', 403));
  }

  review.deleteOne();
  product.numReviews = product.reviews.length;
  product.rating = product.reviews.length
    ? product.reviews.reduce((acc, r) => acc + r.rating, 0) / product.reviews.length
    : 0;

  await product.save();
  res.status(200).json({ success: true, message: 'Review removed' });
});
