// server.js
// Simple Express server to accept album submissions (audio files + metadata),
// store uploads on disk, keep a JSON submissions DB, and provide an admin dashboard
// to approve/reject and download submissions as zip files.
//
// ADMIN PASSWORD:
// - Set environment variable ADMIN_PASS to customize admin password
// - Default (for demo only): "adminpass"
//
// Run: npm install && npm start

const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const session = require('express-session');
const archiver = require('archiver');
const { v4: uuidv4 } = require('uuid');

const app = express();

// --- File system paths and DB setup (must be declared BEFORE middleware that uses them) ---
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'submissions.json');
const ADMIN_PASS = process.env.ADMIN_PASS || 'adminpass';

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify([]), 'utf8');

function readDB() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}
function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// --- Express setup ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'tidalwav-demo-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

// Serve public files at web root (so /styles.css and /app.js work)
app.use(express.static(path.join(__dirname, 'public')));

// Serve uploaded files
app.use('/uploads', express.static(UPLOADS_DIR));

// Simple auth middleware for admin
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.redirect('/admin/login');
}

// Multer storage: store into a temp folder per submission id
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // req._subId is set in the single-upload middleware before file handling
    const subId = req._subId || uuidv4();
    const dest = path.join(UPLOADS_DIR, subId);
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: function (req, file, cb) {
    // preserve original filename
    cb(null, file.originalname);
  }
});

const upload = multer({ storage });

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Submit endpoint: expects multipart/form-data
// fields:
// - albumName, releaseDate, platforms (comma-separated), numSongs, cover (single file)
// - tracks: a JSON string representing array of tracks metadata (title, featured, explicit)
// - trackFiles: multiple files (audio) field name trackFiles
app.post('/submit', (req, res, next) => {
  // pre-generate submission id and attach so multer's destination can use it
  req._subId = uuidv4();
  next();
}, upload.fields([
  { name: 'cover', maxCount: 1 },
  { name: 'trackFiles', maxCount: 200 }
]), (req, res) => {
  try {
    const subId = req._subId;
    const dest = path.join(UPLOADS_DIR, subId);

    // parse fields
    const albumName = (req.body.albumName || '').trim();
    const releaseDate = req.body.releaseDate || '';
    const platforms = (req.body.platforms || '').split(',').map(s => s.trim()).filter(Boolean);
    const numSongs = parseInt(req.body.numSongs || '0', 10) || 0;

    let tracks = [];
    try {
      tracks = JSON.parse(req.body.tracks || '[]');
    } catch (e) {
      return res.status(400).json({ error: 'Invalid tracks metadata' });
    }

    // files
    const coverFile = req.files['cover'] && req.files['cover'][0];
    const audioFiles = req.files['trackFiles'] || [];

    // Map audio files to tracks by filename if possible (front-end will send trackFileName field)
    // fallback: match by index order
    const tracksWithFiles = tracks.map((t, idx) => {
      const matched = audioFiles.find(f => f.originalname === (t.fileName || ''));
      if (matched) return { ...t, file: path.relative(UPLOADS_DIR, matched.path), originalFileName: matched.originalname };
      const fallback = audioFiles[idx];
      if (fallback) return { ...t, file: path.relative(UPLOADS_DIR, fallback.path), originalFileName: fallback.originalname };
      return { ...t, file: null, originalFileName: null };
    });

    const submission = {
      id: subId,
      albumName,
      releaseDate,
      platforms,
      numSongs,
      cover: coverFile ? path.relative(UPLOADS_DIR, coverFile.path) : null,
      tracks: tracksWithFiles,
      createdAt: new Date().toISOString(),
      status: 'pending', // pending | approved | rejected
      adminNote: null
    };

    // save to DB
    const db = readDB();
    db.push(submission);
    writeDB(db);

    res.json({ ok: true, id: subId, message: 'Submission received. Admin will review.' });
  } catch (err) {
    console.error('submit error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin login pages (simple)
app.get('/admin/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});

app.post('/admin/login', express.urlencoded({ extended: true }), (req, res) => {
  const pass = req.body.password || '';
  if (pass === ADMIN_PASS) {
    req.session.isAdmin = true;
    return res.redirect('/admin/dashboard');
  }
  return res.redirect('/admin/login?err=1');
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/admin/login');
  });
});

// Dashboard (protected)
app.get('/admin/dashboard', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-dashboard.html'));
});

// API: list submissions
app.get('/admin/api/submissions', requireAdmin, (req, res) => {
  const db = readDB();
  res.json(db);
});

// API: get single submission metadata
app.get('/admin/api/submissions/:id', requireAdmin, (req, res) => {
  const db = readDB();
  const sub = db.find(s => s.id === req.params.id);
  if (!sub) return res.status(404).json({ error: 'Not found' });
  res.json(sub);
});

// Admin approve/reject
app.post('/admin/api/submissions/:id/approve', requireAdmin, express.json(), (req, res) => {
  const db = readDB();
  const sub = db.find(s => s.id === req.params.id);
  if (!sub) return res.status(404).json({ error: 'Not found' });
  sub.status = 'approved';
  sub.adminNote = req.body.note || null;
  writeDB(db);
  res.json({ ok: true });
});

app.post('/admin/api/submissions/:id/reject', requireAdmin, express.json(), (req, res) => {
  const db = readDB();
  const sub = db.find(s => s.id === req.params.id);
  if (!sub) return res.status(404).json({ error: 'Not found' });
  sub.status = 'rejected';
  sub.adminNote = req.body.note || null;
  writeDB(db);
  res.json({ ok: true });
});

// Download submission as zip (audio files + cover + metadata.json)
app.get('/admin/download/:id', requireAdmin, (req, res) => {
  const db = readDB();
  const sub = db.find(s => s.id === req.params.id);
  if (!sub) return res.status(404).send('Not found');

  const dir = path.join(UPLOADS_DIR, sub.id);
  if (!fs.existsSync(dir)) return res.status(404).send('Files missing');

  res.setHeader('Content-Disposition', `attachment; filename=${(sub.albumName || sub.id).replace(/[^a-z0-9_\-\.]/gi, '_')}.zip`);
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', err => res.status(500).send({ error: err.message }));
  archive.pipe(res);

  // add metadata
  archive.append(JSON.stringify(sub, null, 2), { name: 'metadata.json' });

  // add cover
  if (sub.cover) {
    const coverPath = path.join(UPLOADS_DIR, sub.cover);
    if (fs.existsSync(coverPath)) archive.file(coverPath, { name: path.basename(coverPath) });
  }

  // add tracks
  sub.tracks.forEach((t, idx) => {
    if (t.file) {
      const full = path.join(UPLOADS_DIR, t.file);
      if (fs.existsSync(full)) {
        const name = t.originalFileName || (`track-${idx + 1}${path.extname(full)}`);
        archive.file(full, { name });
      }
    }
  });

  archive.finalize();
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log(`Admin login: http://localhost:${PORT}/admin/login (password from ADMIN_PASS or default 'adminpass')`);
});