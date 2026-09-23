const outletService = require('../services/outletService');

async function list(req, res, next) {
  try {
    const outlets = await outletService.listOutlets();
    res.json(outlets);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const outlet = await outletService.createOutlet(req.body);
    res.status(201).json(outlet);
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create };
