const analyze = require('./analyzer');

const tests = [
  { name: 'TEST 1', text: 'I am a hardworking and passionate professional.' },
  { name: 'TEST 2', text: 'I am a hardworking developer who reduced API response time by 45%.' },
  { name: 'TEST 3', text: 'I worked on several projects.' },
  { name: 'TEST 4', text: 'I worked on 10 projects and delivered them within 6 months.' },
  { name: 'TEST 5', text: "I am not a team player." },
  { name: 'TEST 6', text: 'Led a team of 8 developers and reduced deployment time by 30%.' },
  { name: 'TEST 7', text: 'Responsible for improving system performance by 25%.' },
  { name: 'TEST 8', text: 'Responsible for various tasks.' }
];

let failed = 0;
for (const t of tests) {
  console.log('-----', t.name, '-----');
  const res = analyze(t.text);
  console.log('Text:', t.text);
  console.log('Score:', res.score, 'Rating:', res.rating);
  console.log('Issues:', JSON.stringify(res.issues, null, 2));
  console.log('Suggestions:', JSON.stringify(res.suggestions, null, 2));
  console.log('Claims:', JSON.stringify(res.claims, null, 2));
  console.log('\n');
}
if (failed>0) process.exit(1);
