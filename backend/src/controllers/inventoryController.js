const inventoryService = require('../services/inventoryService');

async function getForOutlet(req, res, next) {
  try {
    const outletId = Number(req.params.outletId);
    const stock = await inventoryService.getStockForOutlet(outletId);
    res.json(stock);
  } catch (err) {
    next(err);
  }
}

async function setStock(req, res, next) {
  try {
    const outletId = Number(req.params.outletId);
    const { menuItemId, quantity } = req.body;
    const row = await inventoryService.setStock({ outletId, menuItemId, quantity });
    res.json(row);
  } catch (err) {
    next(err);
  }
}

module.exports = { getForOutlet, setStock };
