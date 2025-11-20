const transporter = require('../config/mailer');
const logger = require('../utils/logger');

const MAIL_FROM = process.env.MAIL_FROM || process.env.MAIL_USER;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const sendDocumentShareEmail = async ({ to, document, role, inviter }) => {
  if (!transporter) {
    throw new Error('Email transporter is not configured');
  }

  const documentUrl = `${CLIENT_URL}/documents/${document._id}`;

  const html = `
    <p>Hi there,</p>
    <p><strong>${inviter?.name || 'A teammate'}</strong> shared a document with you on WorkRadius.</p>
    <p><strong>Document:</strong> ${document.title}</p>
    <p><strong>Access:</strong> ${role}</p>
    <p>You can open the document using the link below. You'll be asked to log in so we can apply your access level securely.</p>
    <p><a href="${documentUrl}">${documentUrl}</a></p>
    <p>If you don't have an account yet, please sign up using the same email address to access the document.</p>
    <p>Thanks,<br/>WorkRadius</p>
  `;

  const message = {
    from: MAIL_FROM,
    to,
    subject: `${inviter?.name || 'A teammate'} shared “${document.title}” with you`,
    html,
  };

  const info = await transporter.sendMail(message);
  logger.info(`Document share email sent: ${info.messageId || 'ok'}`, { service: 'workradius-mailer' });
  return info;
};

module.exports = {
  sendDocumentShareEmail,
};

