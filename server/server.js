// Load .env only in development
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const http = require('http');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const { Server } = require('socket.io');

const connectDB = require('./config/db');
const { apiLimiter, authLimiter } = require('./middleware/rateLimit');
const authRoutes = require('./routes/auth');
const documentRoutes = require('./routes/documents');
const aiRoutes = require('./routes/ai');
const { errorHandler, notFound } = require('./utils/errorHandler');
const logger = require('./utils/logger');
const initEditorSocket = require('./websockets/editorSocket');

// ----------------------
// Config
// ----------------------
const PORT = process.env.PORT || 5000;

const FALLBACK_ORIGINS = [
  'http://localhost',
  'http://127.0.0.1',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];

const CLIENT_ORIGINS = Array.from(
  new Set(
    (process.env.CLIENT_URL || '')
      .split(',')
      .map(o => o.trim())
      .filter(Boolean)
      .concat(FALLBACK_ORIGINS)
  )
);

const corsOptions = {
  origin(origin, callback) {
    if (!origin || CLIENT_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    logger.warn(`❌ Blocked CORS origin: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['set-cookie'],
  optionsSuccessStatus: 204,
};

// ----------------------
// Init
// ----------------------
connectDB();

const app = express();
const server = http.createServer(app);

// WebSockets
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        logger.info('✅ Socket.IO connection from no origin (allowed)');
        return callback(null, true);
      }
      
      // Explicitly allow http://localhost:5173
      const allowedOrigins = [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        ...CLIENT_ORIGINS
      ];
      
      if (allowedOrigins.includes(origin)) {
        logger.info(`✅ Socket.IO CORS allowed for origin: ${origin}`);
        callback(null, true);
      } else {
        logger.warn(`❌ Blocked Socket.IO CORS origin: ${origin}`);
        logger.warn(`   Allowed origins: ${allowedOrigins.join(', ')}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Log socket connections
io.on('connection', (socket) => {
  logger.info(`🔌 Socket.IO client connected: ${socket.id}`);
  socket.on('disconnect', () => {
    logger.info(`🔌 Socket.IO client disconnected: ${socket.id}`);
  });
});

initEditorSocket(io);

// ----------------------
// Security + Core Middleware
// ----------------------
app.set('trust proxy', 1);

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(compression());

const sanitizeObject = target => {
  if (!target || typeof target !== 'object') return;
  mongoSanitize.sanitize(target, { replaceWith: '' });
};

app.use((req, res, next) => {
  sanitizeObject(req.body);
  sanitizeObject(req.params);
  sanitizeObject(req.headers);
  sanitizeObject(req.query);

  if (req.query) {
    Object.keys(req.query).forEach(key => {
      const val = req.query[key];
      if (typeof val === 'string') {
        req.query[key] = val.replace(/\$/g, '').replace(/\./g, '');
      }
    });
  }

  next();
});


// Prevent HTTP pollution
app.use(hpp());

// Global Rate Limiter
app.use(apiLimiter);

// ----------------------
// Routes
// ----------------------
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Auth routes: apply limiter only in PRODUCTION
if (process.env.NODE_ENV === 'production') {
  app.use('/api/v1/auth', authLimiter, authRoutes);
} else {
  app.use('/api/v1/auth', authRoutes);
}

app.use('/api/v1/documents', documentRoutes);
app.use('/api/v1/ai', aiRoutes);

// Error handling
app.use(notFound);
app.use(errorHandler);

// ----------------------
// Start Server
// ----------------------
server.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
});
