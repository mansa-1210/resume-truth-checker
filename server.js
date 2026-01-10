const express = require('express');
const cors = require('cors');
const db = require('./db');
const analyzeResume = require('./analyzer');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/analyze', (req, res) => {
    const { content } = req.body;
    if (!content || content.trim() === '') {
        return res.json({ issues: [], suggestions: [] });
    }

    db.run('INSERT INTO resumes(content) VALUES(?)', [content], (err) => {
        if (err) throw err;
       const analysis = analyzeResume(content);

// ---- ADD SCORE LOGIC ----
let score = 100;
score -= analysis.issues.length * 10;
if (score < 30) score = 30;

// ---- SEND RESPONSE ----
res.json({
    issues: analysis.issues,
    suggestions: analysis.suggestions,
    score: score
});

    });
});

app.listen(3000, () => {
    console.log('Server running on http://127.0.0.1:3000');
});
