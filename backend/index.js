require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { sequelize } = require('./models');

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/vault', require('./routes/vaultRoutes'));

const start = async () => {
  try {
    await sequelize.sync();
    app.listen(process.env.PORT || 3000, () => console.log('🚀 Serveur prêt'));
  } catch (e) { console.error(e); }
};

start();