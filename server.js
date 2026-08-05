const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const analyzeResume = require('./analyzer');

const app = express();
app.use(cors());
app.use(express.json({ limit: '200kb' }));

// file upload and extraction libs (lazily required when available)
let multer, pdfParse, mammoth, os, fs;
try {
  multer = require('multer');
  pdfParse = require('pdf-parse');
  mammoth = require('mammoth');
  os = require('os');
  fs = require('fs');
} catch (e) {
  // if optional libs are not installed, upload endpoint will return an error
  console.warn('Optional file-extraction libraries not installed. Upload endpoint will be disabled.');
}

// lightweight request logging (no sensitive data)
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} [REQ] ${req.method} ${req.url}`);
  next();
});

// Serve static frontend files from the repository root
app.use(express.static(path.join(__dirname)));

app.post('/analyze', (req, res) => {
    try {
        const { content } = req.body || {};
        if (!content || typeof content !== 'string' || content.trim() === '') {
            return res.status(400).json({ error: 'Empty or invalid resume content', issues: [], suggestions: [], score: 60, rating: 'Needs Improvement', claims: [] });
        }

        if (content.length > 20000) {
            return res.status(413).json({ error: 'Resume content too large' });
        }

        // store safely (parameterized)
        db.run('INSERT INTO resumes(content) VALUES(?)', [content], (err) => {
            if (err) {
                console.error('DB insert error:', err.message || err);
                return res.status(500).json({ error: 'Database error' });
            }

            let analysis;
            try {
                analysis = analyzeResume(content);
            } catch (e) {
                console.error('Analyzer error:', e && e.message ? e.message : e);
                return res.status(500).json({ error: 'Analyzer failure' });
            }

            // ensure numeric score
            let score = 60;
            if (typeof analysis.score === 'number') score = analysis.score;
            else if (typeof analysis.score === 'string') {
                const stars = (analysis.score.match(/★/g) || []).length;
                score = Math.min(100, Math.max(20, stars * 20));
            }

            score = Math.max(0, Math.min(100, Math.round(score)));

            // build response without exposing internals
            return res.json({
                issues: analysis.issues || [],
                suggestions: analysis.suggestions || [],
                score: score,
                rating: analysis.rating || '',
                claims: analysis.claims || []
            });
        });
    } catch (err) {
        console.error('Unexpected /analyze error:', err && err.message ? err.message : err);
        return res.status(500).json({ error: 'Server error' });
    }
});

// Upload endpoint (multipart/form-data) - extracts text from uploaded files and runs the analyzer
app.post('/upload', async (req, res) => {
  if (!multer || !pdfParse || !mammoth) {
    return res.status(501).json({ error: 'Upload support not available on this deployment' });
  }

  const tmpDir = path.join(__dirname, 'tmp_uploads');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const storage = multer.diskStorage({
    destination: tmpDir,
    filename: (req, file, cb) => {
      const ts = Date.now();
      const safeName = (file.originalname || 'upload').replace(/[^a-zA-Z0-9.\-_]/g, '_');
      cb(null, `${ts}-${safeName}`);
    }
  });

  const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
      const allowed = ['application/pdf','text/plain','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (allowed.includes(file.mimetype) || /\.(pdf|txt|docx?|DOCX?)$/i.test(file.originalname || '')) cb(null, true);
      else cb(new Error('Unsupported file type'), false);
    }
  }).single('resumeFile');

  upload(req, res, async function(err) {
    if (err) {
      console.error('Upload error:', err.message || err);
      return res.status(400).json({ error: err.message || 'Upload failed' });
    }

    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const filePath = req.file.path;
    const originalName = req.file.originalname;
    const size = req.file.size;

    let extracted = '';
    try {
      if (/\.pdf$/i.test(originalName) || req.file.mimetype === 'application/pdf') {
        const data = fs.readFileSync(filePath);
        const pdfRes = await pdfParse(data);
        extracted = pdfRes.text || '';
      } else if (/\.docx?$/i.test(originalName) || req.file.mimetype.includes('word')) {
        const mammothRes = await mammoth.extractRawText({ path: filePath });
        extracted = mammothRes.value || '';
      } else if (/\.txt$/i.test(originalName) || req.file.mimetype === 'text/plain') {
        extracted = fs.readFileSync(filePath, 'utf8');
      } else {
        throw new Error('Unsupported file type for extraction');
      }

      // Run analyzer (do not persist uploaded content by default)
      const analysis = analyzeResume(extracted || '');

      // prepare response including metadata
      const response = {
        filename: originalName,
        size,
        extractedLength: (extracted || '').length,
        issues: analysis.issues || [],
        suggestions: analysis.suggestions || [],
        score: typeof analysis.score === 'number' ? analysis.score : null,
        rating: analysis.rating || '',
        claims: analysis.claims || [],
        extractedText: extracted || ''
      };

      res.json(response);
    } catch (e) {
      console.error('Extraction error:', e && e.message ? e.message : e);
      return res.status(500).json({ error: 'Failed to extract text from the uploaded file' });
    } finally {
      // cleanup temporary file
      try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (e) { /* ignore */ }
    }
  });
});

// Health endpoint
app.get('/health', (req, res) => {
  // check db
  db.get('SELECT 1 as ok', (err, row) => {
    if (err) {
      console.error('Health check DB error:', err.message || err);
      return res.status(500).json({ status: 'unhealthy', db: 'error' });
    }
    return res.json({ status: 'ok', db: 'ok' });
  });
});

// Serve index.html at root for browser access
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
    console.log(`Server running on http://127.0.0.1:${PORT}`);
});
