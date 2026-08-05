// escape text to prevent XSS
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function (c) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}

function setLoading(loading) {
  document.getElementById('loading').classList.toggle('hidden', !loading);
  document.getElementById('results').classList.toggle('hidden', loading);
}

// Remove duplicate claims while preserving order. Normalize by lowercased trimmed text + phrase.
function dedupeClaims(claims) {
  if (!claims || claims.length === 0) return [];
  const seen = new Set();
  const out = [];
  for (const c of claims) {
    const key = ((c.text || '') + '||' + (c.phrase || '')).replace(/\s+/g, ' ').trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

function renderClaims(claims) {
  const container = document.getElementById('claimsList');
  container.innerHTML = '';
  if (!claims || claims.length === 0) {
    container.innerHTML = '<p>No claims detected.</p>';
    return;
  }
  claims.forEach(c => {
    const div = document.createElement('div');
    div.className = 'claim';
    const meta = document.createElement('div'); meta.className = 'meta';

    const badge = document.createElement('span'); badge.className = 'badge';
    if (c.category === 'EVIDENCE_SUPPORTED') { badge.classList.add('evidence'); badge.textContent = 'Evidence Supported'; }
    else if (c.category === 'VAGUE_CLAIM') { badge.classList.add('vague'); badge.textContent = 'Vague Claim'; }
    else if (c.category === 'POTENTIALLY_EXAGGERATED') { badge.classList.add('exag'); badge.textContent = 'Potentially Exaggerated'; }
    else if (c.category === 'REQUIRES_VERIFICATION') { badge.classList.add('verify'); badge.textContent = 'Requires Verification'; }
    else { badge.textContent = c.category; }

    const sev = document.createElement('div'); sev.textContent = 'Severity: ' + (c.severity || 'NONE');
    const ev = document.createElement('div'); ev.textContent = 'Has evidence: ' + (c.hasEvidence ? 'Yes' : 'No');

    meta.appendChild(badge);
    meta.appendChild(sev);
    meta.appendChild(ev);

    const txt = document.createElement('div'); txt.className = 'text';
    txt.innerHTML = '<div>'+escapeHtml(c.text)+'</div>' + (c.suggestion? '<div><em>Suggestion: '+escapeHtml(c.suggestion)+'</em></div>':'' ) + (c.confidence?('<div>Confidence: '+escapeHtml(String(c.confidence))+'</div>'): '');

    div.appendChild(meta);
    div.appendChild(txt);
    container.appendChild(div);
  });
}

function analyzeResume() {
  const text = document.getElementById('resumeText').value || '';
  const errorBox = document.getElementById('error');
  errorBox.classList.add('hidden');
  if (!text.trim()) {
    errorBox.textContent = 'Please paste resume text before analyzing.';
    errorBox.classList.remove('hidden');
    return;
  }
  if (text.length > 20000) {
    errorBox.textContent = 'Resume is too large (over 20,000 characters). Please shorten it.';
    errorBox.classList.remove('hidden');
    return;
  }

  // UI states
  document.getElementById('results').classList.add('hidden');
  document.getElementById('loading').classList.remove('hidden');

  fetch('/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: text })
  }).then(async res => {
    document.getElementById('loading').classList.add('hidden');
    if (!res.ok) {
      const err = await res.json().catch(()=>({error:'Server error'}));
      errorBox.textContent = err.error || 'Server error';
      errorBox.classList.remove('hidden');
      return;
    }
    const data = await res.json();

    // populate summary (deduplicate identical claims for clearer UI)
    const claims = dedupeClaims(data.claims || []);
    const total = claims.length;
    const evidenceCount = claims.filter(c=>c.category==='EVIDENCE_SUPPORTED').length;
    const vagueCount = claims.filter(c=>c.category==='VAGUE_CLAIM').length;
    const exagCount = claims.filter(c=>c.category==='POTENTIALLY_EXAGGERATED').length;
    const verifyCount = claims.filter(c=>c.category==='REQUIRES_VERIFICATION').length;

    document.getElementById('totalClaims').textContent = total;
    document.getElementById('evidenceCount').textContent = evidenceCount;
    document.getElementById('vagueCount').textContent = vagueCount;
    document.getElementById('exagCount').textContent = exagCount;
    document.getElementById('verifyCount').textContent = verifyCount;

    document.getElementById('scoreNumber').textContent = (data.score!=null)?data.score + '/100':'--';
    document.getElementById('rating').textContent = data.rating || '--';

    // render claims and suggestions
    renderClaims(claims);
    const sug = document.getElementById('suggestions');
    sug.innerHTML = '';
    if (data.suggestions && data.suggestions.length>0) {
      const h = document.createElement('h3'); h.textContent = 'Suggestions'; sug.appendChild(h);
      const ul = document.createElement('ul');
      data.suggestions.forEach(s=>{ const li = document.createElement('li'); li.textContent = s; ul.appendChild(li); });
      sug.appendChild(ul);
    }

    document.getElementById('results').classList.remove('hidden');
  }).catch(err => {
    document.getElementById('loading').classList.add('hidden');
    errorBox.textContent = 'Network or server error.';
    errorBox.classList.remove('hidden');
  });
}

// wire buttons
document.addEventListener('DOMContentLoaded', ()=>{
  document.getElementById('analyzeBtn').addEventListener('click', analyzeResume);
  document.getElementById('clearBtn').addEventListener('click', ()=>{ document.getElementById('resumeText').value=''; document.getElementById('results').classList.add('hidden'); document.getElementById('error').classList.add('hidden'); });
});
