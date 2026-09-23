const { pool } = require('../db/pool');

// this UPDATE takes a row lock on the outlet's counter row, so two
// concurrent sales for the same outlet serialize here instead of
// both computing the same "next" number
async function nextReceiptNumber(client, outletId) {
  const { rows } = await client.query(
    `UPDATE outlet_receipt_counters
     SET last_receipt_number = last_receipt_number + 1
     WHERE outlet_id = $1
     RETURNING last_receipt_number`,
    [outletId]
  );
  if (!rows[0]) {
    throw new Error(`no receipt counter found for outlet ${outletId}`);
  }
  return rows[0].last_receipt_number;
}

async function insertSale(client, { outletId, receiptNumber, totalAmount }) {
  const { rows } = await client.query(
    `INSERT INTO sales (outlet_id, receipt_number, total_amount)
     VALUES ($1, $2, $3) RETURNING *`,
    [outletId, receiptNumber, totalAmount]
  );
  return rows[0];
}

async function insertSaleItem(client, { saleId, menuItemId, quantity, unitPrice, subtotal }) {
  const { rows } = await client.query(
    `INSERT INTO sale_items (sale_id, menu_item_id, quantity, unit_price, subtotal)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [saleId, menuItemId, quantity, unitPrice, subtotal]
  );
  return rows[0];
}

async function revenueByOutlet() {
  const { rows } = await pool.query(
    `SELECT o.id AS outlet_id, o.name AS outlet_name,
            COALESCE(SUM(s.total_amount), 0) AS total_revenue
     FROM outlets o
     LEFT JOIN sales s ON s.outlet_id = o.id
     GROUP BY o.id, o.name
     ORDER BY total_revenue DESC`
  );
  return rows;
}

async function topSellingItems(outletId) {
  const { rows } = await pool.query(
    `SELECT mi.id AS menu_item_id, mi.name,
            SUM(si.quantity) AS total_quantity,
            SUM(si.subtotal) AS total_revenue
     FROM sale_items si
     JOIN sales s ON s.id = si.sale_id
     JOIN menu_items mi ON mi.id = si.menu_item_id
     WHERE s.outlet_id = $1
     GROUP BY mi.id, mi.name
     ORDER BY total_quantity DESC
     LIMIT 5`,
    [outletId]
  );
  return rows;
}

module.exports = {
  nextReceiptNumber,
  insertSale,
  insertSaleItem,
  revenueByOutlet,
  topSellingItems,
};
