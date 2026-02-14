// ============ DISSERTATION MODULE ============
let dissInterval = null, dissStartTime = null, dissElapsed = 0;
const DISS_CHAPTERS = {ch1:'Chapter 1: Migration', ch2:'Chapter 2: Data Economy (Closed)', ch3:'Chapter 3: Data Economy (Open)'};
const dissFileHandles = {}; // in-memory file handles per chapter

function renderDiss() { initDissChapters(); renderChapters(); renderDissLog(); updateDissChapterSelect(); }

// ============ MARKDOWN PARSER ============
function dissParseMd(src) {
  if (!src) return '<p style="color:var(--muted);font-style:italic">Empty — double-click to edit, or ⌘⇧V for full editor</p>';
  let html = '', inCode = false, codeBuf = '';
  const lines = src.split('\n');
  const escape = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const inline = s => {
    s = s.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
    s = s.replace(/\*(.+?)\*/g,'<em>$1</em>');
    s = s.replace(/`([^`]+)`/g,'<code>$1</code>');
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank">$1</a>');
    return s;
  };
  let buf = [], listStack = [];
  const flushBuf = () => { if(buf.length){html+='<p>'+inline(buf.join(' '))+'</p>';buf=[];} };
  const flushList = () => { while(listStack.length){html+='</'+listStack.pop()+'>';} };
  for(let i=0;i<lines.length;i++){
    const l = lines[i];
    if(inCode){ if(l.trim().startsWith('```')){html+='<pre><code>'+escape(codeBuf)+'</code></pre>';inCode=false;codeBuf='';} else{codeBuf+=l+'\n';} continue; }
    if(l.trim().startsWith('```')){flushBuf();flushList();inCode=true;codeBuf='';continue;}
    if(l.trim()===''){flushBuf();flushList();continue;}
    const hm = l.match(/^(#{1,6})\s+(.+)$/);
    if(hm){flushBuf();flushList();const lv=hm[1].length;html+='<h'+lv+'>'+inline(hm[2])+'</h'+lv+'>';continue;}
    if(l.trim()==='---'||l.trim()==='***'){flushBuf();flushList();html+='<hr>';continue;}
    const bq = l.match(/^>\s?(.*)$/);
    if(bq){flushBuf();flushList();html+='<blockquote>'+inline(bq[1])+'</blockquote>';continue;}
    const ul = l.match(/^[\s]*[-*]\s+(.+)$/);
    if(ul){flushBuf();if(!listStack.length||listStack[listStack.length-1]!=='ul'){flushList();html+='<ul>';listStack.push('ul');}html+='<li>'+inline(ul[1])+'</li>';continue;}
    const ol = l.match(/^[\s]*\d+\.\s+(.+)$/);
    if(ol){flushBuf();if(!listStack.length||listStack[listStack.length-1]!=='ol'){flushList();html+='<ol>';listStack.push('ol');}html+='<li>'+inline(ol[1])+'</li>';continue;}
    flushList(); buf.push(l);
  }
  flushBuf(); flushList();
  if(inCode) html+='<pre><code>'+escape(codeBuf)+'</code></pre>';
  return html;
}

// ============ SECTION-AWARE RENDERING ============
function dissRenderWithSections(src) {
  if(!src) return dissParseMd(src);
  const lines = src.split('\n');
  let sections = [], cur = {heading:null, headingLevel:0, lines:[], headingLine:null};
  for(const l of lines){
    const hm = l.match(/^(#{1,6})\s+(.+)$/);
    if(hm){
      if(cur.heading!==null||cur.lines.length) sections.push(cur);
      cur = {heading:hm[2], headingLevel:hm[1].length, lines:[], headingLine:l};
    } else { cur.lines.push(l); }
  }
  if(cur.heading!==null||cur.lines.length) sections.push(cur);
  let html = '';
  sections.forEach((sec,i) => {
    html += '<div class="diss-section" data-sec-idx="'+i+'">';
    if(sec.heading){
      html += '<div class="diss-section-heading"><span class="sec-arrow">▶</span>';
      html += '<h'+sec.headingLevel+' style="display:inline;cursor:pointer">'+sec.heading+'</h'+sec.headingLevel+'></div>';
    }
    html += '<div class="diss-section-content">'+dissParseMd(sec.lines.join('\n'))+'</div>';
    html += '</div>';
  });
  return html;
}

// Rebuild source from sections after inline edit
function dissRebuildSource(chKey) {
  const d = getGlobal();
  const src = (d.dissChapterContent && d.dissChapterContent[chKey]) || '';
  return src;
}

// ============ CHAPTER DATA ============
function initDissChapters() {
  const d = getGlobal();
  if(!d.dissChapterContent) { d.dissChapterContent = {ch1:'',ch2:'',ch3:''}; save(d); }
  ['ch1','ch2','ch3'].forEach(ch => {
    const ta = document.getElementById('diss-edit-'+ch);
    const rd = document.getElementById('diss-render-'+ch);
    if(!ta||!rd) return;
    ta.value = d.dissChapterContent[ch] || '';
    rd.innerHTML = dissRenderWithSections(d.dissChapterContent[ch]||'');
    // Default: rendered visible, edit hidden
    ta.classList.remove('active');
    rd.style.display = 'block';
    // Attach section collapse + dblclick handlers
    attachSectionHandlers(ch);
  });
  // Global keydown for Cmd+Shift+V
  if(!window._dissKeyBound){
    window._dissKeyBound = true;
    document.addEventListener('keydown', e => {
      if((e.metaKey||e.ctrlKey) && e.shiftKey && e.key === 'v') {
        const active = document.activeElement;
        // Find which chapter is active
        let ch = null;
        ['ch1','ch2','ch3'].forEach(c => {
          const body = document.getElementById('diss-body-'+c);
          if(body && body.contains(active)) ch = c;
        });
        // If no chapter focused, check if any chapter body is open
        if(!ch) ['ch1','ch2','ch3'].forEach(c => {
          const body = document.getElementById('diss-body-'+c);
          if(body && body.classList.contains('open')) ch = ch || c;
        });
        if(ch){ e.preventDefault(); toggleDissFullEdit(ch); }
      }
    });
  }
  // Restore file handles from IndexedDB
  restoreFileHandles();
}

function dissAutoSave(ch) {
  const ta = document.getElementById('diss-edit-'+ch);
  const d = getGlobal();
  if(!d.dissChapterContent) d.dissChapterContent = {};
  d.dissChapterContent[ch] = ta.value;
  save(d);
}

function toggleDissChapter(ch) {
  const body = document.getElementById('diss-body-'+ch);
  const arrow = document.getElementById('diss-arrow-'+ch);
  body.classList.toggle('open');
  arrow.classList.toggle('open');
}

function toggleDissFullEdit(ch) {
  const ta = document.getElementById('diss-edit-'+ch);
  const rd = document.getElementById('diss-render-'+ch);
  if(ta.classList.contains('active')) {
    // Save and switch to rendered
    dissAutoSave(ch);
    ta.classList.remove('active');
    rd.style.display = 'block';
    const d = getGlobal();
    rd.innerHTML = dissRenderWithSections(d.dissChapterContent[ch]||'');
    attachSectionHandlers(ch);
  } else {
    // Switch to edit
    const d = getGlobal();
    ta.value = d.dissChapterContent[ch] || '';
    ta.classList.add('active');
    rd.style.display = 'none';
    ta.focus();
  }
}

// ============ SECTION HANDLERS ============
function attachSectionHandlers(ch) {
  const rd = document.getElementById('diss-render-'+ch);
  if(!rd) return;
  // Heading collapse toggle
  rd.querySelectorAll('.diss-section-heading').forEach(hd => {
    hd.onclick = (e) => {
      if(e.target.closest('.diss-section-inline-edit')) return;
      const sec = hd.closest('.diss-section');
      sec.classList.toggle('diss-section-collapsed');
    };
  });
  // Double-click on section content for inline edit
  rd.querySelectorAll('.diss-section-content').forEach(sc => {
    sc.ondblclick = (e) => {
      if(e.target.tagName==='TEXTAREA') return;
      const sec = sc.closest('.diss-section');
      const idx = parseInt(sec.dataset.secIdx);
      openInlineEdit(ch, idx, sc);
    };
  });
}

function openInlineEdit(ch, secIdx, contentEl) {
  const d = getGlobal();
  const src = d.dissChapterContent[ch] || '';
  const sections = splitIntoSections(src);
  if(secIdx >= sections.length) return;
  const secSrc = sections[secIdx].content;
  const ta = document.createElement('textarea');
  ta.className = 'diss-section-inline-edit';
  ta.value = secSrc;
  ta.style.minHeight = Math.max(100, contentEl.offsetHeight) + 'px';
  contentEl.innerHTML = '';
  contentEl.appendChild(ta);
  ta.focus();
  const finish = () => {
    sections[secIdx].content = ta.value;
    d.dissChapterContent[ch] = reassembleSections(sections);
    save(d);
    const rd = document.getElementById('diss-render-'+ch);
    rd.innerHTML = dissRenderWithSections(d.dissChapterContent[ch]);
    attachSectionHandlers(ch);
  };
  ta.onblur = finish;
  ta.onkeydown = (e) => { if(e.key==='Escape'){e.preventDefault();finish();} };
}

function splitIntoSections(src) {
  const lines = src.split('\n');
  let sections = [], cur = {heading:'', content:''};
  let curLines = [];
  for(const l of lines){
    const hm = l.match(/^(#{1,6})\s+(.+)$/);
    if(hm){
      if(cur.heading||curLines.length) { cur.content = curLines.join('\n'); sections.push(cur); }
      cur = {heading:l, content:''}; curLines = [];
    } else { curLines.push(l); }
  }
  cur.content = curLines.join('\n'); sections.push(cur);
  return sections;
}

function reassembleSections(sections) {
  return sections.map(s => (s.heading ? s.heading+'\n' : '')+s.content).join('\n');
}

// ============ FILE SYSTEM ACCESS API ============
async function dissLinkFile(ch) {
  try {
    const [handle] = await window.showOpenFilePicker({types:[{description:'Markdown',accept:{'text/markdown':['.md','.txt']}}]});
    dissFileHandles[ch] = handle;
    document.getElementById('diss-sync-'+ch).textContent = '📎 '+handle.name;
    // Persist handle in IndexedDB
    saveFileHandle(ch, handle);
  } catch(e) { if(e.name!=='AbortError') console.error(e); }
}

async function dissPullLocal(ch) {
  const handle = dissFileHandles[ch];
  if(!handle) { alert('No file linked. Click "📂 Link File" first.'); return; }
  try {
    const file = await handle.getFile();
    const text = await file.text();
    const d = getGlobal();
    if(!d.dissChapterContent) d.dissChapterContent = {};
    d.dissChapterContent[ch] = text;
    save(d);
    const ta = document.getElementById('diss-edit-'+ch);
    const rd = document.getElementById('diss-render-'+ch);
    ta.value = text;
    rd.innerHTML = dissRenderWithSections(text);
    attachSectionHandlers(ch);
    document.getElementById('diss-sync-'+ch).textContent = '📎 '+handle.name+' ✓ pulled';
  } catch(e) { alert('Error reading file: '+e.message); }
}

async function dissPushLocal(ch) {
  const handle = dissFileHandles[ch];
  if(!handle) { alert('No file linked. Click "📂 Link File" first.'); return; }
  try {
    const d = getGlobal();
    const content = (d.dissChapterContent && d.dissChapterContent[ch]) || '';
    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
    document.getElementById('diss-sync-'+ch).textContent = '📎 '+handle.name+' ✓ pushed';
  } catch(e) { alert('Error writing file: '+e.message); }
}

// IndexedDB for persisting file handles
function openHandleDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('dissFileHandles', 1);
    req.onupgradeneeded = () => { req.result.createObjectStore('handles'); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveFileHandle(ch, handle) {
  try {
    const db = await openHandleDB();
    const tx = db.transaction('handles','readwrite');
    tx.objectStore('handles').put(handle, ch);
  } catch(e) { console.warn('Could not persist file handle:', e); }
}

async function restoreFileHandles() {
  try {
    const db = await openHandleDB();
    const tx = db.transaction('handles','readonly');
    const store = tx.objectStore('handles');
    ['ch1','ch2','ch3'].forEach(ch => {
      const req = store.get(ch);
      req.onsuccess = () => {
        if(req.result) {
          dissFileHandles[ch] = req.result;
          document.getElementById('diss-sync-'+ch).textContent = '📎 '+req.result.name;
        }
      };
    });
  } catch(e) { console.warn('Could not restore file handles:', e); }
}

// ============ EXISTING CHAPTER OUTLINE + TIMER ============
function addCh() {
  const name = document.getElementById('ch-name').value.trim(), target = parseInt(document.getElementById('ch-target').value) || 0;
  if (!name) return; const d = getGlobal(); d.chapters.push({ name, target, current: 0 }); save(d);
  document.getElementById('ch-name').value = ''; document.getElementById('ch-target').value = ''; renderChapters(); updateDissChapterSelect();
}
function renderChapters() {
  const d = getGlobal(), chs = d.chapters || []; let totalT = 0, totalC = 0, html = chs.length === 0 ? '<p style="color:var(--muted);font-size:13px;font-style:italic">Add chapters.</p>' : '';
  chs.forEach((ch, i) => { totalT += ch.target; totalC += ch.current; const pct = ch.target > 0 ? Math.min(100, Math.round(ch.current / ch.target * 100)) : 0;
    html += '<div style="margin-bottom:8px"><div class="flex" style="align-items:center"><b style="font-size:13px;flex:1">' + ch.name + '</b><input type="number" class="fin" style="width:90px" value="' + ch.current + '" onchange="updChW(' + i + ',this.value)"> / ' + ch.target + '<button class="btn" style="font-size:10px;padding:2px 6px;margin-left:4px" onclick="rmCh(' + i + ')">✕</button></div><div class="pbar"><div class="pfill" style="width:' + pct + '%"></div></div></div>'; });
  document.getElementById('ch-list').innerHTML = html;
  const tp = totalT > 0 ? Math.min(100, Math.round(totalC / totalT * 100)) : 0;
  document.getElementById('diss-pbar').style.width = tp + '%'; document.getElementById('diss-total').textContent = totalC.toLocaleString() + ' / ' + totalT.toLocaleString() + ' words (' + tp + '%)';
}
function updChW(i, val) { const d = getGlobal(); d.chapters[i].current = parseInt(val) || 0; save(d); renderChapters(); }
function rmCh(i) { const d = getGlobal(); d.chapters.splice(i, 1); save(d); renderChapters(); updateDissChapterSelect(); }
function updateDissChapterSelect() { const d = getGlobal(); document.getElementById('diss-ch-sel').innerHTML = '<option value="">Working on...</option>' + (d.chapters || []).map(ch => '<option value="' + ch.name + '">' + ch.name + '</option>').join(''); }
function dissTimer(action) {
  if (action === 'start' || action === '5min') {
    dissStartTime = Date.now(); dissElapsed = 0;
    document.getElementById('diss-start').disabled = true; document.getElementById('diss-5min').disabled = true; document.getElementById('diss-stop').disabled = false;
    document.getElementById('diss-timer-status').textContent = action === '5min' ? 'Just 5 minutes...' : '90-min deep work';
    dissInterval = setInterval(() => {
      dissElapsed = Math.floor((Date.now() - dissStartTime) / 1000);
      const h = Math.floor(dissElapsed / 3600), m = Math.floor((dissElapsed % 3600) / 60), s = dissElapsed % 60;
      document.getElementById('diss-timer').textContent = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
      if (dissElapsed >= 5400) document.getElementById('diss-timer-status').textContent = '⏰ 90 min! Break time.';
    }, 1000);
  } else if (action === 'stop') {
    clearInterval(dissInterval); const mins = Math.round(dissElapsed / 60);
    const ch = document.getElementById('diss-ch-sel').value || 'Unspecified';
    const d = getGlobal(); d.dissSessions.push({ date: today(), minutes: mins, chapter: ch, ts: new Date().toISOString() }); save(d);
    document.getElementById('diss-start').disabled = false; document.getElementById('diss-5min').disabled = false; document.getElementById('diss-stop').disabled = true;
    document.getElementById('diss-timer-status').textContent = 'Logged ' + mins + ' min on "' + ch + '"';
    document.getElementById('diss-timer').textContent = '00:00:00'; dissElapsed = 0;
    addLog('action', 'Dissertation: ' + mins + ' min on ' + ch); renderDissLog();
  }
}
function renderDissLog() {
  const d = getGlobal(), sessions = (d.dissSessions || []).slice(-20).reverse();
  document.getElementById('diss-log').innerHTML = sessions.length === 0 ? '<p style="color:var(--muted);font-size:13px;font-style:italic">No sessions yet.</p>' : sessions.map(s => '<div class="lentry action"><span class="lt">' + s.date + '</span> ' + s.minutes + ' min — ' + s.chapter + '</div>').join('');
}