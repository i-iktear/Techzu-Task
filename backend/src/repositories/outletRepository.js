const { pool } = require('../db/pool');

async function findAll() {
  const { rows } = await pool.query('SELECT * FROM outlets ORDER BY id');
  return rows;
}

async function findById(id) {
  const { rows } = await pool.query('SELECT * FROM outlets WHERE id = $1', [id]);
  return rows[0] || null;
}

async function create({ name }) {
  const { rows } = await pool.query('INSERT INTO outlets (name) VALUES ($1) RETURNING *', [name]);
  // an outlet needs a receipt counter row before it can take its first sale
  await pool.query(
    'INSERT INTO outlet_receipt_counters (outlet_id, last_receipt_number) VALUES ($1, 0)',
    [rows[0].id]
  );
  return rows[0];
}

module.exports = { findAll, findById, create };
