const ErrorResponse = require('../utils/errorResponse');

// @desc    Upload a single image (used by the admin product form)
// @route   POST /api/upload
// @access  Private/Admin
exports.uploadImage = (req, res, next) => {
  if (!req.file) {
    return next(new ErrorResponse('Please select an image to upload', 400));
  }
  res.status(200).json({ success: true, url: `/uploads/${req.file.filename}` });
};
