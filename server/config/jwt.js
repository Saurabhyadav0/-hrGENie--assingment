const jwt = require('jsonwebtoken');

const JWT_ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES || '45m';
const JWT_REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES || '7d';

const signAccessToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: JWT_ACCESS_EXPIRES,
  });
};

const signRefreshToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES,
  });
};

const verifyToken = (token, type = 'access') => {
  const secret = type === 'refresh' ? process.env.JWT_REFRESH_SECRET : process.env.JWT_ACCESS_SECRET;
  return jwt.verify(token, secret);
};

module.exports = { signAccessToken, signRefreshToken, verifyToken };

