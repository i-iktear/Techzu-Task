const outletRepository = require('../repositories/outletRepository');
const AppError = require('../utils/AppError');

async function listOutlets() {
  return outletRepository.findAll();
}

async function createOutlet(data) {
  return outletRepository.create(data);
}

async function getOutletOr404(outletId) {
  const outlet = await outletRepository.findById(outletId);
  if (!outlet) throw new AppError(`outlet ${outletId} not found`, 404);
  return outlet;
}

module.exports = { listOutlets, createOutlet, getOutletOr404 };
