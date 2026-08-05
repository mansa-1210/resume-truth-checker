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

// Merge claims by normalized sentence text; aggregate phrases/reasons into one claim card
function mergeClaims(claims) {
  if (!claims || claims.length === 0) return [];
  const map = new Map();
  function norm(s){ return (s||'').replace(/\s+/g,' ').trim().toLowerCase(); }
  for (const c of claims) {
    const key = norm(c.text || '');
    if (!map.has(key)) {
      map.set(key, {
        text: c.text,
        phrases: new Set([c.phrase || '']),
        categories: new Set([c.category || '']),
        severities: new Set([c.severity || 'NONE']),
        hasEvidence: !!c.hasEvidence,
        suggestions: new Set(c.suggestion ? [c.suggestion] : []),
        reasons: [ { phrase: c.phrase || '', category: c.category || '', severity: c.severity || 'NONE' } ],
        confidence: c.confidence || null
      });
    } else {
      const entry = map.get(key);
      entry.phrases.add(c.phrase || '');
      entry.categories.add(c.category || '');
      entry.severities.add(c.severity || 'NONE');
      entry.hasEvidence = entry.hasEvidence || !!c.hasEvidence;
      if (c.suggestion) entry.suggestions.add(c.suggestion);
      entry.reasons.push({ phrase: c.phrase || '', category: c.category || '', severity: c.severity || 'NONE' });
      if (c.confidence) entry.confidence = c.confidence;
    }
  }
  // convert sets to arrays and compute aggregated severity (MEDIUM>LOW>NONE)
  const out = [];
  for (const [k, v] of map.entries()) {
    let severity = 'NONE';
    if (v.severities.has('MEDIUM')) severity = 'MEDIUM';
    else if (v.severities.has('LOW')) severity = 'LOW';
    out.push({
      text: v.text,
      phrases: Array.from(v.phrases),
      categories: Array.from(v.categories),
      severity,
      hasEvidence: v.hasEvidence,
      suggestions: Array.from(v.suggestions),
      reasons: v.reasons,
      confidence: v.confidence
    });
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

  claims.forEach((c, idx) => {
    const div = document.createElement('div');
    div.className = 'claim';
    div.dataset.claimId = idx;

    const meta = document.createElement('div'); meta.className = 'meta';

    const badge = document.createElement('span'); badge.className = 'badge';
    // choose primary category for badge display
    const primary = c.categories && c.categories[0] ? c.categories[0] : (c.categories || c.category || '');
    if (c.categories && c.categories.includes('EVIDENCE_SUPPORTED')) { badge.classList.add('evidence'); badge.textContent = 'Evidence Supported'; }
    else if (c.categories && c.categories.includes('VAGUE_CLAIM')) { badge.classList.add('vague'); badge.textContent = 'Vague Claim'; }
    else if (c.categories && c.categories.includes('POTENTIALLY_EXAGGERATED')) { badge.classList.add('exag'); badge.textContent = 'Potentially Exaggerated'; }
    else if (c.categories && c.categories.includes('REQUIRES_VERIFICATION')) { badge.classList.add('verify'); badge.textContent = 'Requires Verification'; }
    else { badge.textContent = primary || 'Claim'; }

    const sev = document.createElement('div'); sev.textContent = 'Severity: ' + (c.severity || 'NONE');
    const ev = document.createElement('div'); ev.textContent = 'Has evidence: ' + (c.hasEvidence ? 'Yes' : 'No');

    meta.appendChild(badge);
    meta.appendChild(sev);
    meta.appendChild(ev);

    const txt = document.createElement('div'); txt.className = 'text';
    const reasonsHtml = (c.reasons || []).map(r => '<li>' + escapeHtml((r.phrase||'') + ' — ' + (r.category||'')) + '</li>').join('');
    const suggHtml = (c.suggestions && c.suggestions.length>0) ? ('<div class="suggestion"><strong>Suggested:</strong> ' + escapeHtml(c.suggestions.join('; ')) + '</div>') : '';

    txt.innerHTML = '<div>'+escapeHtml(c.text)+'</div>'
      + '<div><strong>Reasons:</strong><ul style="margin:6px 0 0 16px;">' + reasonsHtml + '</ul></div>'
      + suggHtml
      + (c.confidence?('<div>Confidence: '+escapeHtml(String(c.confidence))+'</div>'): '');

    div.appendChild(meta);
    div.appendChild(txt);
    div.addEventListener('click', ()=>{ scrollToClaim(idx); });
    container.appendChild(div);
  });
}

function processAnalysis(data, sourceText) {
  document.getElementById('loading').classList.add('hidden');
  const merged = mergeClaims(data.claims || []);
  const claims = merged;
  window.__lastAnalysis = Object.assign({}, data, { claims: claims });

  const total = claims.length;
  const evidenceCount = claims.filter(c=>c.categories&&c.categories.includes('EVIDENCE_SUPPORTED')).length;
  const vagueCount = claims.filter(c=>c.categories&&c.categories.includes('VAGUE_CLAIM')).length;
  const exagCount = claims.filter(c=>c.categories&&c.categories.includes('POTENTIALLY_EXAGGERATED')).length;
  const verifyCount = claims.filter(c=>c.categories&&c.categories.includes('REQUIRES_VERIFICATION')).length;

  document.getElementById('totalClaims').textContent = total;
  document.getElementById('evidenceCount').textContent = evidenceCount;
  document.getElementById('vagueCount').textContent = vagueCount;
  document.getElementById('exagCount').textContent = exagCount;
  document.getElementById('verifyCount').textContent = verifyCount;

  document.getElementById('scoreNumber').textContent = (data.score!=null)?data.score + '/100':'--';
  document.getElementById('rating').textContent = data.rating || '--';

  renderClaims(claims);

  const sug = document.getElementById('suggestions');
  sug.innerHTML = '';
  if (data.suggestions && data.suggestions.length>0) {
    const h = document.createElement('h3'); h.textContent = 'Suggestions'; sug.appendChild(h);
    data.suggestions.forEach(s=>{
      const card = document.createElement('div'); card.className='suggest-card';
      card.innerHTML = '<div>'+escapeHtml(s)+'</div>';
      sug.appendChild(card);
    });
  }

  // render resume views
  document.getElementById('originalResume').textContent = data.extractedText || sourceText || '';
  buildHighlightedResume(data.extractedText || sourceText || '', claims);
  document.getElementById('results').classList.remove('hidden');
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
    if (!res.ok) {
      document.getElementById('loading').classList.add('hidden');
      const err = await res.json().catch(()=>({error:'Server error'}));
      errorBox.textContent = err.error || 'Server error';
      errorBox.classList.remove('hidden');
      return;
    }
    const data = await res.json();
    processAnalysis(data, text);
  }).catch(err => {
    document.getElementById('loading').classList.add('hidden');
    errorBox.textContent = 'Network or server error.';
    errorBox.classList.remove('hidden');
  });
}

// build highlighted resume view from raw text and merged claims
function buildHighlightedResume(text, claims) {
  const el = document.getElementById('highlightedResume');
  el.innerHTML = '';
  if (!text) return;
  // split into sentences (simple splitter)
  const sentences = text.replace(/\r\n|\r/g,'\n').split(/(?<=[.!?])\s+/);
  const norm = s=> (s||'').replace(/\s+/g,' ').trim().toLowerCase();
  const claimMap = new Map();
  claims.forEach((c, i)=>{ claimMap.set(norm(c.text), { idx:i, claim:c }); });

  sentences.forEach((s, i) => {
    const n = norm(s);
    const span = document.createElement('span');
    span.className = 'resume-sentence';
    if (claimMap.has(n)) {
      const info = claimMap.get(n);
      span.classList.add('claim-match');
      span.dataset.claimId = info.idx;
      // choose class by category
      if (info.claim.categories.includes('EVIDENCE_SUPPORTED')) span.classList.add('match-evidence');
      else if (info.claim.categories.includes('VAGUE_CLAIM')) span.classList.add('match-vague');
      else if (info.claim.categories.includes('POTENTIALLY_EXAGGERATED')) span.classList.add('match-exag');
      else if (info.claim.categories.includes('REQUIRES_VERIFICATION')) span.classList.add('match-verify');
    }
    span.textContent = s + ' ';
    el.appendChild(span);
  });
}

function scrollToClaim(idx) {
  // switch to highlighted view and scroll to claim
  document.querySelector('input[name=viewMode][value=highlighted]').checked = true;
  document.getElementById('originalResume').style.display = 'none';
  document.getElementById('highlightedResume').style.display = 'block';
  document.getElementById('improvedSuggestionsView').style.display = 'none';

  const el = document.querySelector('#highlightedResume .resume-sentence[data-claim-id="'+idx+'"]');
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('pulse');
    setTimeout(()=> el.classList.remove('pulse'), 2200);
  }
}

// wire buttons and upload handling
document.addEventListener('DOMContentLoaded', ()=>{
  document.getElementById('analyzeBtn').addEventListener('click', analyzeResume);
  document.getElementById('clearBtn').addEventListener('click', ()=>{ document.getElementById('resumeText').value=''; document.getElementById('results').classList.add('hidden'); document.getElementById('error').classList.add('hidden'); document.getElementById('originalResume').textContent=''; document.getElementById('highlightedResume').innerHTML=''; });

  // upload handler
  const fileInput = document.getElementById('fileInput');
  fileInput.addEventListener('change', (e)=>{
    const f = e.target.files[0];
    const info = document.getElementById('uploadInfo');
    info.textContent = '';
    if (!f) return;
    if (f.size > 10*1024*1024) { info.textContent = 'File too large (max 10MB)'; return; }
    info.textContent = `Selected: ${f.name} (${Math.round(f.size/1024)} KB)`;

    // upload via XHR to track progress
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append('resumeFile', f);
    xhr.open('POST','/upload');
    xhr.upload.onprogress = function(ev){ if (ev.lengthComputable) { info.textContent = `Uploading ${f.name}: ${Math.round(ev.loaded/ev.total*100)}%`; } };
    xhr.onload = function(){
      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText);
        document.getElementById('resumeText').value = data.extractedText || '';
        info.textContent = `Uploaded: ${f.name} — extracted ${data.extractedLength} chars`;
        // process analysis returned by the upload endpoint (do not persist uploaded text)
        processAnalysis(data, data.extractedText || '');
      } else {
        try { const e = JSON.parse(xhr.responseText); info.textContent = 'Upload failed: '+(e.error||xhr.statusText); }
        catch(e){ info.textContent = 'Upload failed'; }
      }
    };
    xhr.onerror = function(){ info.textContent = 'Upload error'; };
    xhr.send(form);
  });

  // view mode toggles
  const radios = document.querySelectorAll('input[name=viewMode]');
  radios.forEach(r=> r.addEventListener('change', ()=>{
    const v = document.querySelector('input[name=viewMode]:checked').value;
    document.getElementById('originalResume').style.display = v==='original' ? 'block' : 'none';
    document.getElementById('highlightedResume').style.display = v==='highlighted' ? 'block' : 'none';
    document.getElementById('improvedSuggestionsView').style.display = v==='suggestions' ? 'block' : 'none';
  }));

  // exports
  document.getElementById('downloadJson').addEventListener('click', ()=>{
    const data = window.__lastAnalysis || {};
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'analysis.json'; a.click(); URL.revokeObjectURL(url);
  });
  document.getElementById('copyAll').addEventListener('click', ()=>{
    const data = window.__lastAnalysis || {};
    navigator.clipboard.writeText(JSON.stringify(data, null, 2)).then(()=> alert('Analysis copied to clipboard')); 
  });
  document.getElementById('printReport').addEventListener('click', ()=>{ window.print(); });
});
