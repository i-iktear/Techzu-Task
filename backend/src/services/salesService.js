const { withTransaction } = require('../db/pool');
const menuRepository = require('../repositories/menuRepository');
const inventoryRepository = require('../repositories/inventoryRepository');
const salesRepository = require('../repositories/salesRepository');
const outletService = require('./outletService');
const AppError = require('../utils/AppError');

// items: [{ menuItemId, quantity }]
async function createSale({ outletId, items }) {
  await outletService.getOutletOr404(outletId);

  // lock rows in a fixed order (by menu_item_id) across the whole request
  // so two sales hitting overlapping items can't deadlock each other
  const sortedItems = [...items].sort((a, b) => a.menuItemId - b.menuItemId);

  return withTransaction(async (client) => {
    const lineItems = [];

    for (const { menuItemId, quantity } of sortedItems) {
      const outletItem = await menuRepository.findOutletMenuItem(client, outletId, menuItemId);
      if (!outletItem) {
        throw new AppError(`menu item ${menuItemId} is not assigned to outlet ${outletId}`, 400);
      }

      const stockRow = await inventoryRepository.lockRow(client, outletId, menuItemId);
      if (!stockRow) {
        throw new AppError(`no inventory record for menu item ${menuItemId} at outlet ${outletId}`, 400);
      }
      if (stockRow.quantity < quantity) {
        throw new AppError(
          `insufficient stock for menu item ${menuItemId}: have ${stockRow.quantity}, requested ${quantity}`,
          409
        );
      }

      const updated = await inventoryRepository.decrement(client, outletId, menuItemId, quantity);
      if (!updated) {
        // someone else decremented between the lock check and here would be
        // impossible under FOR UPDATE, but keep this as a hard safety net
        throw new AppError(`stock update failed for menu item ${menuItemId}`, 409);
      }

      const unitPrice = Number(outletItem.price);
      const subtotal = unitPrice * quantity;
      lineItems.push({ menuItemId, quantity, unitPrice, subtotal });
    }

    const totalAmount = lineItems.reduce((sum, li) => sum + li.subtotal, 0);
    const receiptNumber = await salesRepository.nextReceiptNumber(client, outletId);

    const sale = await salesRepository.insertSale(client, {
      outletId,
      receiptNumber,
      totalAmount,
    });

    for (const li of lineItems) {
      await salesRepository.insertSaleItem(client, { saleId: sale.id, ...li });
    }

    return { ...sale, items: lineItems };
  });
}

module.exports = { createSale };
