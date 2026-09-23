const express = require('express');
const controller = require('../controllers/reportController');

const router = express.Router();

router.get('/revenue-by-outlet', controller.revenueByOutlet);
router.get('/outlets/:outletId/top-items', controller.topSellingItems);

module.exports = router;
