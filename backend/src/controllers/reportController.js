const reportService = require('../services/reportService');

async function revenueByOutlet(req, res, next) {
  try {
    const rows = await reportService.revenueByOutlet();
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function topSellingItems(req, res, next) {
  try {
    const outletId = Number(req.params.outletId);
    const rows = await reportService.topSellingItems(outletId);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

module.exports = { revenueByOutlet, topSellingItems };
