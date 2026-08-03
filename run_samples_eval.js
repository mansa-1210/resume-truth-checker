const fs = require('fs');
const analyze = require('./analyzer');

const path = 'C:\\Users\\admin\\.copilot\\workspaces\\07f5b9da-4708-4326-b920-05e3fb683864\\attachments\\pasted-text-75bb7bae-ee91-4cf0-a2fd-fea7197ca04e.txt';
const raw = fs.readFileSync(path, 'utf8');
const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

let total = lines.length;
const catCounts = { VAGUE_CLAIM:0, EVIDENCE_SUPPORTED:0, POTENTIALLY_EXAGGERATED:0, REQUIRES_VERIFICATION:0, NONE:0 };
const examples = { VAGUE_CLAIM:[], EVIDENCE_SUPPORTED:[], POTENTIALLY_EXAGGERATED:[], REQUIRES_VERIFICATION:[], NONE:[] };

for (const line of lines) {
  const res = analyze(line);
  if (!res.claims || res.claims.length===0) {
    catCounts.NONE += 1;
    if (examples.NONE.length<5) examples.NONE.push(line);
    continue;
  }

  // For each claim in the line, count its category (use highest-severity if multiple)
  let categories = new Set(res.claims.map(c=>c.category));
  if (categories.has('POTENTIALLY_EXAGGERATED')) {
    catCounts.POTENTIALLY_EXAGGERATED += 1; if (examples.POTENTIALLY_EXAGGERATED.length<5) examples.POTENTIALLY_EXAGGERATED.push({text:line,claims:res.claims});
  } else if (categories.has('REQUIRES_VERIFICATION')) {
    catCounts.REQUIRES_VERIFICATION += 1; if (examples.REQUIRES_VERIFICATION.length<5) examples.REQUIRES_VERIFICATION.push({text:line,claims:res.claims});
  } else if (categories.has('EVIDENCE_SUPPORTED')) {
    catCounts.EVIDENCE_SUPPORTED += 1; if (examples.EVIDENCE_SUPPORTED.length<5) examples.EVIDENCE_SUPPORTED.push({text:line,claims:res.claims});
  } else if (categories.has('VAGUE_CLAIM')) {
    catCounts.VAGUE_CLAIM += 1; if (examples.VAGUE_CLAIM.length<5) examples.VAGUE_CLAIM.push({text:line,claims:res.claims});
  } else {
    catCounts.NONE +=1; if (examples.NONE.length<5) examples.NONE.push(line);
  }
}

console.log('Total lines:', total);
console.log('Category counts:', catCounts);
console.log('\nExamples per category:');
for (const k of Object.keys(examples)){
  console.log('\n==',k,'==');
  examples[k].forEach((e,i)=>{
    if (typeof e === 'string') console.log(i+1,e);
    else console.log(i+1,e.text, JSON.stringify(e.claims));
  });
}
