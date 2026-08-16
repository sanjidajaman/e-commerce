const express = require('express');
const router = express.Router();
const {
  getProducts,
  getTopProducts,
  getCategories,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  createProductReview,
  deleteProductReview,
} = require('../controllers/productController');
const { protect, authorize } = require('../middleware/auth');
const { productRules, reviewRules, validate } = require('../middleware/validators');

// Specific paths must come before the /:id param route.
router.get('/top', getTopProducts);
router.get('/categories', getCategories);
router.get('/', getProducts);
router.get('/:id', getProductById);

router.post('/', protect, authorize('admin'), productRules, validate, createProduct);
router.put('/:id', protect, authorize('admin'), updateProduct);
router.delete('/:id', protect, authorize('admin'), deleteProduct);

router.post('/:id/reviews', protect, reviewRules, validate, createProductReview);
router.delete('/:id/reviews/:reviewId', protect, deleteProductReview);

module.exports = router;
