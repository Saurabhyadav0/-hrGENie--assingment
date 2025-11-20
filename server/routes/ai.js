const express = require('express');
const { body } = require('express-validator');
const { grammarCheck, enhanceText, summarize, complete, suggestions } = require('../services/groqService.js');
const { authMiddleware } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

router.use(authMiddleware);

const textValidation = [body('text').isString().isLength({ min: 1, max: 4000 })];

router.post('/grammar-check', textValidation, validate, async (req, res, next) => {
  try {
    const result = await grammarCheck(req.body.text);
    res.json({ success: true, result });
  } catch (error) {
    next(error);
  }
});

router.post('/enhance', textValidation, validate, async (req, res, next) => {
  try {
    const result = await enhanceText(req.body.text);
    res.json({ success: true, result });
  } catch (error) {
    next(error);
  }
});

router.post('/summarize', textValidation, validate, async (req, res, next) => {
  try {
    const result = await summarize(req.body.text);
    res.json({ success: true, result });
  } catch (error) {
    next(error);
  }
});

router.post('/complete', textValidation, validate, async (req, res, next) => {
  try {
    const result = await complete(req.body.text);
    res.json({ success: true, result });
  } catch (error) {
    next(error);
  }
});

router.post('/suggestions', textValidation, validate, async (req, res, next) => {
  try {
    const result = await suggestions(req.body.text);
    res.json({ success: true, result });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

