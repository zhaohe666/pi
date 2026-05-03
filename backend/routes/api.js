const express = require('express');
const store = require('../store');

const router = express.Router();

function scheduleJobCompletion(jobId, tool) {
  setTimeout(() => store.updateJob(jobId, { status: 'processing' }), 200);
  setTimeout(() => store.updateJob(jobId, {
    status: 'done',
    completed_at: new Date().toISOString(),
    result_url: `https://placehold.co/800x600/7c3aed/ffffff/png?text=${encodeURIComponent(tool)}`
  }), 1500);
}

function ensureToolEnabled(slug, res) {
  const tool = store.tools.get(slug);
  if (!tool) {
    res.status(404).json({ error: 'NotFound', message: `Tool "${slug}" not found` });
    return false;
  }
  if (!tool.enabled) {
    res.status(503).json({ error: 'ToolDisabled', message: `Tool "${slug}" is currently disabled by admin` });
    return false;
  }
  if (store.settings.maintenanceMode) {
    res.status(503).json({ error: 'Maintenance', message: 'Service is under maintenance' });
    return false;
  }
  return true;
}

function runTool(slug, req, res, validator) {
  if (!ensureToolEnabled(slug, res)) return;
  const err = validator ? validator(req.body) : null;
  if (err) return res.status(400).json({ error: 'BadRequest', message: err });
  const job = store.createJob({ tool: slug, payload: req.body });
  scheduleJobCompletion(job.jobId, slug);
  res.status(202).json(job);
}

/**
 * @openapi
 * /api/health:
 *   get:
 *     tags: [System]
 *     summary: Service health check
 *     responses:
 *       200: { description: Service status }
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    version: '1.0.0',
    maintenance: !!store.settings.maintenanceMode
  });
});

/**
 * @openapi
 * /api/tools:
 *   get:
 *     tags: [System]
 *     summary: List enabled AI tools
 *     responses:
 *       200: { description: A list of tools }
 */
router.get('/tools', (req, res) => {
  const list = store.tools.all()
    .filter(t => t.enabled)
    .map(({ slug, name, description, category, credits }) => ({ slug, name, description, category, credits }));
  res.json(list);
});

const requireImageUrl = (b) => (!b || !b.imageUrl) ? 'imageUrl is required' : null;

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
 *           schema: { $ref: '#/components/schemas/ImageUrlInput' }
 *     responses:
 *       202: { description: Job accepted, content: { application/json: { schema: { $ref: '#/components/schemas/JobResponse' } } } }
 *       400: { description: Bad request }
 */
router.post('/tools/background-remover', (req, res) => runTool('background-remover', req, res, requireImageUrl));

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
 *           schema: { $ref: '#/components/schemas/BackgroundReplaceInput' }
 *     responses:
 *       202: { description: Job accepted }
 */
router.post('/tools/background-replace', (req, res) => runTool('background-replace', req, res, requireImageUrl));

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
 *           schema: { $ref: '#/components/schemas/ImageUrlInput' }
 *     responses:
 *       202: { description: Job accepted }
 */
router.post('/tools/photo-restore', (req, res) => runTool('photo-restore', req, res, requireImageUrl));

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
 *           schema: { $ref: '#/components/schemas/ImageUrlInput' }
 *     responses:
 *       202: { description: Job accepted }
 */
router.post('/tools/unblur', (req, res) => runTool('unblur', req, res, requireImageUrl));

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
 *           schema: { $ref: '#/components/schemas/UpscaleInput' }
 *     responses:
 *       202: { description: Job accepted }
 */
router.post('/tools/upscale', (req, res) => runTool('upscale', req, res, requireImageUrl));

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
 *           schema: { $ref: '#/components/schemas/ObjectRemovalInput' }
 *     responses:
 *       202: { description: Job accepted }
 */
router.post('/tools/object-remove', (req, res) => runTool('object-remove', req, res,
  (b) => (!b || !b.imageUrl || !b.mask) ? 'imageUrl and mask are required' : null
));

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
 *           schema: { $ref: '#/components/schemas/StyleTransferInput' }
 *     responses:
 *       202: { description: Job accepted }
 */
router.post('/tools/style-transfer', (req, res) => runTool('style-transfer', req, res,
  (b) => (!b || !b.imageUrl || !b.style) ? 'imageUrl and style are required' : null
));

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
 *           schema: { $ref: '#/components/schemas/FlyerGenInput' }
 *     responses:
 *       202: { description: Job accepted }
 */
router.post('/tools/flyer-generator', (req, res) => runTool('flyer-generator', req, res,
  (b) => (!b || !b.title) ? 'title is required' : null
));

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
 *           schema: { $ref: '#/components/schemas/FantasyMapInput' }
 *     responses:
 *       202: { description: Job accepted }
 */
router.post('/tools/fantasy-map', (req, res) => runTool('fantasy-map', req, res,
  (b) => (!b || !b.prompt) ? 'prompt is required' : null
));

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
 *         schema: { type: string }
 *     responses:
 *       200: { description: Job details }
 *       404: { description: Job not found }
 */
router.get('/jobs/:jobId', (req, res) => {
  const job = store.jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'NotFound', message: 'Job not found' });
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
 *       200: { description: List of jobs }
 */
router.get('/jobs', (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 20;
  res.json(store.jobs.all().slice(0, limit));
});

module.exports = router;
