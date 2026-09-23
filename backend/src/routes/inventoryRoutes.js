const express = require('express');
const controller = require('../controllers/inventoryController');
const validate = require('../middleware/validate');
const { setStockSchema } = require('../validators/schemas');

// mounted at /api/outlets/:outletId/inventory
const router = express.Router({ mergeParams: true });

router.get('/', controller.getForOutlet);
router.put('/', validate(setStockSchema), controller.setStock);

module.exports = router;
