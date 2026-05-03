const express = require('express');
const crypto = require('crypto');

const router = express.Router();

const jobs = new Map();

function createJob(tool, payload) {
  const jobId = `job_${crypto.randomBytes(6).toString('hex')}`;
  const now = new Date().toISOString();
  const job = {
    jobId,
    tool,
    status: 'queued',
    createdAt: now,
    completedAt: null,
    resultUrl: null,
    metadata: { input: payload }
  };
  jobs.set(jobId, job);

  setTimeout(() => {
    job.status = 'processing';
  }, 200);

  setTimeout(() => {
    job.status = 'done';
    job.completedAt = new Date().toISOString();
    job.resultUrl = `https://placehold.co/800x600/7c3aed/ffffff/png?text=${encodeURIComponent(tool)}`;
  }, 1500);

  return job;
}

/**
 * @openapi
 * /api/health:
 *   get:
 *     tags: [System]
 *     summary: Service health check
 *     responses:
 *       200:
 *         description: Service status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: ok }
 *                 uptime: { type: number }
 *                 version: { type: string }
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    version: '1.0.0'
  });
});

/**
 * @openapi
 * /api/tools:
 *   get:
 *     tags: [System]
 *     summary: List all available AI tools
 *     responses:
 *       200:
 *         description: A list of tools and their descriptions
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   slug: { type: string }
 *                   name: { type: string }
 *                   description: { type: string }
 *                   category: { type: string }
 */
router.get('/tools', (req, res) => {
  res.json([
    { slug: 'background-remover', name: 'AI Background Remover', description: 'Remove the background from any photo in one click.', category: 'Editing' },
    { slug: 'background-replace', name: 'AI Background Replace', description: 'Replace your background with AI-generated scenes.', category: 'Editing' },
    { slug: 'photo-restore', name: 'Photo Restoration', description: 'Restore old, blurry or damaged photos with AI.', category: 'Enhance' },
    { slug: 'unblur', name: 'AI Unblur', description: 'Sharpen blurry images and recover lost detail.', category: 'Enhance' },
    { slug: 'upscale', name: 'AI Image Upscaler', description: 'Upscale images up to 8x without losing quality.', category: 'Enhance' },
    { slug: 'object-remove', name: 'AI Object Remover', description: 'Erase unwanted objects, people, or text.', category: 'Editing' },
    { slug: 'style-transfer', name: 'Photo to Art', description: 'Turn photos into anime, Pixar, sketch, watercolor styles.', category: 'Creative' },
    { slug: 'flyer-generator', name: 'AI Flyer Generator', description: 'Design promotional flyers with a single prompt.', category: 'Generate' },
    { slug: 'fantasy-map', name: 'Fantasy Map Generator', description: 'Generate beautiful fantasy maps from text prompts.', category: 'Generate' }
  ]);
});

/**
 * @openapi
 * /api/tools/background-remover:
 *   post:
 *     tags: [Image Editing]
 *     summary: Remove the background from an image
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ImageUrlInput'
 *     responses:
 *       202:
 *         description: Job accepted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/JobResponse'
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/tools/background-remover', (req, res) => {
  const { imageUrl } = req.body || {};
  if (!imageUrl) {
    return res.status(400).json({ error: 'BadRequest', message: 'imageUrl is required' });
  }
  const job = createJob('background-remover', req.body);
  res.status(202).json(job);
});

/**
 * @openapi
 * /api/tools/background-replace:
 *   post:
 *     tags: [Image Editing]
 *     summary: Replace the background of an image with an AI-generated scene
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BackgroundReplaceInput'
 *     responses:
 *       202:
 *         description: Job accepted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/JobResponse'
 */
router.post('/tools/background-replace', (req, res) => {
  const { imageUrl } = req.body || {};
  if (!imageUrl) {
    return res.status(400).json({ error: 'BadRequest', message: 'imageUrl is required' });
  }
  const job = createJob('background-replace', req.body);
  res.status(202).json(job);
});

/**
 * @openapi
 * /api/tools/photo-restore:
 *   post:
 *     tags: [Image Editing]
 *     summary: Restore old or damaged photos
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ImageUrlInput'
 *     responses:
 *       202:
 *         description: Job accepted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/JobResponse'
 */
router.post('/tools/photo-restore', (req, res) => {
  const { imageUrl } = req.body || {};
  if (!imageUrl) {
    return res.status(400).json({ error: 'BadRequest', message: 'imageUrl is required' });
  }
  const job = createJob('photo-restore', req.body);
  res.status(202).json(job);
});

/**
 * @openapi
 * /api/tools/unblur:
 *   post:
 *     tags: [Image Editing]
 *     summary: Unblur and sharpen a blurry image
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ImageUrlInput'
 *     responses:
 *       202:
 *         description: Job accepted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/JobResponse'
 */
router.post('/tools/unblur', (req, res) => {
  const { imageUrl } = req.body || {};
  if (!imageUrl) {
    return res.status(400).json({ error: 'BadRequest', message: 'imageUrl is required' });
  }
  const job = createJob('unblur', req.body);
  res.status(202).json(job);
});

/**
 * @openapi
 * /api/tools/upscale:
 *   post:
 *     tags: [Image Editing]
 *     summary: Upscale an image up to 8x
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpscaleInput'
 *     responses:
 *       202:
 *         description: Job accepted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/JobResponse'
 */
router.post('/tools/upscale', (req, res) => {
  const { imageUrl } = req.body || {};
  if (!imageUrl) {
    return res.status(400).json({ error: 'BadRequest', message: 'imageUrl is required' });
  }
  const job = createJob('upscale', req.body);
  res.status(202).json(job);
});

/**
 * @openapi
 * /api/tools/object-remove:
 *   post:
 *     tags: [Image Editing]
 *     summary: Remove objects from an image using a mask
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ObjectRemovalInput'
 *     responses:
 *       202:
 *         description: Job accepted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/JobResponse'
 */
router.post('/tools/object-remove', (req, res) => {
  const { imageUrl, mask } = req.body || {};
  if (!imageUrl || !mask) {
    return res.status(400).json({ error: 'BadRequest', message: 'imageUrl and mask are required' });
  }
  const job = createJob('object-remove', { imageUrl, hasMask: true });
  res.status(202).json(job);
});

/**
 * @openapi
 * /api/tools/style-transfer:
 *   post:
 *     tags: [Style Transfer]
 *     summary: Convert a photo into an artistic style
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StyleTransferInput'
 *     responses:
 *       202:
 *         description: Job accepted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/JobResponse'
 */
router.post('/tools/style-transfer', (req, res) => {
  const { imageUrl, style } = req.body || {};
  if (!imageUrl || !style) {
    return res.status(400).json({ error: 'BadRequest', message: 'imageUrl and style are required' });
  }
  const job = createJob('style-transfer', req.body);
  res.status(202).json(job);
});

/**
 * @openapi
 * /api/tools/flyer-generator:
 *   post:
 *     tags: [Image Generation]
 *     summary: Generate a promotional flyer from text
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FlyerGenInput'
 *     responses:
 *       202:
 *         description: Job accepted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/JobResponse'
 */
router.post('/tools/flyer-generator', (req, res) => {
  const { title } = req.body || {};
  if (!title) {
    return res.status(400).json({ error: 'BadRequest', message: 'title is required' });
  }
  const job = createJob('flyer-generator', req.body);
  res.status(202).json(job);
});

/**
 * @openapi
 * /api/tools/fantasy-map:
 *   post:
 *     tags: [Image Generation]
 *     summary: Generate a fantasy map from a prompt
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FantasyMapInput'
 *     responses:
 *       202:
 *         description: Job accepted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/JobResponse'
 */
router.post('/tools/fantasy-map', (req, res) => {
  const { prompt } = req.body || {};
  if (!prompt) {
    return res.status(400).json({ error: 'BadRequest', message: 'prompt is required' });
  }
  const job = createJob('fantasy-map', req.body);
  res.status(202).json(job);
});

/**
 * @openapi
 * /api/jobs/{jobId}:
 *   get:
 *     tags: [Jobs]
 *     summary: Get the status and result of a processing job
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Job details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/JobResult'
 *       404:
 *         description: Job not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/jobs/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'NotFound', message: 'Job not found' });
  }
  res.json(job);
});

/**
 * @openapi
 * /api/jobs:
 *   get:
 *     tags: [Jobs]
 *     summary: List recent jobs
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: List of jobs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/JobResult'
 */
router.get('/jobs', (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 20;
  const list = Array.from(jobs.values())
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, limit);
  res.json(list);
});

module.exports = router;
