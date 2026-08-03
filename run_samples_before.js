const fs = require('fs');
const analyze = require('./analyzer');

const path = 'C:\\Users\\admin\\.copilot\\workspaces\\07f5b9da-4708-4326-b920-05e3fb683864\\attachments\\pasted-text-75bb7bae-ee91-4cf0-a2fd-fea7197ca04e.txt';
const raw = fs.readFileSync(path, 'utf8');
const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

let total = lines.length;
let counts = { VAGUE_CLAIM:0, EVIDENCE_SUPPORTED:0, NONE:0, OTHER:0 };
let examples = { vague:[], evidence:[], none:[] };

for (const line of lines) {
  const res = analyze(line);
  const hasVague = res.claims.some(c=>c.category==='VAGUE_CLAIM');
  const hasEvidence = res.claims.some(c=>c.category==='EVIDENCE_SUPPORTED');
  if (hasVague) { counts.VAGUE_CLAIM++; if (examples.vague.length<10) examples.vague.push({text:line,claims:res.claims}); }
  else if (hasEvidence) { counts.EVIDENCE_SUPPORTED++; if (examples.evidence.length<10) examples.evidence.push({text:line,claims:res.claims}); }
  else { counts.NONE++; if (examples.none.length<10) examples.none.push({text:line}); }
}

console.log('Total lines:', total);
console.log('Counts:', counts);
console.log('\nExample vague lines (up to 10):'); examples.vague.forEach((e,i)=>{ console.log(i+1, e.text); });
console.log('\nExample evidence lines (up to 10):'); examples.evidence.forEach((e,i)=>{ console.log(i+1, e.text); });
console.log('\nExample none lines (up to 10):'); examples.none.forEach((e,i)=>{ console.log(i+1, e.text); });
