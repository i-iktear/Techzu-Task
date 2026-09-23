const salesRepository = require('../repositories/salesRepository');
const outletService = require('./outletService');

async function revenueByOutlet() {
  return salesRepository.revenueByOutlet();
}

async function topSellingItems(outletId) {
  await outletService.getOutletOr404(outletId);
  return salesRepository.topSellingItems(outletId);
}

module.exports = { revenueByOutlet, topSellingItems };
