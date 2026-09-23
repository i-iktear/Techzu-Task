const { pool } = require('../db/pool');

async function getForOutlet(outletId) {
  const { rows } = await pool.query(
    `SELECT i.menu_item_id, mi.name, i.quantity
     FROM inventory i
     JOIN menu_items mi ON mi.id = i.menu_item_id
     WHERE i.outlet_id = $1
     ORDER BY mi.name`,
    [outletId]
  );
  return rows;
}

// locks the row so two concurrent sales can't both read stale stock
// and both pass a stock check that should have failed for the second one
async function lockRow(client, outletId, menuItemId) {
  const { rows } = await client.query(
    `SELECT quantity FROM inventory
     WHERE outlet_id = $1 AND menu_item_id = $2
     FOR UPDATE`,
    [outletId, menuItemId]
  );
  return rows[0] || null;
}

async function decrement(client, outletId, menuItemId, quantity) {
  const { rows } = await client.query(
    `UPDATE inventory
     SET quantity = quantity - $3, updated_at = now()
     WHERE outlet_id = $1 AND menu_item_id = $2 AND quantity >= $3
     RETURNING quantity`,
    [outletId, menuItemId, quantity]
  );
  return rows[0] || null;
}

async function setStock({ outletId, menuItemId, quantity }) {
  const { rows } = await pool.query(
    `INSERT INTO inventory (outlet_id, menu_item_id, quantity)
     VALUES ($1, $2, $3)
     ON CONFLICT (outlet_id, menu_item_id)
     DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = now()
     RETURNING *`,
    [outletId, menuItemId, quantity]
  );
  return rows[0];
}

module.exports = { getForOutlet, lockRow, decrement, setStock };
