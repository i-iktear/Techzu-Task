const inventoryRepository = require('../repositories/inventoryRepository');
const outletService = require('./outletService');

async function getStockForOutlet(outletId) {
  await outletService.getOutletOr404(outletId);
  return inventoryRepository.getForOutlet(outletId);
}

async function setStock({ outletId, menuItemId, quantity }) {
  await outletService.getOutletOr404(outletId);
  return inventoryRepository.setStock({ outletId, menuItemId, quantity });
}

module.exports = { getStockForOutlet, setStock };
