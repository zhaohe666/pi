const path = require('path');
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const apiRouter = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

const swaggerOptions = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Imgkits Clone API',
      version: '1.0.0',
      description:
        'A Swagger-documented REST API for an AI image & video editing platform. ' +
        'Provides endpoints for background removal, photo restoration, style transfer, ' +
        'AI flyer generation, and more.',
      contact: {
        name: 'Imgkits Clone',
        url: 'http://localhost:3000'
      },
      license: {
        name: 'MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Local development server'
      }
    ],
    tags: [
      { name: 'Image Editing', description: 'Core AI image editing endpoints' },
      { name: 'Image Generation', description: 'AI-driven image generation' },
      { name: 'Style Transfer', description: 'Convert photos into artistic styles' },
      { name: 'Jobs', description: 'Track asynchronous processing jobs' },
      { name: 'System', description: 'Health & status endpoints' }
    ],
    components: {
      schemas: {
        JobResponse: {
          type: 'object',
          properties: {
            jobId: { type: 'string', example: 'job_8f2a91c' },
            status: { type: 'string', enum: ['queued', 'processing', 'done', 'failed'], example: 'queued' },
            tool: { type: 'string', example: 'background-remover' },
            createdAt: { type: 'string', format: 'date-time' },
            resultUrl: { type: 'string', nullable: true, example: null }
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
          properties: {
            imageUrl: { type: 'string', format: 'uri', example: 'https://example.com/photo.jpg' }
          }
        },
        BackgroundReplaceInput: {
          type: 'object',
          required: ['imageUrl'],
          properties: {
            imageUrl: { type: 'string', format: 'uri' },
            backgroundPrompt: { type: 'string', example: 'tropical beach at sunset' },
            backgroundColor: { type: 'string', example: '#ffffff' }
          }
        },
        StyleTransferInput: {
          type: 'object',
          required: ['imageUrl', 'style'],
          properties: {
            imageUrl: { type: 'string', format: 'uri' },
            style: {
              type: 'string',
              enum: ['anime', 'pixar', 'sketch', 'oil-painting', 'watercolor', 'cyberpunk'],
              example: 'anime'
            },
            strength: { type: 'number', minimum: 0, maximum: 1, default: 0.75 }
          }
        },
        FlyerGenInput: {
          type: 'object',
          required: ['title'],
          properties: {
            title: { type: 'string', example: 'Summer Sale' },
            subtitle: { type: 'string', example: 'Up to 50% off' },
            theme: { type: 'string', example: 'modern minimalist' },
            colorPalette: {
              type: 'array',
              items: { type: 'string' },
              example: ['#7c3aed', '#06b6d4']
            }
          }
        },
        FantasyMapInput: {
          type: 'object',
          required: ['prompt'],
          properties: {
            prompt: { type: 'string', example: 'a continent with frozen north and desert south' },
            style: { type: 'string', enum: ['parchment', 'satellite', 'cartoon'], example: 'parchment' },
            seed: { type: 'integer', example: 42 }
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
            mask: { type: 'string', description: 'Base64 encoded mask image', example: 'data:image/png;base64,iVBOR...' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
          }
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

app.get('/api/openapi.json', (req, res) => {
  res.json(swaggerSpec);
});

app.use('/api', apiRouter);

app.use(express.static(path.join(__dirname, '..', 'public')));

app.use((err, req, res, next) => {
  // eslint-disable-line no-unused-vars
  console.error(err);
  res.status(err.status || 500).json({
    error: err.name || 'InternalServerError',
    message: err.message || 'Something went wrong'
  });
});

app.listen(PORT, () => {
  console.log(`Imgkits Clone running on http://localhost:${PORT}`);
  console.log(`Swagger UI available at http://localhost:${PORT}/api/docs`);
});
