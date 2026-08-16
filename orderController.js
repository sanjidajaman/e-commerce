const Order = require('../models/Order');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const Coupon = require('../models/Coupon');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');

const SHIPPING_FLAT_RATE = 5;
const FREE_SHIPPING_THRESHOLD = 100;
const TAX_RATE = 0.08;

// @desc    Create a new order from the submitted cart items. Prices and
//          stock are always re-validated against the database - the client
//          is never trusted for money-affecting values.
// @route   POST /api/orders
// @access  Private
exports.createOrder = asyncHandler(async (req, res, next) => {
  const { orderItems, shippingAddress, paymentMethod, couponCode } = req.body;

  if (!orderItems || orderItems.length === 0) {
    return next(new ErrorResponse('No order items provided', 400));
  }
  if (!shippingAddress) {
    return next(new ErrorResponse('Shipping address is required', 400));
  }

  let itemsPrice = 0;
  const validatedItems = [];

  for (const item of orderItems) {
    const product = await Product.findById(item.product);
    if (!product) {
      return next(new ErrorResponse(`Product not found: ${item.product}`, 404));
    }
    if (product.stock < item.qty) {
      return next(new ErrorResponse(`Insufficient stock for ${product.name}`, 400));
    }

    itemsPrice += product.price * item.qty;
    validatedItems.push({
      product: product._id,
      name: product.name,
      image: product.image,
      price: product.price,
      qty: item.qty,
    });
  }

  let discount = 0;
  let couponApplied;
  if (couponCode) {
    const coupon = await Coupon.findOne({ code: couponCode.toUpperCase(), isActive: true });
    if (coupon && coupon.expiryDate > Date.now() && itemsPrice >= coupon.minPurchase) {
      discount =
        coupon.discountType === 'percentage'
          ? (itemsPrice * coupon.discountValue) / 100
          : coupon.discountValue;
      discount = Math.min(discount, itemsPrice);
      couponApplied = { code: coupon.code, discount };
    }
  }

  const shippingPrice = itemsPrice - discount >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FLAT_RATE;
  const taxPrice = Number(((itemsPrice - discount) * TAX_RATE).toFixed(2));
  const totalPrice = Number((itemsPrice - discount + shippingPrice + taxPrice).toFixed(2));

  const order = await Order.create({
    user: req.user._id,
    orderItems: validatedItems,
    shippingAddress,
    paymentMethod,
    itemsPrice,
    shippingPrice,
    taxPrice,
    totalPrice,
    couponApplied,
    // No real payment gateway is wired up (none was specified) - Card/PayPal
    // are treated as already "paid" for demo purposes, COD stays pending.
    paymentStatus: paymentMethod === 'COD' ? 'pending' : 'paid',
  });

  for (const item of validatedItems) {
    await Product.findByIdAndUpdate(item.product, {
      $inc: { stock: -item.qty, sold: item.qty },
    });
  }

  await Cart.findOneAndUpdate({ user: req.user._id }, { items: [] });

  res.status(201).json({ success: true, order });
});

// @desc    Get one order by id (owner or admin only)
// @route   GET /api/orders/:id
// @access  Private
exports.getOrderById = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id).populate('user', 'name email');
  if (!order) return next(new ErrorResponse('Order not found', 404));

  if (order.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to view this order', 403));
  }

  res.status(200).json({ success: true, order });
});

// @desc    Get the logged-in user's order history
// @route   GET /api/orders/my-orders
// @access  Private
exports.getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort('-createdAt');
  res.status(200).json({ success: true, count: orders.length, orders });
});

// @desc    Get all orders, optionally filtered by status (admin)
// @route   GET /api/orders?status=&page=&limit=
// @access  Private/Admin
exports.getAllOrders = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.orderStatus = req.query.status;

  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.max(Number(req.query.limit) || 20, 1);
  const skip = (page - 1) * limit;

  const [orders, total] = await Promise.all([
    Order.find(filter).populate('user', 'name email').sort('-createdAt').skip(skip).limit(limit),
    Order.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    count: orders.length,
    total,
    page,
    pages: Math.ceil(total / limit) || 1,
    orders,
  });
});

// @desc    Update an order's status (admin)
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
exports.updateOrderStatus = asyncHandler(async (req, res, next) => {
  const { orderStatus, paymentStatus } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) return next(new ErrorResponse('Order not found', 404));

  if (orderStatus) order.orderStatus = orderStatus;
  if (paymentStatus) order.paymentStatus = paymentStatus;
  if (orderStatus === 'Delivered') {
    order.isDelivered = true;
    order.deliveredAt = Date.now();
  }

  await order.save();
  res.status(200).json({ success: true, order });
});

// @desc    Sales statistics for the admin dashboard
// @route   GET /api/orders/stats/summary
// @access  Private/Admin
exports.getSalesStats = asyncHandler(async (req, res) => {
  const [totals] = await Order.aggregate([
    { $match: { paymentStatus: 'paid' } },
    { $group: { _id: null, totalRevenue: { $sum: '$totalPrice' }, totalOrders: { $sum: 1 } } },
  ]);

  const ordersByStatus = await Order.aggregate([
    { $group: { _id: '$orderStatus', count: { $sum: 1 } } },
  ]);

  const revenueByDay = await Order.aggregate([
    { $match: { paymentStatus: 'paid' } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        revenue: { $sum: '$totalPrice' },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $limit: 30 },
  ]);

  const topProducts = await Order.aggregate([
    { $unwind: '$orderItems' },
    {
      $group: {
        _id: '$orderItems.product',
        name: { $first: '$orderItems.name' },
        totalSold: { $sum: '$orderItems.qty' },
        revenue: { $sum: { $multiply: ['$orderItems.price', '$orderItems.qty'] } },
      },
    },
    { $sort: { totalSold: -1 } },
    { $limit: 5 },
  ]);

  res.status(200).json({
    success: true,
    stats: {
      totalRevenue: totals?.totalRevenue || 0,
      totalOrders: totals?.totalOrders || 0,
      ordersByStatus,
      revenueByDay,
      topProducts,
    },
  });
});
