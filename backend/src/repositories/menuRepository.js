const { pool } = require('../db/pool');

async function findAllMasterItems() {
  const { rows } = await pool.query('SELECT * FROM menu_items ORDER BY id');
  return rows;
}

async function findMasterItemById(id) {
  const { rows } = await pool.query('SELECT * FROM menu_items WHERE id = $1', [id]);
  return rows[0] || null;
}

async function createMasterItem({ name, basePrice }) {
  const { rows } = await pool.query(
    'INSERT INTO menu_items (name, base_price) VALUES ($1, $2) RETURNING *',
    [name, basePrice]
  );
  return rows[0];
}

// menu items visible to a given outlet, with the effective price
// (override if HQ set one, otherwise the master base_price)
async function findItemsForOutlet(outletId) {
  const { rows } = await pool.query(
    `SELECT
       mi.id,
       mi.name,
       COALESCE(omi.price_override, mi.base_price) AS price
     FROM outlet_menu_items omi
     JOIN menu_items mi ON mi.id = omi.menu_item_id
     WHERE omi.outlet_id = $1
     ORDER BY mi.id`,
    [outletId]
  );
  return rows;
}

async function assignItemToOutlet({ outletId, menuItemId, priceOverride }) {
  const { rows } = await pool.query(
    `INSERT INTO outlet_menu_items (outlet_id, menu_item_id, price_override)
     VALUES ($1, $2, $3)
     ON CONFLICT (outlet_id, menu_item_id)
     DO UPDATE SET price_override = EXCLUDED.price_override
     RETURNING *`,
    [outletId, menuItemId, priceOverride ?? null]
  );
  return rows[0];
}

// used inside the sale transaction to check the item belongs to the
// outlet and to get the price actually charged
async function findOutletMenuItem(client, outletId, menuItemId) {
  const { rows } = await client.query(
    `SELECT
       mi.id AS menu_item_id,
       COALESCE(omi.price_override, mi.base_price) AS price
     FROM outlet_menu_items omi
     JOIN menu_items mi ON mi.id = omi.menu_item_id
     WHERE omi.outlet_id = $1 AND omi.menu_item_id = $2`,
    [outletId, menuItemId]
  );
  return rows[0] || null;
}

module.exports = {
  findAllMasterItems,
  findMasterItemById,
  createMasterItem,
  findItemsForOutlet,
  assignItemToOutlet,
  findOutletMenuItem,
};
