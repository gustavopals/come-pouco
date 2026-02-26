const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const env = require('./config/env');

const app = express();

app.use(cors({ origin: env.corsOrigin }));
app.use(express.json());
app.use('/api', routes);

app.use((error, _req, res, _next) => {
  const statusCode = error.statusCode || 500;
  const message = statusCode >= 500 ? 'Erro interno do servidor.' : error.message;

  if (statusCode >= 500) {
    console.error(error);
  }

  res.status(statusCode).json({ message });
});

module.exports = app;
