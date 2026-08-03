// backend/analyzer.js
console.log("Analyzer loaded with context-aware matching + weighted scoring");

// Expanded pattern categories (vague phrases grouped)
const patternDefinitions = [
  // Vague personal traits
  { label: 'hard working', regex: /hard\s*[-]?\s*working/i, category: 'vague' },
  { label: 'hardworking', regex: /hardworking/i, category: 'vague' },
  { label: 'team player', regex: /team\s*[-]?\s*player/i, category: 'vague' },
  { label: 'self motivated', regex: /self\s*[-]?\s*motivated/i, category: 'vague' },
  { label: 'passionate', regex: /passionate(\s*about)?/i, category: 'vague' },
  { label: 'dedicated', regex: /dedicated/i, category: 'vague' },
  { label: 'enthusiastic', regex: /enthusiastic/i, category: 'vague' },
  { label: 'quick learner', regex: /quick\s*learner/i, category: 'vague' },

  // Vague achievement language
  { label: 'results driven', regex: /results?\s*[-]?\s*driven/i, category: 'vague' },
  { label: 'successfully', regex: /successfully/i, category: 'vague' },
  { label: 'helped improve', regex: /helped\s*(?:improve|with)/i, category: 'vague' },
  { label: 'worked on', regex: /worked\s*on/i, category: 'vague' },
  { label: 'responsible for', regex: /responsible\s*for/i, category: 'vague' },
  { label: 'contributed to', regex: /contributed\s*to/i, category: 'vague' },
  { label: 'assisted with', regex: /assisted\s*with/i, category: 'vague' },
  { label: 'involved in', regex: /involved\s*in/i, category: 'vague' }
];

// Simple lists to detect evidence
const evidenceIndicators = [
  /\b\d+%\b/, // explicit percentages like 45%
  /\b(\d+\s*(projects?|clients?|customers?|users?|developers?|engineers?|team|teams?|awards?|papers?))\b/i,
  /\b(\d+\s*(years?|months?|weeks?|days?))\b/i,
  /\b(reduced\s+.*\bby\s+\d+%|reduced\s+.*\d+%|improved\s+.*\bby\s+\d+%|increased\s+.*\bby\s+\d+%)\b/i,
  /\b(reduced|reduction|improved|increase|increased|decreased|decrease|led|managed|delivered|implemented|achieved|boosted)\b/i,
  /\b(from\s+\d+\s+to\s+\d+)\b/i,
  /\b(React|Node|Python|Java|SQL|AWS|GCP|Docker|Kubernetes)\b/i
];

const negationTokens = ['not','never','no','none','without','unable','cannot','can\'t','dont','don\'t','no longer','never'];

// Verification indicators: certifications, employment, education
const verificationIndicators = [
  /\b(certified|certification|certified\s+as|aws\s+certified|aws\s+certified\s+solutions?\s+architect)\b/i,
  /\b(worked\s+(at|for)|employed\s+(at|by)|at\s+[A-Z][a-zA-Z0-9&.\-]{2,})\b/, // simple employer pattern
  /\b(from\s+[A-Z][a-zA-Z.&\-\s]{2,})\b/, // education/employer with 'from'
  /\b(published\s+\d+|won\s+\d+\s+awards?)\b/i
];

function detectExtremeNumbers(sentence) {
  // find percentages and plain numbers
  const pct = sentence.match(/(\d+(?:\.\d+)?)%/g);
  if (pct) {
    for (const p of pct) {
      const n = parseFloat(p.replace('%',''));
      if (n >= 1000) return true;
    }
  }
  const nums = sentence.match(/\b(\d{1,3}(?:,\d{3})+|\d+)\b/g);
  if (nums) {
    for (const s of nums) {
      const n = parseInt(s.replace(/,/g,''),10);
      if (n >= 1000) return true;
    }
  }
  return false;
}

function sentenceSplit(text) {
  // crude sentence splitter
  return text
    .replace(/\r\n|\r/g, '\\n')
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean);
}

function containsEvidence(sentence) {
  return evidenceIndicators.some(rx => rx.test(sentence));
}

function hasNegationNear(sentence, matchIndex) {
  // check up to 6 words before matchIndex for negation tokens
  const before = sentence.slice(0, matchIndex);
  const words = before.split(/\s+/).filter(Boolean);
  const window = words.slice(-6).join(' ').toLowerCase();
  return negationTokens.some(nt => window.includes(nt));
}

function analyzeResume(text) {
  const issues = [];
  const suggestions = [];
  const claims = []; // per-claim details

  const sentences = sentenceSplit(text);

  // track counts
  let vagueCount = 0;
  let evidenceCount = 0;
  const seenPhrases = new Map();

  // counters for new categories
  let potentialExaggeratedCount = 0;
  let verificationCount = 0;

  sentences.forEach(sentence => {
    const lowered = sentence.toLowerCase();
    const sentenceHasEvidence = containsEvidence(sentence);
    const sentenceIsVerification = verificationIndicators.some(rx => rx.test(sentence));
    const sentenceIsExtreme = detectExtremeNumbers(sentence);
    let matchedAny = false;

    patternDefinitions.forEach(def => {
      const m = def.regex.exec(sentence);
      if (!m) return;

      const matchIndex = m.index;

      // negation handling
      if (hasNegationNear(sentence, matchIndex)) {
        // skip matches that are negated
        return;
      }

      matchedAny = true;
      const phrase = def.label;

      // Determine category with ordered checks
      let category = 'VAGUE_CLAIM';
      let severity = 'LOW';
      let hasEvidence = sentenceHasEvidence;

      if (sentenceIsVerification && sentenceIsVerification !== '') {
        category = 'REQUIRES_VERIFICATION';
        severity = 'MEDIUM';
        hasEvidence = sentenceHasEvidence;
      } else if (sentenceIsExtreme) {
        category = 'POTENTIALLY_EXAGGERATED';
        severity = 'MEDIUM';
        hasEvidence = true;
      } else if (sentenceHasEvidence) {
        category = 'EVIDENCE_SUPPORTED';
        severity = 'NONE';
      }

      // push claim object
      const key = `${sentence}||${phrase}`;
      if (!seenPhrases.has(key)) {
        seenPhrases.set(key, true);

        claims.push({
          text: sentence,
          phrase: phrase,
          category: category,
          severity: severity,
          hasEvidence: hasEvidence,
          suggestion: category === 'VAGUE_CLAIM' ? 'Add a measurable result or specific example.' : null
        });

        if (category === 'VAGUE_CLAIM') vagueCount += 1;
        else if (category === 'EVIDENCE_SUPPORTED') evidenceCount += 1;
        else if (category === 'POTENTIALLY_EXAGGERATED') potentialExaggeratedCount += 1;
        else if (category === 'REQUIRES_VERIFICATION') verificationCount += 1;

        // add suggestion when vague
        if (category === 'VAGUE_CLAIM') {
          suggestions.push(`Replace "${phrase}": Add a measurable result or specific example.`);
        }
      }
    });

    // If the sentence contains evidence but no vague phrase matched, record an evidence-only claim
    if (sentenceHasEvidence && !matchedAny) {
      const key = `${sentence}||__evidence_only__`;
      if (!seenPhrases.has(key)) {
        seenPhrases.set(key, true);
        // Check for extreme numbers or verification indicators
        if (detectExtremeNumbers(sentence)) {
          claims.push({
            text: sentence,
            phrase: 'evidence',
            category: 'POTENTIALLY_EXAGGERATED',
            severity: 'MEDIUM',
            hasEvidence: true,
            suggestion: 'This number is unusually large; consider providing context or verification.'
          });
          potentialExaggeratedCount += 1;
        } else if (verificationIndicators.some(rx => rx.test(sentence))) {
          claims.push({
            text: sentence,
            phrase: 'evidence',
            category: 'REQUIRES_VERIFICATION',
            severity: 'MEDIUM',
            hasEvidence: true,
            suggestion: 'This claim may require external verification.'
          });
          verificationCount += 1;
        } else {
          claims.push({
            text: sentence,
            phrase: 'evidence',
            category: 'EVIDENCE_SUPPORTED',
            severity: 'NONE',
            hasEvidence: true,
            suggestion: null
          });
          evidenceCount += 1;
        }
      }
    }
  });

  // Build consolidated issues (only for vague claims)
  const vaguePhrases = claims.filter(c => c.category === 'VAGUE_CLAIM').map(c => `"${c.phrase}"`);
  if (vaguePhrases.length > 0) {
    issues.push({
      type: 'Generic Content',
      desc: `${[...new Set(vaguePhrases)].join(', ')} lack measurable impact and weaken the resume.`
    });
  }

  // Scoring logic
  // Base score intentionally conservative: 60 means "needs evidence"
  let score = 60;

  // reward evidence-supported claims (reduced weight to avoid numbers-only false positives)
  score += Math.min(36, evidenceCount * 12); // each evidence adds +12 up to +36

  // penalize vague unsupported claims (slightly reduced penalty)
  score -= Math.min(60, vagueCount * 10); // each vague subtracts 10 up to -60

  // penalize potentially exaggerated claims (moderate penalty)
  if (typeof potentialExaggeratedCount !== 'undefined' && potentialExaggeratedCount > 0) {
    score -= Math.min(24, potentialExaggeratedCount * 8); // each extreme subtracts 8 up to -24
  }

  // small penalty for verification-required claims (small impact)
  if (typeof verificationCount !== 'undefined' && verificationCount > 0) {
    score -= Math.min(15, verificationCount * 3); // each verification subtracts 3 up to -15
  }

  // small bonus for mixed cases: if there is evidence and also vague, reduce penalty by a small amount
  if (evidenceCount > 0 && vagueCount > 0) {
    score += Math.min(8, Math.floor(evidenceCount * 1));
  }

  // clamp
  score = Math.max(0, Math.min(100, Math.round(score)));

  // rating
  let rating = 'Poor';
  if (score >= 85) rating = 'Excellent';
  else if (score >= 70) rating = 'Good';
  else if (score >= 50) rating = 'Needs Improvement';

  return {
    issues,
    suggestions: [...new Set(suggestions)],
    score,
    rating,
    claims
  };
}

module.exports = analyzeResume;
