const Coupon = require('../models/Coupon');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');

// @desc    Create a coupon (admin)
// @route   POST /api/coupons
// @access  Private/Admin
exports.createCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.create({ ...req.body, code: req.body.code?.toUpperCase() });
  res.status(201).json({ success: true, coupon });
});

// @desc    Get all coupons (admin)
// @route   GET /api/coupons
// @access  Private/Admin
exports.getCoupons = asyncHandler(async (req, res) => {
  const coupons = await Coupon.find().sort('-createdAt');
  res.status(200).json({ success: true, coupons });
});

// @desc    Delete a coupon (admin)
// @route   DELETE /api/coupons/:id
// @access  Private/Admin
exports.deleteCoupon = asyncHandler(async (req, res, next) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) return next(new ErrorResponse('Coupon not found', 404));
  await coupon.deleteOne();
  res.status(200).json({ success: true, message: 'Coupon removed' });
});

// @desc    Validate a coupon code against a cart subtotal and return the discount
// @route   POST /api/coupons/apply
// @access  Private
exports.applyCoupon = asyncHandler(async (req, res, next) => {
  const { code, subtotal } = req.body;
  const coupon = await Coupon.findOne({ code: code?.toUpperCase(), isActive: true });

  if (!coupon) return next(new ErrorResponse('Invalid coupon code', 404));
  if (coupon.expiryDate < Date.now()) return next(new ErrorResponse('Coupon has expired', 400));
  if (Number(subtotal) < coupon.minPurchase) {
    return next(new ErrorResponse(`Minimum purchase of $${coupon.minPurchase} required`, 400));
  }

  const discount =
    coupon.discountType === 'percentage'
      ? (Number(subtotal) * coupon.discountValue) / 100
      : coupon.discountValue;

  res.status(200).json({
    success: true,
    coupon: { code: coupon.code, discountType: coupon.discountType, discountValue: coupon.discountValue },
    discount: Math.min(discount, Number(subtotal)),
  });
});
