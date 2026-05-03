const TOOL_META = {
  'background-remover': { icon: '✂', tag: 'Free', gradient: 'linear-gradient(135deg,#a855f7,#ec4899)' },
  'background-replace': { icon: '🌅', tag: 'AI', gradient: 'linear-gradient(135deg,#06b6d4,#3b82f6)' },
  'photo-restore':      { icon: '🖼', tag: 'Pro', gradient: 'linear-gradient(135deg,#f59e0b,#ef4444)' },
  'unblur':             { icon: '🔍', tag: 'New', gradient: 'linear-gradient(135deg,#10b981,#06b6d4)' },
  'upscale':            { icon: '⤢',  tag: '8x',  gradient: 'linear-gradient(135deg,#8b5cf6,#6366f1)' },
  'object-remove':      { icon: '🪄', tag: 'AI', gradient: 'linear-gradient(135deg,#ec4899,#f97316)' },
  'style-transfer':     { icon: '🎨', tag: 'Hot', gradient: 'linear-gradient(135deg,#f472b6,#a855f7)' },
  'flyer-generator':    { icon: '📄', tag: 'New', gradient: 'linear-gradient(135deg,#06b6d4,#10b981)' },
  'fantasy-map':        { icon: '🗺', tag: 'AI', gradient: 'linear-gradient(135deg,#7c3aed,#06b6d4)' }
};

const TOOL_REQUIRES = {
  'flyer-generator': ['title'],
  'fantasy-map':     ['prompt']
};

const grid = document.getElementById('tools-grid');
const modal = document.getElementById('tool-modal');
const modalIcon = document.getElementById('modal-icon');
const modalTitle = document.getElementById('modal-title');
const modalDesc = document.getElementById('modal-desc');
const fileInput = document.getElementById('file-input');
const uploadArea = document.getElementById('upload-area');
const imageUrlInput = document.getElementById('image-url');
const runBtn = document.getElementById('run-btn');
const jobStatus = document.getElementById('job-status');
const resultPreview = document.getElementById('result-preview');
const resultImg = document.getElementById('result-img');

let currentTool = null;
let uploadedDataUrl = null;

async function loadTools() {
  try {
    const res = await fetch('/api/tools');
    const tools = await res.json();
    renderTools(tools);
  } catch (err) {
    grid.innerHTML = '<p class="muted">Failed to load tools. Make sure the API is running.</p>';
  }
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function renderTools(tools) {
  grid.innerHTML = '';
  for (const t of tools) {
    const meta = TOOL_META[t.slug] || { icon: '✦', tag: 'AI', gradient: 'var(--gradient)' };
    const card = document.createElement('article');
    card.className = 'tool-card';
    card.dataset.slug = t.slug;
    card.dataset.name = t.name;
    card.dataset.desc = t.description;
    card.innerHTML = `
      <span class="tool-tag">${escapeHtml(meta.tag)}</span>
      <div class="tool-icon" style="background:${escapeHtml(meta.gradient)}">${escapeHtml(meta.icon)}</div>
      <h3></h3>
      <p></p>
      <span class="tool-cta">Try Now</span>
    `;
    card.querySelector('h3').textContent = t.name;
    card.querySelector('p').textContent = t.description;
    card.addEventListener('click', () => {
      openTool({ slug: t.slug, name: t.name, description: t.description });
    });
    grid.appendChild(card);
  }
}

function openTool(tool) {
  currentTool = tool;
  uploadedDataUrl = null;
  imageUrlInput.value = '';
  jobStatus.hidden = true;
  resultPreview.hidden = true;
  jobStatus.classList.remove('error');

  const meta = TOOL_META[tool.slug] || {};
  modalIcon.style.background = meta.gradient || 'var(--gradient)';
  modalIcon.textContent = meta.icon || '✦';
  modalTitle.textContent = tool.name;
  modalDesc.textContent = tool.description;

  modal.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  modal.hidden = true;
  document.body.style.overflow = '';
}

modal.querySelectorAll('[data-close]').forEach(el => {
  el.addEventListener('click', closeModal);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !modal.hidden) closeModal();
});

uploadArea.addEventListener('click', () => fileInput.click());
['dragenter', 'dragover'].forEach(evt => {
  uploadArea.addEventListener(evt, (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
  });
});
['dragleave', 'drop'].forEach(evt => {
  uploadArea.addEventListener(evt, (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
  });
});
uploadArea.addEventListener('drop', (e) => {
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});
fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) handleFile(file);
});

function handleFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    uploadedDataUrl = e.target.result;
    imageUrlInput.value = `(uploaded: ${file.name})`;
    showStatus(`Uploaded ${file.name} — ready to run.`);
  };
  reader.readAsDataURL(file);
}

function showStatus(text, kind) {
  jobStatus.hidden = false;
  jobStatus.classList.toggle('error', kind === 'error');
  jobStatus.innerHTML = text;
}

runBtn.addEventListener('click', async () => {
  if (!currentTool) return;
  const required = TOOL_REQUIRES[currentTool.slug] || [];
  const payload = {};

  if (required.includes('title')) {
    const title = prompt('Flyer title:', 'Summer Sale');
    if (!title) return;
    payload.title = title;
    payload.subtitle = 'Up to 50% off';
  } else if (required.includes('prompt')) {
    const p = prompt('Describe your map:', 'A continent with frozen north and desert south');
    if (!p) return;
    payload.prompt = p;
  } else {
    const url = uploadedDataUrl || imageUrlInput.value.trim();
    if (!url || url.startsWith('(uploaded:')) {
      if (uploadedDataUrl) {
        payload.imageUrl = uploadedDataUrl.startsWith('data:') ? 'https://example.com/uploaded.jpg' : uploadedDataUrl;
      } else {
        showStatus('Please upload an image or paste an image URL.', 'error');
        return;
      }
    } else {
      payload.imageUrl = url;
    }

    if (currentTool.slug === 'style-transfer') {
      payload.style = 'anime';
    }
    if (currentTool.slug === 'object-remove') {
      payload.mask = 'data:image/png;base64,iVBORw0KGgo=';
    }
  }

  runBtn.disabled = true;
  runBtn.textContent = 'Submitting...';
  resultPreview.hidden = true;

  try {
    const res = await fetch(`/api/tools/${currentTool.slug}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      showStatus(`Error: ${data.message || data.error}`, 'error');
      return;
    }
    showStatus(`Job <code>${data.jobId}</code> created <span class="pill pill-queued">queued</span>`);
    pollJob(data.jobId);
  } catch (err) {
    showStatus(`Network error: ${err.message}`, 'error');
  } finally {
    runBtn.disabled = false;
    runBtn.textContent = 'Run AI';
  }
});

async function pollJob(jobId) {
  const start = Date.now();
  const tick = async () => {
    try {
      const r = await fetch(`/api/jobs/${jobId}`);
      const job = await r.json();
      const pillClass = `pill-${job.status}`;
      showStatus(`Job <code>${jobId}</code> <span class="pill ${pillClass}">${job.status}</span>`);
      if (job.status === 'done') {
        resultPreview.hidden = false;
        resultImg.src = job.resultUrl;
        return;
      }
      if (job.status === 'failed') return;
      if (Date.now() - start > 15000) {
        showStatus('Timed out waiting for result.', 'error');
        return;
      }
      setTimeout(tick, 600);
    } catch (err) {
      showStatus(`Polling error: ${err.message}`, 'error');
    }
  };
  tick();
}

loadTools();
