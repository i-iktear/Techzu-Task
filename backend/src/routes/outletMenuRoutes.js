const express = require('express');
const controller = require('../controllers/menuController');
const validate = require('../middleware/validate');
const { assignMenuItemSchema } = require('../validators/schemas');

// mounted at /api/outlets/:outletId/menu
const router = express.Router({ mergeParams: true });

router.get('/', controller.getForOutlet);
router.post('/', validate(assignMenuItemSchema), controller.assignToOutlet);

module.exports = router;
