// ============ FLASHCARD REVIEW SHARED INFRASTRUCTURE ============
// ============ FLASHCARD REVIEW SHARED INFRASTRUCTURE ============

const FLASH_CARD_RULES = `Core Structure Rules:
- Each lexical item generates exactly two cards: one definition/translation card and one cloze card. These must be paired and adjacent.
- No orphan cards. Every word/expression must have both cards.

Definition / Translation Card Rules:
- The prompt side must NOT contain the target Italian word. The definition must be paraphrastic or translational.
- Default: Italian-language definition, idiomatic, modern, explanatory (not dictionary-literal).
- Exception: Use English on prompt side for discourse markers, stance-setting expressions, long propositional phrases.
- Answer side always includes: the Italian target word/expression + a brief English gloss.
- The gloss should flag register (colloquial, informal, legal, literary, vulgar, etc.) and if the term is archaic or has a more common modern alternative.
- Prefer natural Italian over calques.

Cloze Card Rules:
- The cloze must test productive knowledge (produce the target form, not just recognize it).
- Verbs must be conjugated in context. Never use infinitives as cloze answers.
- Prefer present tense or passato prossimo. No passato remoto unless unavoidable.
- Rich contextual cues are mandatory. The sentence must contain enough information that the word is inferable.
- Natural syntax and discourse flow take priority.

Register, Usage, and Accuracy Rules:
- Register must be explicit somewhere in the pair (especially colloquial/vulgar, legal/bureaucratic, literary/antiquated).
- Avoid over-formalization. Prefer contemporary usage.
- The two cards don't need to mirror each other structurally. Together they must lock down meaning, usage, and form.

Scope Rules:
- One lexical target per pair. No combining unrelated words.
- Mixed directionality (IT→EN or EN→IT) is allowed depending on learning value.
- Be explicit about markedness (odd, dated, sarcastic, regionally marked, unusually strong).`;

const COMPOSITION_EXTRACTION_RULES = `Extraction Rules from Corrected Composition Exercises (targeting C2-level control):

A. Extraction Priority (What to Pull First):
1. Corrections replacing English-shaped structures with Italian ones (absolute priority): argument framing, concessive structures, causal chains, stance softening/strengthening.
2. Upgraded verbs replacing generic ones (fare/dire/andare/mettere/avere → specific verb).
3. Discourse operators and meta-textual moves: framing moves, evaluation phrases, self-positioning.
4. Corrections that reduce explicitness without losing meaning (Italian prefers implication over specification).
5. Idiomatic compression: longer phrase replaced by shorter idiomatic unit.

B. What NOT to Extract:
- Pure grammar fixes (agreement, gender/number, article choice) with no semantic/stylistic upgrade.
- Transparent, obvious, predictable, stylistically neutral synonyms.
- Hyper-local phrasing that only works in that precise context and doesn't generalize.

C. Extraction Granularity:
- Prefer constructions over single words (verb+complement patterns, stance-setting frames, concessive/contrastive structures).
- Allow partial propositions ("da persona che + verbo", "non tanto X quanto Y", "il fatto che + congiuntivo").

D. Card Framing:
- Default to English-led definition cards (these encode thought moves, not objects).
- English prompt should describe the function, not literal wording.
- Cloze cards must recreate the rhetorical move, not just the word.

E. Frequency Control:
- Cap: 5-8 items per text. More dilutes salience and retention.
- Prefer recurrence over novelty.

F. C2 Calibration (before extracting, ask):
- Would a fluent C1 speaker plausibly avoid this? → extract.
- Does this change how the sentence positions the speaker? → extract.
- Would mastering this reduce future correction density? → extract.

G. Meta-Rule: Extraction is about control, not accumulation. Every item should reduce Anglicism, increase rhetorical flexibility, or improve stance precision.`;

// Shared state for active flashcard reviews
const _fcReviews = {};

function renderFlashcardReview(containerId, cards, context, tags) {
  const container = document.getElementById(containerId);
  if (!container) return;
  // Hide any previous success message
  const prevSuccess = document.getElementById(containerId + '-success');
  if (prevSuccess) prevSuccess.style.display = 'none';
  _fcReviews[containerId] = { cards: cards.map(c => ({...c})), context, tags };
  container.style.display = 'block';
  container.innerHTML = `
    <div class="fc-review">
      <h4 style="font-size:14px;margin-bottom:8px">🃏 Review Flashcards (${cards.length} cards)</h4>
      <p style="font-size:11px;color:var(--muted);margin-bottom:10px">Edit front/back, delete unwanted cards, then submit approved ones to your deck.</p>
      <div id="${containerId}-list" class="fc-review-list" style="max-height:320px;overflow-y:auto;border:1px solid var(--border);border-radius:6px;padding:6px;margin-bottom:8px"></div>
      <div class="flex mt8" style="gap:8px">
        <button class="btn btn-p" onclick="fcSubmitAll('${containerId}')">✅ Submit All to Deck</button>
        <span id="${containerId}-submit-status" style="font-size:12px;color:var(--muted)"></span>
      </div>
      <div class="fc-chat-section" style="margin-top:12px;border-top:1px dashed var(--border);padding-top:10px">
        <h4 style="font-size:13px;margin-bottom:6px">💬 Ask about these cards</h4>
        <div id="${containerId}-chat-log" style="max-height:200px;overflow-y:auto;font-size:12px;margin-bottom:6px"></div>
        <div class="flex" style="gap:6px">
          <input class="fin flex-1" id="${containerId}-chat-input" placeholder="Ask a follow-up question..." onkeydown="if(event.key==='Enter')fcChat('${containerId}')">
          <button class="btn btn-s" onclick="fcChat('${containerId}')">Send</button>
        </div>
      </div>
    </div>`;
  _fcRenderCards(containerId);
}

function _fcRenderCards(containerId) {
  const rev = _fcReviews[containerId];
  if (!rev) return;
  const list = document.getElementById(containerId + '-list');
  if (!list) return;
  list.innerHTML = rev.cards.length === 0 ?
    '<p style="color:var(--muted);font-size:12px;font-style:italic">No cards. Use the chat to request more.</p>' :
    rev.cards.map((c, i) => `
      <div class="fc-card-row" style="display:flex;gap:6px;align-items:flex-start;margin-bottom:6px;padding:6px;background:var(--bg);border:1px solid var(--border);border-radius:6px">
        <div style="flex:1;min-width:0">
          <div style="font-size:10px;color:var(--muted);margin-bottom:2px">Front:</div>
          <textarea class="fin" style="width:100%;font-size:12px;min-height:36px;resize:vertical" id="${containerId}-f-${i}" onchange="fcEditCard('${containerId}',${i},'front',this.value)">${escHtml(c.front)}</textarea>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:10px;color:var(--muted);margin-bottom:2px">Back:</div>
          <textarea class="fin" style="width:100%;font-size:12px;min-height:36px;resize:vertical" id="${containerId}-b-${i}" onchange="fcEditCard('${containerId}',${i},'back',this.value)">${escHtml(c.back)}</textarea>
        </div>
        <button class="btn" style="font-size:10px;padding:4px 8px;margin-top:14px;color:var(--red)" onclick="fcDeleteCard('${containerId}',${i})">✕</button>
      </div>`).join('');
}

function fcEditCard(containerId, idx, field, val) {
  if (_fcReviews[containerId] && _fcReviews[containerId].cards[idx]) {
    _fcReviews[containerId].cards[idx][field] = val;
  }
}

function fcDeleteCard(containerId, idx) {
  if (_fcReviews[containerId]) {
    _fcReviews[containerId].cards.splice(idx, 1);
    _fcRenderCards(containerId);
  }
}

function fcSubmitAll(containerId) {
  const rev = _fcReviews[containerId];
  if (!rev || rev.cards.length === 0) { alert('No cards to submit.'); return; }
  let count = 0;
  rev.cards.forEach(c => {
    if (c.front.trim() && c.back.trim()) {
      addCard(c.front.trim(), c.back.trim(), rev.tags);
      count++;
    }
  });
  // Hide the review UI and show a success message below it
  const container = document.getElementById(containerId);
  if (container) {
    container.style.display = 'none';
    // Create or update success message after the container
    let successEl = document.getElementById(containerId + '-success');
    if (!successEl) {
      successEl = document.createElement('div');
      successEl.id = containerId + '-success';
      successEl.style.cssText = 'margin-top:8px;padding:8px 12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;color:#16a34a;font-size:13px;font-weight:600';
      container.parentNode.insertBefore(successEl, container.nextSibling);
    }
    successEl.textContent = '✅ Added ' + count + ' cards to deck!';
    successEl.style.display = 'block';
  }
  rev.cards = [];
  delete _fcReviews[containerId];
  addLog('action', 'Submitted ' + count + ' reviewed cards (' + rev.tags + ')');
}

async function fcChat(containerId) {
  const rev = _fcReviews[containerId];
  if (!rev) return;
  const input = document.getElementById(containerId + '-chat-input');
  const log = document.getElementById(containerId + '-chat-log');
  const q = input.value.trim();
  if (!q) return;
  input.value = '';
  const key = localStorage.getItem('cc_apikey');
  if (!key) { alert('Set your Anthropic API key in the Claude tab first.'); return; }
  log.innerHTML += '<div style="margin-bottom:4px"><b style="color:var(--acc)">You:</b> ' + escHtml(q) + '</div>';
  log.innerHTML += '<div style="margin-bottom:4px;color:var(--muted)">⏳ Thinking...</div>';
  log.scrollTop = log.scrollHeight;
  try {
    const currentCards = rev.cards.map(c => 'Front: ' + c.front + ' | Back: ' + c.back).join('\n');
    const prompt = `Context: ${rev.context}\n\nCurrent flashcards:\n${currentCards}\n\nUser question: ${q}\n\nIf the user asks to add/modify/generate cards, return any new cards as a JSON array with "front" and "back" fields, wrapped in <cards>[...]</cards> tags, IN ADDITION to your normal response. Otherwise just answer the question helpfully.`;
    const resp = await callClaude(key, prompt);
    // Remove the "Thinking..." message
    const msgs = log.querySelectorAll('div');
    if (msgs.length > 0) msgs[msgs.length - 1].remove();
    // Check for new cards in response
    const cardMatch = resp.match(/<cards>([\s\S]*?)<\/cards>/);
    let cleanResp = resp.replace(/<cards>[\s\S]*?<\/cards>/, '').trim();
    log.innerHTML += '<div style="margin-bottom:6px"><b style="color:var(--green)">Claude:</b> ' + cleanResp.replace(/\n/g, '<br>') + '</div>';
    if (cardMatch) {
      try {
        const newCards = JSON.parse(cardMatch[1]);
        if (Array.isArray(newCards)) {
          newCards.forEach(c => {
            if (c.front && c.back) rev.cards.push({ front: c.front, back: c.back });
          });
          _fcRenderCards(containerId);
          log.innerHTML += '<div style="color:var(--green);font-size:11px;margin-bottom:4px">📥 Added ' + newCards.length + ' cards to review list.</div>';
        }
      } catch(e) { /* ignore parse errors */ }
    }
    log.scrollTop = log.scrollHeight;
  } catch (e) {
    const msgs = log.querySelectorAll('div');
    if (msgs.length > 0) msgs[msgs.length - 1].remove();
    log.innerHTML += '<div style="color:var(--red);margin-bottom:4px">Error: ' + escHtml(e.message) + '</div>';
  }
}

function _parseCardsJSON(resp) {
  try {
    // Strip markdown code fences if present
    let cleaned = resp.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
    const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch(e) {
    // If JSON is truncated, try to salvage complete objects
    try {
      let cleaned = resp.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
      const arrMatch = cleaned.match(/\[[\s\S]*/);
      if (arrMatch) {
        let partial = arrMatch[0];
        // Find the last complete object (ends with })
        const lastBrace = partial.lastIndexOf('}');
        if (lastBrace > 0) {
          partial = partial.slice(0, lastBrace + 1) + ']';
          return JSON.parse(partial);
        }
      }
    } catch(e2) { /* give up */ }
  }
  return [];
}

// ============ REFLECTION SUBMIT (Daily Composition) ============
async function submitRefl() {
  const txt = document.getElementById('refl-txt').value.trim();
  const wc = txt.split(/\s+/).filter(w => w).length;
  if (wc < 200) { alert('Min 200 words required. Currently: ' + wc); return; }
  const key = localStorage.getItem('cc_apikey');
  if (!key) { alert('Set your Anthropic API key in the Claude tab first.'); switchTab('claude'); return; }
  const res = document.getElementById('refl-res');
  res.style.display = 'block'; res.innerHTML = '<p>⏳ Sending to Claude for correction + flashcard generation...</p>';
  try {
    const feedbackPrompt = `Sei un tutor esperto di italiano a livello C1-C2. Lo studente ha scritto questa composizione giornaliera:\n\n"${txt}"\n\nIstruzioni:\n1. Per prima cosa, riscrivi COMPLETAMENTE il testo corretto dall'inizio alla fine — il testo intero, non solo frammenti.\n2. Poi elenca ogni errore: originale → corretto, con una spiegazione IN ITALIANO del perché era sbagliato.\n3. Valuta il livello (A2/B1/B2/C1/C2).\n\nSii diretto e fattuale. Niente incoraggiamenti, niente complimenti, niente ammorbidimenti. Solo correzioni e spiegazioni.\n\nFormatta la risposta con intestazioni chiare.`;
    const feedbackResp = await callClaude(key, feedbackPrompt);
    res.innerHTML = '<div style="background:var(--bg);padding:10px;border-radius:6px;font-size:13px;white-space:pre-wrap;border:1px solid var(--border)">' + escHtml(feedbackResp) + '</div>';
    // Save correction
    const d = getGlobal();
    d.corrections.push({ date: today(), text: txt, response: feedbackResp });
    save(d);
    // Now generate flashcards
    const cardPrompt = `You are generating flashcards from a corrected Italian composition exercise.\n\nOriginal student text:\n"${txt}"\n\nClaude's corrections:\n${feedbackResp}\n\n${COMPOSITION_EXTRACTION_RULES}\n\n${FLASH_CARD_RULES}\n\nBased on the corrections above, extract 5-8 flashcard items following the extraction and card construction rules. For each item, generate the paired definition card and cloze card.\n\nReturn ONLY a JSON array of objects with "front" and "back" string fields. Example:\n[{"front":"...","back":"..."},{"front":"...","back":"..."}]`;
    const cardResp = await callClaude(key, cardPrompt);
    const cards = _parseCardsJSON(cardResp);
    if (cards.length > 0) {
      renderFlashcardReview('refl-card-review', cards, 'Daily composition:\n' + txt + '\n\nCorrections:\n' + feedbackResp, 'composition');
    }
    addLog('action', 'Italian composition submitted + corrected + ' + cards.length + ' cards generated');
  } catch (e) { res.innerHTML = '<p style="color:var(--red)">Error: ' + escHtml(e.message) + '</p>'; }
}

