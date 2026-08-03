async function run() {
  const base = 'http://127.0.0.1:3000';

  const samples = [
    { name: 'normal', body: { content: 'Led a team of 5 and reduced latency by 30%.' } },
    { name: 'vague', body: { content: 'I am a hardworking and dedicated professional.' } },
    { name: 'strong', body: { content: 'Implemented caching using Redis; reduced response time from 200ms to 50ms.' } },
    { name: 'exaggerated', body: { content: 'Increased revenue by 10000%.' } },
    { name: 'verification', body: { content: 'Certified AWS Solutions Architect.' } },
    { name: 'empty', body: { content: '' } },
    { name: 'malformed', body: null }
  ];

  for (const s of samples) {
    try {
      const res = await fetch(base + '/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s.body) });
      const json = await res.json().catch(()=>null);
      console.log(s.name, res.status, JSON.stringify(json));
    } catch (e) {
      console.log('error', s.name, e.message);
    }
  }
}

run();
