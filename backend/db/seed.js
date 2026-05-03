const crypto = require('crypto');
const db = require('./index');

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 32).toString('hex');
}

function nowIso() {
  return new Date().toISOString();
}

function rid(prefix, bytes = 5) {
  return `${prefix}_${crypto.randomBytes(bytes).toString('hex')}`;
}

const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
const toolCount = db.prepare('SELECT COUNT(*) AS c FROM tools').get().c;

const insertUser = db.prepare(`
  INSERT INTO users (id, email, name, role, status, plan, credits, salt, password_hash, created_at)
  VALUES (@id, @email, @name, @role, @status, @plan, @credits, @salt, @password_hash, @created_at)
`);

const insertTool = db.prepare(`
  INSERT INTO tools (slug, name, description, category, enabled, credits)
  VALUES (@slug, @name, @description, @category, @enabled, @credits)
`);

const insertSetting = db.prepare(`
  INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)
`);

const insertApiKey = db.prepare(`
  INSERT INTO api_keys (id, user_id, label, key_preview, key_hash, enabled, created_at)
  VALUES (@id, @user_id, @label, @key_preview, @key_hash, 1, @created_at)
`);

if (userCount === 0) {
  const seedUser = ({ email, password, name, role = 'user', credits = 50, status = 'active', plan = 'free' }) => {
    const id = rid('usr');
    const salt = crypto.randomBytes(8).toString('hex');
    insertUser.run({
      id, email, name, role, status, plan, credits,
      salt, password_hash: hashPassword(password, salt),
      created_at: nowIso()
    });
    return { id, email };
  };

  const admin = seedUser({ email: 'admin@imgkits.local', password: 'admin123', name: 'Admin', role: 'admin', credits: 99999, plan: 'team' });
  seedUser({ email: 'alice@example.com', password: 'demo', name: 'Alice Chen', credits: 120, plan: 'pro' });
  seedUser({ email: 'bob@example.com',   password: 'demo', name: 'Bob Lee',    credits: 38 });
  seedUser({ email: 'carol@example.com', password: 'demo', name: 'Carol Wang', credits: 0, status: 'suspended' });

  const plainKey = `sk_${crypto.randomBytes(16).toString('hex')}`;
  insertApiKey.run({
    id: rid('key', 4),
    user_id: admin.id,
    label: 'Default admin key',
    key_preview: `${plainKey.slice(0, 8)}...${plainKey.slice(-4)}`,
    key_hash: crypto.createHash('sha256').update(plainKey).digest('hex'),
    created_at: nowIso()
  });
  console.log('Seeded users + admin api key');
}

if (toolCount === 0) {
  const tools = [
    { slug: 'background-remover', name: 'AI Background Remover', description: 'Remove the background from any photo in one click.', category: 'Editing', enabled: 1, credits: 1 },
    { slug: 'background-replace', name: 'AI Background Replace', description: 'Replace your background with AI-generated scenes.', category: 'Editing', enabled: 1, credits: 2 },
    { slug: 'photo-restore',      name: 'Photo Restoration',     description: 'Restore old, blurry or damaged photos with AI.', category: 'Enhance', enabled: 1, credits: 2 },
    { slug: 'unblur',             name: 'AI Unblur',             description: 'Sharpen blurry images and recover lost detail.', category: 'Enhance', enabled: 1, credits: 1 },
    { slug: 'upscale',            name: 'AI Image Upscaler',     description: 'Upscale images up to 8x without losing quality.', category: 'Enhance', enabled: 1, credits: 3 },
    { slug: 'object-remove',      name: 'AI Object Remover',     description: 'Erase unwanted objects, people, or text.',       category: 'Editing', enabled: 1, credits: 2 },
    { slug: 'style-transfer',     name: 'Photo to Art',          description: 'Turn photos into anime, Pixar, sketch, watercolor styles.', category: 'Creative', enabled: 1, credits: 2 },
    { slug: 'flyer-generator',    name: 'AI Flyer Generator',    description: 'Design promotional flyers with a single prompt.', category: 'Generate', enabled: 1, credits: 4 },
    { slug: 'fantasy-map',        name: 'Fantasy Map Generator', description: 'Generate beautiful fantasy maps from text prompts.', category: 'Generate', enabled: 1, credits: 4 }
  ];
  const insertMany = db.transaction((rows) => { for (const r of rows) insertTool.run(r); });
  insertMany(tools);
  console.log(`Seeded ${tools.length} tools`);
}

const defaultSettings = {
  siteName: 'ImgKits',
  maintenanceMode: false,
  allowSignups: true,
  freeCreditsPerDay: 5,
  maxUploadMb: 20,
  resultExpireHours: 24
};
for (const [k, v] of Object.entries(defaultSettings)) {
  const existing = db.prepare('SELECT value FROM settings WHERE key = ?').get(k);
  if (!existing) insertSetting.run(k, JSON.stringify(v));
}

console.log('Seed complete');
