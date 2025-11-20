const express = require('express');
const { body, param } = require('express-validator');
const {
  createDocument,
  listDocuments,
  getDocument,
  updateDocument,
  deleteDocument,
  shareDocument,
  shareDocumentByEmail,
  listDocumentPermissions,
  revokePermission,
} = require('../services/documentService');
const { authMiddleware } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

router.use(authMiddleware);

router.get('/', async (req, res, next) => {
  try {
    const docs = await listDocuments(req.user._id);
    res.json({ success: true, documents: docs });
  } catch (error) {
    next(error);
  }
});

router.post('/', [body('title').notEmpty(), body('content').optional().isString()], validate, async (req, res, next) => {
  try {
    const doc = await createDocument(req.user._id, req.body);
    res.status(201).json({ success: true, document: doc });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', [param('id').isMongoId()], validate, async (req, res, next) => {
  try {
    const doc = await getDocument(req.params.id, req.user._id);
    res.json({ success: true, document: doc });
  } catch (error) {
    next(error);
  }
});

router.put(
  '/:id',
  [param('id').isMongoId(), body('title').optional().notEmpty(), body('content').optional().isString()],
  validate,
  async (req, res, next) => {
    try {
      const doc = await updateDocument(req.params.id, req.user._id, req.body);
      res.json({ success: true, document: doc });
    } catch (error) {
      next(error);
    }
  }
);

router.delete('/:id', [param('id').isMongoId()], validate, async (req, res, next) => {
  try {
    await deleteDocument(req.params.id, req.user._id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.post(
  '/:id/share',
  [
    param('id').isMongoId(),
    body('userId').isMongoId(),
    body('role').isIn(['editor', 'viewer']),
  ],
  validate,
  async (req, res, next) => {
    try {
      const permission = await shareDocument(req.params.id, req.user._id, req.body.userId, req.body.role);
      res.json({ success: true, permission });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/:id/share-email',
  [param('id').isMongoId(), body('email').isEmail(), body('role').isIn(['editor', 'viewer'])],
  validate,
  async (req, res, next) => {
    try {
      const permission = await shareDocumentByEmail(req.params.id, req.user._id, req.body.email, req.body.role);
      res.json({ success: true, permission, message: 'Invitation email sent' });
    } catch (error) {
      next(error);
    }
  }
);

router.get('/:id/permissions', [param('id').isMongoId()], validate, async (req, res, next) => {
  try {
    const permissions = await listDocumentPermissions(req.params.id, req.user._id);
    res.json({ success: true, permissions });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id/permissions/:userId', [param('id').isMongoId(), param('userId').isMongoId()], validate, async (req, res, next) => {
  try {
    await revokePermission(req.params.id, req.user._id, req.params.userId);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

module.exports = router;

