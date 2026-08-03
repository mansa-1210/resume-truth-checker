const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const analyzeResume = require('./analyzer');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static frontend files from the repository root
app.use(express.static(path.join(__dirname)));

app.post('/analyze', (req, res) => {
    const { content } = req.body;
    if (!content || content.trim() === '') {
        return res.json({ issues: [], suggestions: [], score: 100 });
    }

    db.run('INSERT INTO resumes(content) VALUES(?)', [content], (err) => {
        if (err) {
            console.error('DB insert error:', err.message || err);
            return res.status(500).json({ error: 'Database error' });
        }
        const analysis = analyzeResume(content);

        // Normalize score: analyzer may return a star-string; frontend expects numeric 0-100
        let score = 100;
        if (typeof analysis.score === 'string') {
            const stars = (analysis.score.match(/★/g) || []).length;
            score = Math.min(100, Math.max(20, stars * 20));
        } else if (typeof analysis.score === 'number') {
            score = analysis.score;
        }

        if (score < 30) score = 30;

        res.json({
            issues: analysis.issues,
            suggestions: analysis.suggestions,
            score: score,
            rating: analysis.rating || ''
        });

    });
});

// Serve index.html at root for browser access
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(3000, () => {
    console.log('Server running on http://127.0.0.1:3000');
});
