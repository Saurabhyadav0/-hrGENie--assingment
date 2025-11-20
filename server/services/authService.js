const User = require('../models/User');
const { signAccessToken, signRefreshToken, verifyToken } = require('../config/jwt');
const { AppError } = require('../utils/errorHandler');

const register = async ({ name, email, password, role }) => {
  const exists = await User.findOne({ email });
  if (exists) {
    throw new AppError('Email already registered', 400);
  }

  const user = await User.create({ name, email, password, role });
  return { user };
};

const login = async ({ email, password }) => {
  const user = await User.findOne({ email });
  if (!user) throw new AppError('Invalid credentials', 401);

  const isMatch = await user.comparePassword(password);
  if (!isMatch) throw new AppError('Invalid credentials', 401);

  const payload = { id: user._id, role: user.role };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  user.refreshTokens.push({ token: refreshToken });
  await user.save();

  return { user, accessToken, refreshToken };
};

const refresh = async (token) => {
  if (!token) throw new AppError('Refresh token missing', 401);
  const decoded = verifyToken(token, 'refresh');
  const user = await User.findById(decoded.id);
  if (!user) throw new AppError('Invalid token', 401);

  const stored = user.refreshTokens.find((entry) => entry.token === token);
  if (!stored) throw new AppError('Invalid token', 401);

  const payload = { id: user._id, role: user.role };
  const newTokens = {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
  user.refreshTokens = user.refreshTokens.filter((entry) => entry.token !== token);
  user.refreshTokens.push({ token: newTokens.refreshToken });
  await user.save();
  return newTokens;
};

const logout = async (userId, token) => {
  const user = await User.findById(userId);
  if (!user) return;
  user.refreshTokens = user.refreshTokens.filter((entry) => entry.token !== token);
  await user.save();
};

module.exports = { register, login, refresh, logout };

