const express = require('express');
const { body } = require('express-validator');
const { register, login, refresh, logout } = require('../services/authService');
const validate = require('../middleware/validate');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const isProd = process.env.NODE_ENV === 'production';
const envFlag = (value, fallback) => {
  if (value === undefined) return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
};
const cookieOptions = {
  httpOnly: true,
  secure: envFlag(process.env.COOKIE_SECURE, isProd),
  sameSite: envFlag(process.env.COOKIE_SAMESITE, isProd ? 'none' : 'lax'),
  path: '/',
  domain: process.env.COOKIE_DOMAIN || undefined,
};

router.post(
  '/register',
  [
    body('name').notEmpty(),
    body('email').isEmail(),
    body('password').isLength({ min: 8 }),
    body('role').optional().isIn(['owner', 'editor', 'viewer']),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { user } = await register(req.body);
      res.status(201).json({ success: true, user: { id: user._id, email: user.email } });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/login',
  [body('email').isEmail(), body('password').isLength({ min: 8 })],
  validate,
  async (req, res, next) => {
    try {
      const { user, accessToken, refreshToken } = await login(req.body);
      res
        .cookie('accessToken', accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 })
        .cookie('refreshToken', refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 })
        .json({
          success: true,
          user: { id: user._id, email: user.email, name: user.name, role: user.role },
        });
    } catch (error) {
      next(error);
    }
  }
);

router.post('/refresh', async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    const { accessToken, refreshToken: newRefresh } = await refresh(refreshToken);
    res
      .cookie('accessToken', accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 })
      .cookie('refreshToken', newRefresh, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 })
      .json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', authMiddleware, async (req, res, next) => {
  try {
    await logout(req.user._id, req.cookies?.refreshToken);
    res.clearCookie('accessToken', cookieOptions).clearCookie('refreshToken', cookieOptions).json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.get('/me', authMiddleware, (req, res) => {
  res.json({ success: true, user: req.user });
});

module.exports = router;

