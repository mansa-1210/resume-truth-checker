// escape text to prevent XSS
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function (c) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}

function setLoading(loading) {
  document.getElementById('loading').classList.toggle('hidden', !loading);
  if (loading) document.getElementById('results').classList.add('hidden');
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

function buildResultsHTML() {
  return `
    <div class="summary">
      <div class="score-block">
        <h3>Credibility Score</h3>
        <div id="gaugeWrap">
          <svg id="scoreGauge" width="120" height="120" viewBox="0 0 120 120">
            <defs>
              <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#F59E0B" />
                <stop offset="50%" stop-color="#10B981" />
                <stop offset="100%" stop-color="#2563EB" />
              </linearGradient>
            </defs>
            <circle cx="60" cy="60" r="48" stroke="#eef2ff" stroke-width="12" fill="none" />
            <circle id="gaugeArc" cx="60" cy="60" r="48" stroke="url(#g1)" stroke-width="12" fill="none" stroke-linecap="round" transform="rotate(-90 60 60)" stroke-dasharray="301.59" stroke-dashoffset="301.59" />
            <text id="scoreNumber" x="60" y="60" text-anchor="middle" dy="6" font-size="20" font-weight="700">--</text>
          </svg>
        </div>
        <div id="rating">--</div>
        <p class="disclaimer">Score indicates evidence quality, not truth. It does not determine whether a resume is truthful.</p>
      </div>
      <div class="stats-block">
        <h3>Summary</h3>
        <ul id="summaryList">
          <li>Total Claims: <span id="totalClaims">0</span></li>
          <li>Evidence Supported: <span id="evidenceCount">0</span></li>
          <li>Vague Claims: <span id="vagueCount">0</span></li>
          <li>Potentially Exaggerated: <span id="exagCount">0</span></li>
          <li>Requires Verification: <span id="verifyCount">0</span></li>
          <li>Consistency Issues: <span id="consistencyCount">0</span></li>
          <li>Skill Evidence Issues: <span id="skillCount">0</span></li>
        </ul>
      </div>
    </div>

    <div class="view-controls" style="margin-top:12px; display:flex; gap:12px; align-items:center;">
      <label><input type="radio" name="viewMode" value="original" checked /> Original Resume</label>
      <label><input type="radio" name="viewMode" value="highlighted" /> Highlighted Resume</label>
      <label><input type="radio" name="viewMode" value="suggestions" /> Improved Suggestions</label>
      <div style="margin-left:auto; display:flex; gap:8px;">
        <button id="copyAll">Copy All</button>
      </div>
    </div>

    <div id="resumeViews" style="margin-top:12px; display:flex; gap:12px; flex-direction:column;">
      <div id="originalResume" class="resume-view" style="display:block; white-space:pre-wrap;"></div>
      <div id="highlightedResume" class="resume-view" style="display:none; white-space:pre-wrap;"></div>
      <div id="improvedSuggestionsView" class="resume-view" style="display:none;"></div>
    </div>

    <div id="claimsList" style="margin-top:16px"></div>
  `;
}

function processAnalysis(data, sourceText) {
  document.getElementById('loading').classList.add('hidden');
  const merged = mergeClaims(data.claims || []);
  const claims = merged;
  window.__lastAnalysis = Object.assign({}, data, { claims: claims });

  // Build results HTML if it doesn't exist yet
  const resultsDiv = document.getElementById('results');
  if (resultsDiv.innerHTML.trim() === '') {
    resultsDiv.innerHTML = buildResultsHTML();
    // Re-attach event listeners for new elements
    attachResultsEventListeners();
  }

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

  // update score gauge and rating
  const scoreVal = (data.score!=null)? data.score : null;
  updateGauge(scoreVal);
  document.getElementById('rating').textContent = data.rating || '--';

  renderClaims(claims);

  // Build Improved Suggestions view (show all improvement cards together)
  const improved = document.getElementById('improvedSuggestionsView');
  improved.innerHTML = '';
  const header = document.createElement('h3'); header.textContent = 'Improved Suggestions'; improved.appendChild(header);
  // create card per claim that has suggestion(s)
  const anyCards = [];
  claims.forEach((c, i) => {
    if (c.suggestions && c.suggestions.length>0) {
      const card = document.createElement('div'); card.className = 'suggest-card';
      const cur = document.createElement('div'); cur.innerHTML = '<strong>Current statement:</strong> ' + escapeHtml(c.text);
      const prob = document.createElement('div'); prob.innerHTML = '<strong>Problem:</strong> ' + escapeHtml((c.phrases||[]).join(', ') + ' — ' + (c.categories||[]).join(', '));
      const rewrite = document.createElement('div'); rewrite.innerHTML = '<strong>Suggested rewrite:</strong> ' + escapeHtml((c.suggestions||[]).join(' / '));
      card.appendChild(cur); card.appendChild(prob); card.appendChild(rewrite);
      improved.appendChild(card);
      anyCards.push(card);
    }
  });
  // if analyzer also returned general suggestions, include them
  if (data.suggestions && data.suggestions.length>0) {
    data.suggestions.forEach(s => {
      const card = document.createElement('div'); card.className='suggest-card';
      card.innerHTML = '<div><strong>Suggestion:</strong> ' + escapeHtml(s) + '</div>';
      improved.appendChild(card);
      anyCards.push(card);
    });
  }
  if (anyCards.length===0) {
    const p = document.createElement('div'); p.textContent = 'No suggestions detected.'; improved.appendChild(p);
  }

  // render resume views
  document.getElementById('originalResume').textContent = data.extractedText || sourceText || '';
  buildHighlightedResume(data.extractedText || sourceText || '', claims);
  resultsDiv.classList.remove('hidden');
}

// update gauge arc
function updateGauge(score){
  const arc = document.getElementById('gaugeArc');
  const txt = document.getElementById('scoreNumber');
  if (!arc || score==null){ txt.textContent='--'; arc.style.strokeDashoffset = 301.59; return; }
  const max = 100; const pct = Math.max(0, Math.min(100, score));
  const circumference = 2 * Math.PI * 48; // r=48
  const offset = circumference - (circumference * (pct/100));
  arc.style.strokeDashoffset = offset;
  txt.textContent = pct + '%';
}

function analyzeResume() {
  // prefer uploaded extracted text if present, else fallback to textarea
  const text = (window.__uploadExtractedText && window.__uploadExtractedText.length>0) ? window.__uploadExtractedText : (document.getElementById('resumeText') ? document.getElementById('resumeText').value || '' : '');
  const errorBox = document.getElementById('error');
  errorBox.classList.add('hidden');
  if (!text.trim()) {
    errorBox.textContent = 'No resume text available to analyze. Please upload a resume.';
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
  // preserve paragraphs and line breaks
  const paragraphs = text.replace(/\r\n|\r/g,'\n').split(/\n{2,}/);
  const norm = s=> (s||'').replace(/\s+/g,' ').trim().toLowerCase();
  const claimMap = new Map();
  claims.forEach((c, i)=>{ claimMap.set(norm(c.text), { idx:i, claim:c }); });

  paragraphs.forEach((para, pidx) => {
    // within paragraph, split into sentences but keep punctuation
    const sentences = para.split(/(?<=[.!?])\s+/);
    const pdiv = document.createElement('div'); pdiv.className='resume-paragraph';
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
      span.textContent = s;
      pdiv.appendChild(span);
      // add space between sentences
      pdiv.appendChild(document.createTextNode(' '));
    });
    el.appendChild(pdiv);
    // add paragraph break
    el.appendChild(document.createElement('br'));
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

function attachResultsEventListeners() {
  // view mode toggles
  const radios = document.querySelectorAll('input[name=viewMode]');
  radios.forEach(r=> r.addEventListener('change', ()=>{
    const v = document.querySelector('input[name=viewMode]:checked').value;
    document.getElementById('originalResume').style.display = v==='original' ? 'block' : 'none';
    document.getElementById('highlightedResume').style.display = v==='highlighted' ? 'block' : 'none';
    document.getElementById('improvedSuggestionsView').style.display = v==='suggestions' ? 'block' : 'none';
  }));

  // copy button
  const copyBtn = document.getElementById('copyAll');
  if (copyBtn) copyBtn.addEventListener('click', ()=>{
    const data = window.__lastAnalysis || {};
    navigator.clipboard.writeText(JSON.stringify(data, null, 2)).then(()=> alert('Analysis copied to clipboard'));
  });
}

// wire buttons and upload handling
document.addEventListener('DOMContentLoaded', ()=>{
  // Clear all placeholder content from results section on page load
  const resultsDiv = document.getElementById('results');
  resultsDiv.innerHTML = '';
  resultsDiv.classList.add('hidden');
  
  const analyzeBtn = document.getElementById('analyzeBtn');
  const clearBtn = document.getElementById('clearBtn');
  const textarea = document.getElementById('resumeText');
  analyzeBtn.addEventListener('click', ()=>{
    // if uploaded extracted text exists, use it to populate textarea (ensures analyze always uses current text)
    if (window.__uploadExtractedText && window.__uploadExtractedText.length > 0) {
      textarea.value = window.__uploadExtractedText;
    }
    analyzeResume();
  });
  if (clearBtn) {
    clearBtn.addEventListener('click', ()=>{ 
      textarea.value=''; 
      const resultsDiv = document.getElementById('results');
      resultsDiv.innerHTML = '';
      resultsDiv.classList.add('hidden'); 
      document.getElementById('error').classList.add('hidden'); 
      analyzeBtn.disabled = true; 
      window.__uploadExtractedText=''; 
      window.__lastAnalysis = null; 
      document.getElementById('uploadInfo').innerHTML=''; 
    });
  }

  // enable analyze when textarea has content
  textarea.addEventListener('input', ()=>{ const v = textarea.value || ''; document.getElementById('charCount').textContent = v.length; analyzeBtn.disabled = v.trim().length === 0; });

  // upload handler
  const fileInput = document.getElementById('fileInput');
  const dropzone = document.getElementById('dropzone');
  const browseBtn = document.getElementById('browseBtn');
  browseBtn.addEventListener('click',(e)=>{ e.preventDefault(); fileInput.click(); });
  const uploadBtn = document.getElementById('uploadBtn'); if (uploadBtn) uploadBtn.addEventListener('click', (e)=>{ e.preventDefault(); fileInput.click(); });

  function handleFileSelection(f){
    const info = document.getElementById('uploadInfo');
    info.innerHTML = '';
    if (!f) return;
    if (f.size > 5*1024*1024) { info.innerHTML = '<div class="notify-error">File too large (max 5MB)</div>'; return; }

    info.innerHTML = `<div class="upload-card">\n      <div class="icon">☁️</div>\n      <div class="meta">\n        <div style="font-weight:700">${escapeHtml(f.name)}</div>\n        <div style="font-size:13px;color:var(--muted)">${Math.round(f.size/1024)} KB</div>\n        <div class="upload-status notify-info">Preparing upload…</div>\n      </div>\n    </div>`;

    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append('resumeFile', f);
    xhr.open('POST','/upload');
    xhr.upload.onprogress = function(ev){ if (ev.lengthComputable) { const pct = Math.round(ev.loaded/ev.total*100); const s = info.querySelector('.upload-status'); if (s) s.textContent = `Uploading: ${pct}%`; } };
    xhr.onload = function(){
      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText);
        document.getElementById('resumeText').value = data.extractedText || '';
        document.getElementById('analyzeBtn').disabled = false;
        // store extracted text for later analyze and for export
        window.__uploadExtractedText = data.extractedText || '';
        window.__lastAnalysis = Object.assign({}, data, { claims: data.claims || [] });
        info.innerHTML = `<div class="upload-card success">\n          <div class="icon">✓</div>\n          <div class="meta">\n            <div style="font-weight:700">${escapeHtml(f.name)}</div>\n            <div style="font-size:13px; color:var(--muted)">${Math.round(f.size/1024)} KB</div>\n            <div class="upload-status notify-success">Extraction successful — ready for analysis</div>\n          </div>\n        </div>`;
        // DO NOT auto-run analyze - wait for user to click Analyze button

      } else {
        try { const e = JSON.parse(xhr.responseText); info.innerHTML = `<div class="notify-error">Upload failed: ${escapeHtml(e.error||xhr.statusText)}</div>`; }
        catch(e){ info.innerHTML = '<div class="notify-error">Upload failed</div>'; }
      }
    };
    xhr.onerror = function(){ info.innerHTML = '<div class="notify-error">Upload error</div>'; };
    xhr.send(form);
  }

  fileInput.addEventListener('change', (e)=>{ handleFileSelection(e.target.files[0]); });

  dropzone.addEventListener('dragover', (e)=>{ e.preventDefault(); dropzone.classList.add('dragover'); });
  dropzone.addEventListener('dragleave', (e)=>{ e.preventDefault(); dropzone.classList.remove('dragover'); });
  dropzone.addEventListener('drop', (e)=>{ e.preventDefault(); dropzone.classList.remove('dragover'); const f = e.dataTransfer.files && e.dataTransfer.files[0]; handleFileSelection(f); });
});
