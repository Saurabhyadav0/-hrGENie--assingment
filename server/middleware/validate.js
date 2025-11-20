const { validationResult } = require('express-validator');
const { AppError } = require('../utils/errorHandler');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new AppError('Validation error', 422, { errors: errors.array() }));
  }
  return next();
};

module.exports = validate;

