const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const analyzeResume = require('./analyzer');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50kb' }));

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
