const express = require('express');
const cors = require('cors');

const outletRoutes = require('./routes/outletRoutes');
const menuRoutes = require('./routes/menuRoutes');
const outletMenuRoutes = require('./routes/outletMenuRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const salesRoutes = require('./routes/salesRoutes');
const reportRoutes = require('./routes/reportRoutes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/outlets', outletRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/outlets/:outletId/menu', outletMenuRoutes);
app.use('/api/outlets/:outletId/inventory', inventoryRoutes);
app.use('/api/outlets/:outletId/sales', salesRoutes);
app.use('/api/reports', reportRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
