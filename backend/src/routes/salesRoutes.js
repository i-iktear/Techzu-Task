const express = require('express');
const controller = require('../controllers/salesController');
const validate = require('../middleware/validate');
const { createSaleSchema } = require('../validators/schemas');

// mounted at /api/outlets/:outletId/sales
const router = express.Router({ mergeParams: true });

router.post('/', validate(createSaleSchema), controller.create);

module.exports = router;
