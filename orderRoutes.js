const express = require('express');
const router = express.Router();
const {
  createOrder,
  getOrderById,
  getMyOrders,
  getAllOrders,
  updateOrderStatus,
  getSalesStats,
} = require('../controllers/orderController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// Specific paths must come before the /:id param route.
router.post('/', createOrder);
router.get('/my-orders', getMyOrders);
router.get('/stats/summary', authorize('admin'), getSalesStats);
router.get('/', authorize('admin'), getAllOrders);
router.get('/:id', getOrderById);
router.put('/:id/status', authorize('admin'), updateOrderStatus);

module.exports = router;
