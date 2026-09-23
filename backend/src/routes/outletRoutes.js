const express = require('express');
const controller = require('../controllers/outletController');
const validate = require('../middleware/validate');
const { createOutletSchema } = require('../validators/schemas');

const router = express.Router();

router.get('/', controller.list);
router.post('/', validate(createOutletSchema), controller.create);

module.exports = router;
