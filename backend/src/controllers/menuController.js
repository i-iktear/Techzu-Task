const menuService = require('../services/menuService');

async function listMaster(req, res, next) {
  try {
    const items = await menuService.listMasterMenu();
    res.json(items);
  } catch (err) {
    next(err);
  }
}

async function createMaster(req, res, next) {
  try {
    const item = await menuService.createMasterMenuItem(req.body);
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
}

async function assignToOutlet(req, res, next) {
  try {
    const outletId = Number(req.params.outletId);
    const { menuItemId, priceOverride } = req.body;
    const assignment = await menuService.assignToOutlet({ outletId, menuItemId, priceOverride });
    res.status(201).json(assignment);
  } catch (err) {
    next(err);
  }
}

async function getForOutlet(req, res, next) {
  try {
    const outletId = Number(req.params.outletId);
    const items = await menuService.getMenuForOutlet(outletId);
    res.json(items);
  } catch (err) {
    next(err);
  }
}

module.exports = { listMaster, createMaster, assignToOutlet, getForOutlet };
