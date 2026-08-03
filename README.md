Resume Truth Checker

A small local tool to analyze resume text for vague language, evidence-supported claims, potential exaggerations, and items requiring verification. It is deterministic and does not call external services.

Disclaimer

The Resume Truth Checker does not determine whether a resume is truthful or whether a person is lying. It analyzes evidence quality, vague language, potential exaggeration signals, consistency concerns, and claims that may require verification.

Features
- Paste resume text and analyze claims
- Context-aware detection of vague vs evidence-supported claims
- Simple scoring (0-100) representing evidence quality
- Health endpoint and server-side validations

Tech stack
- Node.js (Express)
- SQLite (sqlite3)
- Vanilla HTML/CSS/JS frontend

Installation
1. npm install
2. npm start
3. Open http://127.0.0.1:3000

API
- POST /analyze
  - body: { content: string }
  - responses: { issues, suggestions, score, rating, claims }
- GET /health
  - returns server and database status

Testing
- npm test (runs analyzer and API/health quick checks)

Limitations
- Heuristic-only analysis; not a proof of truth
- Limited pattern coverage; may miss domain-specific claims
- No external verification or AI model integration

Security
- Outputs are escaped in the frontend to prevent XSS
- Database queries are parameterized
- Do not send secrets to the analyzer
