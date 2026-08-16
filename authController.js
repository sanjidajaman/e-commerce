const crypto = require('crypto');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');
const generateToken = require('../utils/generateToken');
const sendEmail = require('../utils/sendEmail');

// Never send the password hash (or internal reset fields) back to the client.
const sanitizeUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  phone: user.phone,
  address: user.address,
  avatar: user.avatar,
  createdAt: user.createdAt,
});

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
exports.register = asyncHandler(async (req, res, next) => {
  const { name, email, password } = req.body;

  const existing = await User.findOne({ email });
  if (existing) {
    return next(new ErrorResponse('An account with this email already exists', 400));
  }

  const user = await User.create({ name, email, password });
  const token = generateToken(user._id, user.role);

  // Best-effort welcome email; never block registration if it fails.
  sendEmail({
    to: user.email,
    subject: 'Welcome to E-Shop!',
    text: `Hi ${user.name}, thanks for creating an account with E-Shop. Happy shopping!`,
    html: `<p>Hi ${user.name},</p><p>Thanks for creating an account with E-Shop. Happy shopping!</p>`,
  }).catch((err) => console.error('Welcome email failed:', err.message));

  res.status(201).json({ success: true, token, user: sanitizeUser(user) });
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.matchPassword(password))) {
    return next(new ErrorResponse('Invalid email or password', 401));
  }

  const token = generateToken(user._id, user.role);
  res.status(200).json({ success: true, token, user: sanitizeUser(user) });
});

// @desc    Logout - stateless JWT, so this just exists as a clean endpoint
//          for the client to call before discarding its token.
// @route   POST /api/auth/logout
// @access  Private
exports.logout = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, message: 'Logged out successfully' });
});

// @desc    Get current user's profile
// @route   GET /api/auth/profile
// @access  Private
exports.getProfile = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, user: sanitizeUser(req.user) });
});

// @desc    Update current user's profile
// @route   PUT /api/auth/profile
// @access  Private
exports.updateProfile = asyncHandler(async (req, res) => {
  const { name, phone, address, avatar } = req.body;
  const user = await User.findById(req.user._id);

  if (name) user.name = name;
  if (phone !== undefined) user.phone = phone;
  if (address !== undefined) user.address = address;
  if (avatar !== undefined) user.avatar = avatar;

  await user.save();
  res.status(200).json({ success: true, user: sanitizeUser(user) });
});

// @desc    Change password (while logged in)
// @route   PUT /api/auth/change-password
// @access  Private
exports.changePassword = asyncHandler(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return next(new ErrorResponse('New password must be at least 6 characters', 400));
  }

  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.matchPassword(currentPassword))) {
    return next(new ErrorResponse('Current password is incorrect', 401));
  }

  user.password = newPassword;
  await user.save();

  res.status(200).json({ success: true, message: 'Password updated successfully' });
});

// @desc    Request a password reset email
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = asyncHandler(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email });

  // Always respond the same way whether or not the email exists, so this
  // endpoint can't be used to enumerate registered accounts.
  const genericResponse = {
    success: true,
    message: 'If that email is registered, a reset link has been sent',
  };

  if (!user) return res.status(200).json(genericResponse);

  const resetToken = user.getResetPasswordToken();
  await user.save({ validateBeforeSave: false });

  const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

  try {
    await sendEmail({
      to: user.email,
      subject: 'Password Reset Request',
      text: `You requested a password reset. Visit this link (valid for 10 minutes): ${resetUrl}`,
      html: `<p>You requested a password reset.</p><p><a href="${resetUrl}">Click here to reset your password</a> (valid for 10 minutes).</p>`,
    });
  } catch (err) {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save({ validateBeforeSave: false });
    return next(new ErrorResponse('Email could not be sent, please try again later', 500));
  }

  res.status(200).json(genericResponse);
});

// @desc    Reset password using the token emailed to the user
// @route   PUT /api/auth/reset-password/:resetToken
// @access  Public
exports.resetPassword = asyncHandler(async (req, res, next) => {
  const hashedToken = crypto.createHash('sha256').update(req.params.resetToken).digest('hex');

  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpire: { $gt: Date.now() },
  });

  if (!user) {
    return next(new ErrorResponse('Invalid or expired reset token', 400));
  }
  if (!req.body.password || req.body.password.length < 6) {
    return next(new ErrorResponse('Password must be at least 6 characters', 400));
  }

  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  const token = generateToken(user._id, user.role);
  res.status(200).json({ success: true, token, user: sanitizeUser(user) });
});
