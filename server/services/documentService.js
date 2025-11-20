const Document = require('../models/Document');
const Permission = require('../models/Permission');
const User = require('../models/User');
const { AppError } = require('../utils/errorHandler');
const { sendDocumentShareEmail } = require('./emailService');

const ensurePermission = async (documentId, userId) => {
  const permission = await Permission.findOne({ document: documentId, user: userId });
  if (!permission) {
    throw new AppError('No access to this document', 403);
  }
  return permission;
};

const createDocument = async (ownerId, payload) => {
  const document = await Document.create({
    title: payload.title,
    content: payload.content || '',
    owner: ownerId,
    collaborators: [],
  });
  await Permission.create({ document: document._id, user: ownerId, role: 'owner' });
  return document;
};

const listDocuments = async (userId) => {
  const permissions = await Permission.find({ user: userId }).populate('document');
  return permissions
    .map((perm) => {
      if (!perm.document) return null;
      const document = perm.document.toObject();
      document.permissionRole = perm.role;
      return document;
    })
    .filter(Boolean);
};

const getDocument = async (documentId, userId) => {
  const permission = await ensurePermission(documentId, userId);
  const document = await Document.findById(documentId).populate('owner', 'name email');
  if (!document) {
    throw new AppError('Document not found', 404);
  }
  const docData = document.toObject();
  docData.permissionRole = permission.role;
  return docData;
};

const updateDocument = async (documentId, userId, payload) => {
  const permission = await ensurePermission(documentId, userId);
  if (!['owner', 'editor'].includes(permission.role)) {
    throw new AppError('Insufficient permissions', 403);
  }

  const updates = {
    ...(payload.title && { title: payload.title }),
    ...(payload.content !== undefined && { content: payload.content }),
    lastEditedBy: userId,
  };
  if (payload.autosave) {
    updates.autosaveAt = new Date();
  }

  return Document.findByIdAndUpdate(documentId, updates, { new: true });
};

const deleteDocument = async (documentId, userId) => {
  const permission = await ensurePermission(documentId, userId);
  if (permission.role !== 'owner') {
    throw new AppError('Only owners can delete documents', 403);
  }
  await Permission.deleteMany({ document: documentId });
  return Document.findByIdAndDelete(documentId);
};

const shareDocument = async (documentId, ownerId, targetUserId, role) => {
  const permission = await ensurePermission(documentId, ownerId);
  if (permission.role !== 'owner') {
    throw new AppError('Only owners can share documents', 403);
  }
  const exists = await User.findById(targetUserId);
  if (!exists) {
    throw new AppError('User not found', 404);
  }

  return Permission.findOneAndUpdate(
    { document: documentId, user: targetUserId },
    { role },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

const shareDocumentByEmail = async (documentId, ownerId, email, role) => {
  if (!email) {
    throw new AppError('Email is required', 400);
  }

  const normalizedEmail = email.trim().toLowerCase();
  const targetUser = await User.findOne({ email: normalizedEmail });
  if (!targetUser) {
    throw new AppError('User not found. Ask them to sign up first.', 404);
  }

  const permission = await shareDocument(documentId, ownerId, targetUser._id, role);

  const document = await Document.findById(documentId).select('title');
  const inviter = await User.findById(ownerId).select('name email');

  await sendDocumentShareEmail({
    to: normalizedEmail,
    document,
    role,
    inviter,
  });

  return permission;
};

const listDocumentPermissions = async (documentId, requesterId) => {
  const permission = await ensurePermission(documentId, requesterId);
  if (permission.role !== 'owner') {
    throw new AppError('Only owners can view collaborators', 403);
  }

  const collaborators = await Permission.find({ document: documentId }).populate('user', 'name email role');
  return collaborators.map((collab) => ({
    id: collab._id,
    user: collab.user,
    role: collab.role,
  }));
};

const revokePermission = async (documentId, ownerId, targetUserId) => {
  const permission = await ensurePermission(documentId, ownerId);
  if (permission.role !== 'owner') {
    throw new AppError('Only owners can manage access', 403);
  }
  if (String(ownerId) === String(targetUserId)) {
    throw new AppError('Owners cannot remove their own access', 400);
  }

  return Permission.findOneAndDelete({ document: documentId, user: targetUserId });
};

module.exports = {
  createDocument,
  listDocuments,
  getDocument,
  updateDocument,
  deleteDocument,
  shareDocument,
  shareDocumentByEmail,
  listDocumentPermissions,
  revokePermission,
};

