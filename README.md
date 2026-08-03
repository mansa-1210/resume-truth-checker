# Resume Truth Checker

An evidence-based resume credibility analyzer that identifies vague claims, potential exaggerations, consistency concerns, and claims requiring verification.

---

## One-line description

An evidence-based resume credibility analyzer that identifies vague claims, potential exaggerations, consistency concerns, and claims requiring verification.

## Overview

The Resume Truth Checker helps writers and reviewers improve resume quality by highlighting vague, unsupported, or potentially exaggerated claims and by identifying items that may require verification. It is deterministic, local, and does not call external services.

## Problem statement

Resumes often contain vague adjectives and unsupported claims that make it hard for reviewers to assess impact. This tool highlights such language and encourages users to add measurable, verifiable details.

## Features

- Context-aware detection of vague vs evidence-supported claims
- Identification of potentially exaggerated numeric claims
- Flags verification-required claims (certifications, publications, employers)
- Simple credibility scoring (0–100) representing evidence quality
- Per-claim suggestions and a summary dashboard
- Lightweight health endpoint and server-side validations

## How it works

- The analyzer splits input text into sentences, matches rule-based patterns for common vague phrases, evidence indicators, verification tokens, and extreme numbers.
- Claims are classified as VAGUE_CLAIM, EVIDENCE_SUPPORTED, POTENTIALLY_EXAGGERATED, or REQUIRES_VERIFICATION.
- A weighted scoring heuristic aggregates claim types into a 0–100 credibility score.

## Technology stack

- Node.js + Express (server)
- SQLite (local persistence)
- Vanilla HTML/CSS/JavaScript frontend

## Architecture

Single-process Express server serves static frontend files and exposes API endpoints. Analyzer runs locally in-process and stores submitted resumes in a local SQLite database.

## Project structure

- server.js — Express server and API endpoints
- analyzer.js — rule-based analyzer (claim extraction, classification, scoring)
- db.js — SQLite initialization and connection
- index.html, style.css, script.js — simple frontend UI
- README.md — documentation
- tests: test_analyzer.js, test_api.js, test_health.js

## Installation

1. npm install
2. npm start
3. Open http://127.0.0.1:3000

## Running locally (commands)

- Install dependencies: `npm install`
- Run tests: `npm test`
- Start server: `npm start`

## API endpoints

- POST /analyze
  - Request body: `{ "content": "<resume text>" }`
  - Response: `{ issues, suggestions, score, rating, claims }`
  - Errors: 400 for empty/malformed input, 413 for too-large payload, 500 for server errors

- GET /health
  - Response: `{ status: 'ok', db: 'ok' }` or `{ status: 'unhealthy', db: 'error' }`

## Testing

- `npm test` runs analyzer scenarios and API/health checks.

## Deployment notes

- The server binds to `process.env.PORT` (default 3000) and `process.env.HOST` (default 0.0.0.0) for portability.
- SQLite stores data in the `database/` folder. Note: many cloud platforms have ephemeral filesystems; SQLite persistence may not be reliable in ephemeral containers. For production, use a managed database or persistent volume.

## Limitations

- Heuristic, rule-based analysis — not a proof of truth.
- Limited set of patterns; domain-specific language may be missed.
- Negation and sentence parsing are simple heuristics.

## Security

- Frontend output is escaped to reduce XSS risk.
- SQL queries use parameterized statements.
- Server does not return internal stack traces.
- Do not send secrets or private data to the analyzer.

## Disclaimer

> The Resume Truth Checker does not determine whether a resume is truthful or whether a person is lying. It analyzes evidence quality, vague language, potential exaggeration signals, consistency concerns, and claims that may require verification.

---

## Portfolio Project Summary

Resume Truth Checker is a small, focused tool to help candidates and recruiters assess resume clarity and evidence quality. It highlights vague language, surfaces measurable achievements, and flags items that are unusual or require verification. Implemented as a self-contained Node.js app with a lightweight frontend, it is useful for demos, teaching, and portfolio showcases.

- Problem solved: helps improve resume clarity and credibility by making evidence expectations explicit.
- How it works: rule-based sentence analysis and scoring; no external services required.
- Key implementation: Express server, SQLite persistence, deterministic analyzer module, responsive UI.
- Main technologies: Node.js, Express, SQLite, vanilla JavaScript.

---

## Final notes

This repository is ready for local demonstration and lightweight deployment. Review the Limitations and Deployment notes before using in production.
