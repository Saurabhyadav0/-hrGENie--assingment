const logger = require('./logger');

class AppError extends Error {
  constructor(message, statusCode = 500, details = {}) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

const notFound = (req, res, next) => {
  next(new AppError('Resource not found', 404));
};

const errorHandler = (err, req, res, next) => {
  const status = err.statusCode || 500;
  const response = {
    success: false,
    message: err.message || 'Server Error',
  };

  if (process.env.NODE_ENV !== 'production' && Object.keys(err.details || {}).length) {
    response.details = err.details;
  }

  logger.error('API error: %s', err.stack || err.message);
  res.status(status).json(response);
};

module.exports = { AppError, errorHandler, notFound };

