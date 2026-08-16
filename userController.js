const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');

// @desc    Get all users (admin)
// @route   GET /api/users
// @access  Private/Admin
exports.getUsers = asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.max(Number(req.query.limit) || 20, 1);
  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    User.find().sort('-createdAt').skip(skip).limit(limit),
    User.countDocuments(),
  ]);

  res.status(200).json({
    success: true,
    count: users.length,
    total,
    page,
    pages: Math.ceil(total / limit) || 1,
    users,
  });
});

// @desc    Get a single user (admin)
// @route   GET /api/users/:id
// @access  Private/Admin
exports.getUserById = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id);
  if (!user) return next(new ErrorResponse('User not found', 404));
  res.status(200).json({ success: true, user });
});

// @desc    Update a user's details/role (admin)
// @route   PUT /api/users/:id
// @access  Private/Admin
exports.updateUser = asyncHandler(async (req, res, next) => {
  const { name, email, role } = req.body;
  const user = await User.findById(req.params.id);
  if (!user) return next(new ErrorResponse('User not found', 404));

  if (name) user.name = name;
  if (email) user.email = email;
  if (role) user.role = role;

  await user.save();
  res.status(200).json({ success: true, user });
});

// @desc    Delete a user (admin)
// @route   DELETE /api/users/:id
// @access  Private/Admin
exports.deleteUser = asyncHandler(async (req, res, next) => {
  if (req.params.id === req.user._id.toString()) {
    return next(new ErrorResponse('You cannot delete your own account here', 400));
  }

  const user = await User.findById(req.params.id);
  if (!user) return next(new ErrorResponse('User not found', 404));

  await user.deleteOne();
  res.status(200).json({ success: true, message: 'User removed' });
});

// @desc    Get the logged-in user's wishlist
// @route   GET /api/users/wishlist
// @access  Private
exports.getWishlist = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate('wishlist');
  res.status(200).json({ success: true, wishlist: user.wishlist });
});

// @desc    Add/remove a product from the logged-in user's wishlist
// @route   POST /api/users/wishlist/:productId
// @access  Private
exports.toggleWishlist = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const { productId } = req.params;
  const index = user.wishlist.findIndex((id) => id.toString() === productId);

  let added;
  if (index > -1) {
    user.wishlist.splice(index, 1);
    added = false;
  } else {
    user.wishlist.push(productId);
    added = true;
  }

  await user.save();
  res.status(200).json({ success: true, added, wishlist: user.wishlist });
});
