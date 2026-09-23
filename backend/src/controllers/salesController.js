const salesService = require('../services/salesService');

async function create(req, res, next) {
  try {
    const outletId = Number(req.params.outletId);
    const sale = await salesService.createSale({ outletId, items: req.body.items });
    res.status(201).json(sale);
  } catch (err) {
    next(err);
  }
}

module.exports = { create };
