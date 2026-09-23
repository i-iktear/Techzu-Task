const express = require('express');
const controller = require('../controllers/menuController');
const validate = require('../middleware/validate');
const { createMenuItemSchema } = require('../validators/schemas');

const router = express.Router();

router.get('/', controller.listMaster);
router.post('/', validate(createMenuItemSchema), controller.createMaster);

module.exports = router;
