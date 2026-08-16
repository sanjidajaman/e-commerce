const Cart = require('../models/Cart');
const Product = require('../models/Product');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');

const getOrCreateCart = async (userId) => {
  let cart = await Cart.findOne({ user: userId });
  if (!cart) {
    cart = await Cart.create({ user: userId, items: [] });
  }
  return cart;
};

// @desc    Get the logged-in user's saved cart
// @route   GET /api/cart
// @access  Private
exports.getCart = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);
  await cart.populate('items.product');
  res.status(200).json({ success: true, cart });
});

// @desc    Add an item to the cart (bumps quantity if it's already there)
// @route   POST /api/cart
// @access  Private
exports.addToCart = asyncHandler(async (req, res, next) => {
  const { productId, quantity = 1 } = req.body;

  const product = await Product.findById(productId);
  if (!product) return next(new ErrorResponse('Product not found', 404));
  if (product.stock < 1) return next(new ErrorResponse('Product is out of stock', 400));

  const cart = await getOrCreateCart(req.user._id);
  const existing = cart.items.find((i) => i.product.toString() === productId);

  if (existing) {
    existing.quantity = Math.min(existing.quantity + Number(quantity), product.stock);
  } else {
    cart.items.push({ product: productId, quantity: Math.min(Number(quantity), product.stock) });
  }

  await cart.save();
  await cart.populate('items.product');
  res.status(200).json({ success: true, cart });
});

// @desc    Set the quantity of a cart item (removes it if quantity <= 0)
// @route   PUT /api/cart/:productId
// @access  Private
exports.updateCartItem = asyncHandler(async (req, res, next) => {
  const { quantity } = req.body;
  const cart = await getOrCreateCart(req.user._id);
  const item = cart.items.find((i) => i.product.toString() === req.params.productId);

  if (!item) return next(new ErrorResponse('Item not in cart', 404));

  if (Number(quantity) <= 0) {
    cart.items = cart.items.filter((i) => i.product.toString() !== req.params.productId);
  } else {
    const product = await Product.findById(req.params.productId);
    item.quantity = product ? Math.min(Number(quantity), product.stock) : Number(quantity);
  }

  await cart.save();
  await cart.populate('items.product');
  res.status(200).json({ success: true, cart });
});

// @desc    Remove one item from the cart
// @route   DELETE /api/cart/:productId
// @access  Private
exports.removeCartItem = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);
  cart.items = cart.items.filter((i) => i.product.toString() !== req.params.productId);
  await cart.save();
  await cart.populate('items.product');
  res.status(200).json({ success: true, cart });
});

// @desc    Empty the cart
// @route   DELETE /api/cart
// @access  Private
exports.clearCart = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);
  cart.items = [];
  await cart.save();
  res.status(200).json({ success: true, cart });
});
