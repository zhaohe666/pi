const path = require('path');
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const apiRouter = require('./routes/api');
const adminRouter = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProd = NODE_ENV === 'production';

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(cors({
  origin: process.env.CORS_ORIGIN || true,
  credentials: true
}));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'no-referrer-when-downgrade');
  if (isProd) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

if (!isProd) {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
    });
    next();
  });
}

const swaggerOptions = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Imgkits Clone API',
      version: '1.0.0',
      description:
        'A Swagger-documented REST API for an AI image & video editing platform. ' +
        'Provides endpoints for background removal, photo restoration, style transfer, ' +
        'AI flyer generation, plus a full admin API for managing users, jobs, tools, ' +
        'API keys, and system settings.',
      contact: { name: 'Imgkits Clone' },
      license: { name: 'MIT' }
    },
    servers: [
      { url: '/', description: 'Same origin' }
    ],
    tags: [
      { name: 'Image Editing', description: 'Core AI image editing endpoints' },
      { name: 'Image Generation', description: 'AI-driven image generation' },
      { name: 'Style Transfer', description: 'Convert photos into artistic styles' },
      { name: 'Jobs', description: 'Track asynchronous processing jobs' },
      { name: 'Auth', description: 'Login / logout / current user' },
      { name: 'Admin', description: 'Admin panel APIs (require admin role)' },
      { name: 'System', description: 'Health & status endpoints' }
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'session-token' }
      },
      schemas: {
        JobResponse: {
          type: 'object',
          properties: {
            jobId: { type: 'string', example: 'job_8f2a91c' },
            status: { type: 'string', enum: ['queued', 'processing', 'done', 'failed'] },
            tool: { type: 'string', example: 'background-remover' },
            createdAt: { type: 'string', format: 'date-time' },
            resultUrl: { type: 'string', nullable: true }
          }
        },
        JobResult: {
          type: 'object',
          properties: {
            jobId: { type: 'string' },
            status: { type: 'string', enum: ['queued', 'processing', 'done', 'failed'] },
            tool: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            completedAt: { type: 'string', format: 'date-time', nullable: true },
            resultUrl: { type: 'string', nullable: true },
            metadata: { type: 'object', additionalProperties: true }
          }
        },
        ImageUrlInput: {
          type: 'object',
          required: ['imageUrl'],
          properties: { imageUrl: { type: 'string', format: 'uri' } }
        },
        BackgroundReplaceInput: {
          type: 'object',
          required: ['imageUrl'],
          properties: {
            imageUrl: { type: 'string', format: 'uri' },
            backgroundPrompt: { type: 'string' },
            backgroundColor: { type: 'string' }
          }
        },
        StyleTransferInput: {
          type: 'object',
          required: ['imageUrl', 'style'],
          properties: {
            imageUrl: { type: 'string', format: 'uri' },
            style: { type: 'string', enum: ['anime', 'pixar', 'sketch', 'oil-painting', 'watercolor', 'cyberpunk'] },
            strength: { type: 'number', minimum: 0, maximum: 1, default: 0.75 }
          }
        },
        FlyerGenInput: {
          type: 'object',
          required: ['title'],
          properties: {
            title: { type: 'string' },
            subtitle: { type: 'string' },
            theme: { type: 'string' },
            colorPalette: { type: 'array', items: { type: 'string' } }
          }
        },
        FantasyMapInput: {
          type: 'object',
          required: ['prompt'],
          properties: {
            prompt: { type: 'string' },
            style: { type: 'string', enum: ['parchment', 'satellite', 'cartoon'] },
            seed: { type: 'integer' }
          }
        },
        UpscaleInput: {
          type: 'object',
          required: ['imageUrl'],
          properties: {
            imageUrl: { type: 'string', format: 'uri' },
            scale: { type: 'integer', enum: [2, 4, 8], default: 2 }
          }
        },
        ObjectRemovalInput: {
          type: 'object',
          required: ['imageUrl', 'mask'],
          properties: {
            imageUrl: { type: 'string', format: 'uri' },
            mask: { type: 'string' }
          }
        },
        Error: {
          type: 'object',
          properties: { error: { type: 'string' }, message: { type: 'string' } }
        }
      }
    }
  },
  apis: [path.join(__dirname, 'routes/*.js')]
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

app.use(
  '/api/docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'Imgkits Clone API Docs',
    customCss: '.topbar { display: none }'
  })
);

app.get('/api/openapi.json', (req, res) => res.json(swaggerSpec));

app.use('/api', adminRouter);
app.use('/api', apiRouter);

const publicDir = path.join(__dirname, '..', 'public');
const staticOpts = isProd
  ? { maxAge: '1d', etag: true, immutable: false }
  : { etag: false };
app.use(express.static(publicDir, staticOpts));

app.get('/admin', (req, res) => {
  res.sendFile(path.join(publicDir, 'admin', 'index.html'));
});
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(publicDir, 'admin', 'index.html'));
});

app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'NotFound', message: `Route ${req.method} ${req.path} not found` });
  }
  res.status(404).sendFile(path.join(publicDir, 'index.html'));
});

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.name || 'InternalServerError',
    message: isProd ? 'Something went wrong' : err.message || 'Something went wrong'
  });
});

const server = app.listen(PORT, () => {
  console.log(`[${NODE_ENV}] Imgkits Clone running on http://localhost:${PORT}`);
  console.log(`Frontend     : http://localhost:${PORT}/`);
  console.log(`Admin panel  : http://localhost:${PORT}/admin   (admin@imgkits.local / admin123)`);
  console.log(`Swagger UI   : http://localhost:${PORT}/api/docs`);
});

function shutdown(signal) {
  console.log(`\nReceived ${signal}, shutting down gracefully...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
