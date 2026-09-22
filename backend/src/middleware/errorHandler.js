const AppError = require('../utils/AppError');

function notFoundHandler(req, res) {
  res.status(404).json({ error: 'not_found', message: `${req.method} ${req.path} does not exist` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: 'request_error', message: err.message });
  }

  // pg unique violation - most likely a duplicate outlet/menu assignment
  // or a race on the receipt counter that somehow still collided
  if (err.code === '23505') {
    return res.status(409).json({ error: 'conflict', message: 'duplicate record' });
  }

  console.error(err);
  res.status(500).json({ error: 'internal_error', message: 'something went wrong' });
}

module.exports = { notFoundHandler, errorHandler };
