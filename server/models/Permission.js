const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema(
  {
    document: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: ['owner', 'editor', 'viewer'],
      default: 'viewer',
    },
  },
  { timestamps: true }
);

permissionSchema.index({ document: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('Permission', permissionSchema);

