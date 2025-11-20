const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGO_URI is not defined');
  }

  try {
    await mongoose.connect(uri, {
      dbName: process.env.MONGO_DB_NAME || 'workradius',
    });
    logger.info('MongoDB connected');
  } catch (error) {
    logger.error('MongoDB connection error: %s', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;

