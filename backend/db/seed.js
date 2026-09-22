require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT) || 5432,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
});

async function run() {
  // the docker entrypoint runs this on every start, so bail if there's
  // already data instead of inserting the same outlets again
  const existing = await pool.query('SELECT 1 FROM outlets LIMIT 1');
  if (existing.rows.length) {
    console.log('seed skipped, outlets already exist');
    await pool.end();
    return;
  }

  const outlets = await pool.query(`
    INSERT INTO outlets (name) VALUES
      ('Gulshan Outlet'),
      ('Banani Outlet')
    RETURNING id
  `);
  const [outlet1, outlet2] = outlets.rows;

  const items = await pool.query(`
    INSERT INTO menu_items (name, base_price) VALUES
      ('Chicken Biryani', 220.00),
      ('Beef Tehari', 250.00),
      ('Cold Coffee', 120.00),
      ('Fries', 90.00)
    RETURNING id
  `);
  const [biryani, tehari, coffee, fries] = items.rows;

  // outlet1 gets the full menu; outlet2 skips tehari and sells
  // biryani/fries a bit cheaper via price_override
  const assignments = [
    [outlet1.id, biryani.id, null],
    [outlet1.id, tehari.id, null],
    [outlet1.id, coffee.id, null],
    [outlet1.id, fries.id, null],
    [outlet2.id, biryani.id, 210.00],
    [outlet2.id, coffee.id, null],
    [outlet2.id, fries.id, 80.00],
  ];

  for (const [outletId, menuItemId, priceOverride] of assignments) {
    await pool.query(
      'INSERT INTO outlet_menu_items (outlet_id, menu_item_id, price_override) VALUES ($1, $2, $3)',
      [outletId, menuItemId, priceOverride]
    );
    await pool.query(
      'INSERT INTO inventory (outlet_id, menu_item_id, quantity) VALUES ($1, $2, 50)',
      [outletId, menuItemId]
    );
  }

  for (const outlet of [outlet1, outlet2]) {
    await pool.query(
      'INSERT INTO outlet_receipt_counters (outlet_id, last_receipt_number) VALUES ($1, 0)',
      [outlet.id]
    );
  }

  console.log('seed complete');
  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
