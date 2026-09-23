const menuRepository = require('../repositories/menuRepository');
const outletService = require('./outletService');
const AppError = require('../utils/AppError');

async function listMasterMenu() {
  return menuRepository.findAllMasterItems();
}

async function createMasterMenuItem(data) {
  return menuRepository.createMasterItem(data);
}

async function assignToOutlet({ outletId, menuItemId, priceOverride }) {
  await outletService.getOutletOr404(outletId);

  const item = await menuRepository.findMasterItemById(menuItemId);
  if (!item) throw new AppError(`menu item ${menuItemId} not found`, 404);

  return menuRepository.assignItemToOutlet({ outletId, menuItemId, priceOverride });
}

async function getMenuForOutlet(outletId) {
  await outletService.getOutletOr404(outletId);
  return menuRepository.findItemsForOutlet(outletId);
}

module.exports = { listMasterMenu, createMasterMenuItem, assignToOutlet, getMenuForOutlet };
