const express = require('express');
const router = express.Router();
const {
  createCoupon,
  getCoupons,
  deleteCoupon,
  applyCoupon,
} = require('../controllers/couponController');
const { protect, authorize } = require('../middleware/auth');

router.post('/apply', protect, applyCoupon);

router.use(protect, authorize('admin'));
router.post('/', createCoupon);
router.get('/', getCoupons);
router.delete('/:id', deleteCoupon);

module.exports = router;
