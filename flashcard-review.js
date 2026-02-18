// ============ FLASHCARD REVIEW SHARED INFRASTRUCTURE ============
// ============ FLASHCARD REVIEW SHARED INFRASTRUCTURE ============

const FLASH_CARD_RULES = `Core Structure Rules:
- Each lexical item generates exactly two cards: one definition/translation card and one cloze card. These must be paired and adjacent.
- No orphan cards. Every word/expression must have both cards.

Definition / Translation Card Rules:
- The prompt side must NOT contain the target Italian word. The definition must be paraphrastic or translational.
- Definitions must be in Italian 99%+ of the time. Italian-language definitions should be idiomatic, modern, and explanatory (not dictionary-literal). Single words and short expressions always get Italian definitions, no exceptions.
- CRITICAL: Italian definitions must be DECLARATIVE, never interrogative. Use direct paraphrases or explanations. NEVER use question format like "Cosa significa quando..." or "Che cosa vuol dire...". Example: For "rivolgersi contro" → "produrre l'effetto opposto a quello desiderato" NOT "Cosa significa quando una situazione produce l'effetto opposto?"
- Exception for English on the prompt side: discourse operators, rhetorical frames, and stance-setting expressions (e.g. "per inciso", "non tanto X quanto Y", "da persona che + verbo", "As someone who...", "To decide what truly matters to me") should default to English-led prompts describing the FUNCTION of the move, because these are intention→form mappings where English better captures the rhetorical intent. Single concrete words and short expressions always get Italian definitions.
- When the target word is a conjugated verb, the definition card should present the word in its infinitive form. (Cloze cards can use whatever conjugation fits the sentence.)
- Answer side always includes: the Italian target word/expression + a brief English gloss.
- The gloss should flag register (colloquial, informal, legal, literary, vulgar, etc.) and if the term is archaic or has a more common modern alternative.
- Prefer natural Italian over calques.

Cloze Card Rules:
- The cloze must test productive knowledge (produce the target form, not just recognize it).
- Verbs must be conjugated in context. Never use infinitives as cloze answers.
- Prefer present tense or passato prossimo. No passato remoto unless unavoidable.
- Rich contextual cues are mandatory. The sentence must contain enough information that the word is inferable.
- CRITICAL: Cloze sentences must be fully self-contained — answerable by someone who has NOT read the source text. Do NOT simply copy the student's original sentence with a blank. If the original sentence lacks enough semantic cues to uniquely determine the answer, REWRITE the cloze sentence to embed the necessary context. Example: "un problema quasi inevitabile della cultura ________" is unanswerable without external context. Rewrite to something like: "L'alpinismo in alta quota è pericoloso, e questo è un problema della cultura ________ stessa" where the topic makes the answer inferable.
- Natural syntax and discourse flow take priority.

Register, Usage, and Accuracy Rules:
- Register must be explicit somewhere in the pair (especially colloquial/vulgar, legal/bureaucratic, literary/antiquated).
- Avoid over-formalization. Prefer contemporary usage.
- The two cards don't need to mirror each other structurally. Together they must lock down meaning, usage, and form.

Exceptions to the Two-Card Rule:
- For tense/mood errors (wrong tense, missed congiuntivo, indicativo vs congiuntivo, etc.) where the learner knows the word but produced the wrong form: generate ONLY a cloze card testing the correct tense/mood in context. No definition card needed.
- Do NOT generate any cards for: gender/number agreement slips, one-off article choice slips, or typographic/punctuation fixes. These are mechanical and not worth flashcard space.
- EXCEPTION: If an article choice error reflects a SEMANTIC pattern (generic vs definite vs partitive where meaning changes, or systematic omission of articles on abstract nouns due to English interference), it IS worth a card. Only skip true one-off slips.

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

B. What NOT to Extract (no flashcards for these):
- Gender/number agreement slips, one-off article choice slips — these are mechanical, not vocabulary gaps.
- EXCEPTION: Systematic article patterns that encode meaning (generic vs definite vs partitive contrasts, repeated omission of articles on abstract nouns from English interference) SHOULD be extracted.
- Typographic/punctuation errors (missed commas, capitalization) — not learning items.
- Transparent, obvious, predictable, stylistically neutral synonyms.
- Hyper-local phrasing that only works in that precise context and doesn't generalize.

B2. Cloze-Only Items (no definition card, just a cloze card):
- Tense or mood errors (wrong tense, missed congiuntivo, indicativo where congiuntivo needed, etc.) where the learner clearly knows the word but produced the wrong form. Generate ONLY a cloze card testing the correct tense/mood in a natural sentence.

C. Extraction Granularity:
- Prefer constructions over single words (verb+complement patterns, stance-setting frames, concessive/contrastive structures).
- Allow partial propositions ("da persona che + verbo", "non tanto X quanto Y", "il fatto che + congiuntivo").

D. Card Framing:
- Default to Italian-language definition cards (consistent with the flash card rules). Use English only for long propositional phrases or discourse moves where Italian paraphrase would be disproportionately longer.
- Definition prompts should describe the function, not literal wording.
- Cloze cards must recreate the rhetorical move, not just the word.
- CRITICAL: Cloze sentences derived from student compositions must NEVER be a copy-paste of the original sentence with a word blanked out. The cloze must be a new or substantially rewritten sentence that provides enough internal context to make the answer uniquely recoverable without having read the source text.

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
      <h4 style="font-size:18px;margin-bottom:8px">🃏 Review Flashcards (${cards.length} cards)</h4>
      <p style="font-size:18px;color:var(--muted);margin-bottom:10px">Edit front/back, delete unwanted cards, then submit approved ones to your deck.</p>
      <div id="${containerId}-list" class="fc-review-list" style="max-height:320px;overflow-y:auto;border:1px solid var(--border);border-radius:6px;padding:6px;margin-bottom:8px"></div>
      <div class="flex mt8" style="gap:8px">
        <button class="btn btn-p" onclick="fcSubmitAll('${containerId}')">✅ Submit All to Deck</button>
        <span id="${containerId}-submit-status" style="font-size:18px;color:var(--muted)"></span>
      </div>
      <div class="fc-chat-section" style="margin-top:12px;border-top:1px dashed var(--border);padding-top:10px">
        <h4 style="font-size:20px;margin-bottom:6px">💬 Ask about these cards</h4>
        <div id="${containerId}-chat-log" style="max-height:200px;overflow-y:auto;font-size:18px;margin-bottom:6px"></div>
        <div class="flex" style="gap:6px">
          <input class="fin flex-1" id="${containerId}-chat-input" placeholder="Ask a follow-up question..." style="font-size:18px" onkeydown="if(event.key==='Enter')fcChat('${containerId}')">
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
    const prompt = `Context: ${rev.context}\n\nCurrent flashcards:\n${currentCards}\n\nUser question: ${q}\n\n${FLASH_CARD_RULES}\n\nTone instructions: Be direct and factual. No motivational language, no emojis in your response, no encouragement or cheerleading. Assume the user is competent. Precision over politeness. Be concise but not shallow. If something is complex, explain why rather than summarizing it away.\n\nIf the user asks to add/modify/generate cards, you MUST follow the flashcard construction rules above. Return any new cards as a JSON array with "front" and "back" fields, wrapped in <cards>[...]</cards> tags, IN ADDITION to your normal response. Otherwise answer the question analytically.`;
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

// ============ SHARED FEEDBACK PROMPT ============
const CORRECTION_PROMPT_DAILY = (txt) => `Sei un tutor esperto di italiano a livello C1-C2. Lo studente ha scritto questa composizione giornaliera:

"${txt}"${_getTopInterferenceContext()}

Istruzioni — segui questo formato ESATTAMENTE:

1. TESTO CORRETTO
Riscrivi COMPLETAMENTE il testo corretto dall'inizio alla fine. Correggi TUTTI gli errori, inclusi quelli tipografici (virgole, maiuscole, ecc.), ma non segnalarli separatamente se sarebbero errori anche in inglese (lazy typography). Segnala solo errori di punteggiatura/maiuscole specifici dell'italiano.

2. ERRORI MECCANICI (sviste di genere/numero/concordanza)
Solo errori in cui lo studente CONOSCE la regola ma l'ha applicata male — sviste, lapsus, disattenzioni. Esempi: "la problema" (genere sbagliato), "le casa" (numero sbagliato), concordanza aggettivo-nome errata. Elencali in modo sintetico, una riga per errore: originale → corretto. Niente spiegazioni elaborate. Questi contano per il punteggio ma sono meno diagnostici.

ATTENZIONE: L'omissione di articoli su nomi generici/astratti (es. "regole non funzionano" invece di "le regole non funzionano") NON è un errore meccanico — è un calco strutturale dall'inglese e va in categoria 3.

3. ERRORI SOSTANZIALI
Per ogni errore di vocabolario, costruzione, anglicismo, calco strutturale dall'inglese (incluse omissioni di articoli su nomi generici), tempo/modo verbale sbagliato, o scelta stilistica inadeguata: originale → corretto + spiegazione IN ITALIANO del perché. Questi sono gli errori che contano di più.

4. PUNTEGGIO
Scrivi su una riga separata nel formato esatto: SCORE: XX/100 (LIVELLO)
dove XX è un numero da 0 a 100 e LIVELLO è A2/B1/B2/B2+/C1/C1+/C2.
Il punteggio deve riflettere TUTTI gli errori (meccanici + sostanziali), ma NON gli errori tipografici banali.

Fasce di calibrazione (usale come riferimento stabile):
- 90-100 (C2): Prosa praticamente nativa. Nessun anglicismo. Registro, collocazioni e ritmo impeccabili.
- 80-89 (C1+): Pochi errori, tutti minori. Buon controllo del registro. Qualche calco residuo.
- 70-79 (C1/B2+): Errori sostanziali presenti ma non frequenti. Struttura argomentativa solida ma con interferenze L1 visibili.
- 60-69 (B2): Errori sostanziali frequenti. Calchi dall'inglese ricorrenti. Registro spesso piatto o inadeguato.
- Sotto 60 (B1 o meno): Errori strutturali gravi, comprensione compromessa, sintassi elementare.

REGOLA IMPORTANTE: Nelle correzioni, preferisci interventi minimi. NON riscrivere per gusto stilistico. Correggi solo ciò che è effettivamente errato o inadeguato.

5. PATTERN DI INTERFERENZA
Scrivi su una riga separata nel formato esatto:
INTERFERENCE: pattern1 | pattern2 | pattern3
Elenca i pattern di interferenza L1 rilevati in questo testo (calchi sintattici, ordine delle parole, preposizioni, articoli, ecc.). Separa con |. Se nessuno, scrivi INTERFERENCE: nessuno.

Sii diretto e fattuale. Niente incoraggiamenti, niente complimenti, niente ammorbidimenti.`;

const CORRECTION_PROMPT_ARTICLE = (title, txt) => `Lo studente ha letto un articolo italiano intitolato "${title}" e ha scritto questa riflessione in italiano:

"${txt}"${_getTopInterferenceContext()}

Istruzioni — segui questo formato ESATTAMENTE:

1. TESTO CORRETTO
Riscrivi COMPLETAMENTE il testo corretto dall'inizio alla fine. Correggi TUTTI gli errori, inclusi quelli tipografici (virgole, maiuscole, ecc.), ma non segnalarli separatamente se sarebbero errori anche in inglese (lazy typography). Segnala solo errori di punteggiatura/maiuscole specifici dell'italiano.

2. ERRORI MECCANICI (sviste di genere/numero/concordanza)
Solo errori in cui lo studente CONOSCE la regola ma l'ha applicata male — sviste, lapsus, disattenzioni. Esempi: "la problema" (genere sbagliato), "le casa" (numero sbagliato), concordanza aggettivo-nome errata. Elencali in modo sintetico, una riga per errore: originale → corretto. Niente spiegazioni elaborate. Questi contano per il punteggio ma sono meno diagnostici.

ATTENZIONE: L'omissione di articoli su nomi generici/astratti (es. "regole non funzionano" invece di "le regole non funzionano") NON è un errore meccanico — è un calco strutturale dall'inglese e va in categoria 3.

3. ERRORI SOSTANZIALI
Per ogni errore di vocabolario, costruzione, anglicismo, calco strutturale dall'inglese (incluse omissioni di articoli su nomi generici), tempo/modo verbale sbagliato, o scelta stilistica inadeguata: originale → corretto + spiegazione IN ITALIANO del perché. Questi sono gli errori che contano di più.

4. PUNTEGGIO
Scrivi su una riga separata nel formato esatto: SCORE: XX/100 (LIVELLO)
dove XX è un numero da 0 a 100 e LIVELLO è A2/B1/B2/B2+/C1/C1+/C2.
Il punteggio deve riflettere TUTTI gli errori (meccanici + sostanziali), ma NON gli errori tipografici banali.

Fasce di calibrazione (usale come riferimento stabile):
- 90-100 (C2): Prosa praticamente nativa. Nessun anglicismo. Registro, collocazioni e ritmo impeccabili.
- 80-89 (C1+): Pochi errori, tutti minori. Buon controllo del registro. Qualche calco residuo.
- 70-79 (C1/B2+): Errori sostanziali presenti ma non frequenti. Struttura argomentativa solida ma con interferenze L1 visibili.
- 60-69 (B2): Errori sostanziali frequenti. Calchi dall'inglese ricorrenti. Registro spesso piatto o inadeguato.
- Sotto 60 (B1 o meno): Errori strutturali gravi, comprensione compromessa, sintassi elementare.

REGOLA IMPORTANTE: Nelle correzioni, preferisci interventi minimi. NON riscrivere per gusto stilistico. Correggi solo ciò che è effettivamente errato o inadeguato.

5. PATTERN DI INTERFERENZA
Scrivi su una riga separata nel formato esatto:
INTERFERENCE: pattern1 | pattern2 | pattern3
Elenca i pattern di interferenza L1 rilevati in questo testo (calchi sintattici, ordine delle parole, preposizioni, articoli, ecc.). Separa con |. Se nessuno, scrivi INTERFERENCE: nessuno.

Sii diretto e fattuale. Niente incoraggiamenti, niente complimenti, niente ammorbidimenti.`;

const CORRECTION_PROMPT_REPRODUCTION = (paragraphs) => {
  // paragraphs is an array of {original, reproduction} objects
  const aligned = paragraphs.map((p, i) => `--- Paragrafo ${i + 1} ---\nORIGINALE:\n${p.original}\n\nRIPRODUZIONE DELLO STUDENTE:\n${p.reproduction}`).join('\n\n');
  return `Sei un valutatore esperto di italiano a livello C1-C2. Lo studente ha letto un articolo italiano e poi ha tentato di riprodurre a memoria alcuni paragrafi chiave senza guardare il testo originale.

L'obiettivo NON è la riproduzione parola per parola, ma dimostrare di aver interiorizzato la sintassi, il registro, le collocazioni e il ritmo del testo originale.

Ecco i paragrafi originali e le riproduzioni dello studente:

${aligned}

Istruzioni — segui questo formato ESATTAMENTE:

Per OGNI paragrafo, valuta su scala 0-5:

1. FEDELTÀ SEMANTICA (0-5): Il contenuto e le idee sono gli stessi? Informazioni mancanti o aggiunte?
2. NATURALEZZA COLLOCAZIONALE (0-5): Le combinazioni di parole sono native italiane o calchi dall'inglese?
3. STRUTTURA INFORMATIVA / RITMO (0-5): L'architettura della frase rispecchia il flusso naturale della prosa italiana? Ordine delle informazioni, subordinazione, posizione del verbo?
4. ALLINEAMENTO DI REGISTRO (0-5): Il livello di formalità corrisponde all'originale? (giornalistico, accademico, colloquiale, ecc.) Tempi verbali appropriati al genere?
5. PATTERN DI INTERFERENZA DALL'INGLESE: Elenca ogni costrutto che tradisce interferenza L1 (calchi sintattici, ordine SVO forzato, articoli mancanti su nomi generici, preposizioni calcolate dall'inglese, ecc.)

Dopo tutti i paragrafi, scrivi:

RIEPILOGO ERRORI SOSTANZIALI:
Per ogni errore significativo trovato in tutti i paragrafi: originale → riproduzione dello studente → forma corretta + spiegazione breve IN ITALIANO.

PUNTEGGIO FINALE:
Calcola il punteggio pesato delle 4 dimensioni su tutti i paragrafi:
- Fedeltà semantica: peso 35%
- Naturalezza collocazionale: peso 30%
- Struttura informativa / ritmo: peso 25%
- Allineamento di registro: peso 10%
Formula: per ogni paragrafo, (sem×0.35 + coll×0.30 + strutt×0.25 + reg×0.10) / 5 × 100. Poi media tra paragrafi.
Scrivi su una riga separata nel formato esatto: SCORE: XX/100 (LIVELLO)
dove LIVELLO è A2/B1/B2/B2+/C1/C1+/C2.

Scrivi anche le medie per dimensione nel formato:
DIMENSIONS: sem=X.X coll=X.X struct=X.X reg=X.X

Sii diretto e fattuale. Niente incoraggiamenti, niente complimenti, niente ammorbidimenti.`;
};

function _parseReflectionScore(resp) {
  const m = resp.match(/SCORE:\s*(\d+)\s*\/\s*100\s*\(([^)]+)\)/i);
  if (m) return { score: parseInt(m[1]), level: m[2].trim() };
  // Fallback: try to find just a level
  const m2 = resp.match(/\b(A2|B1|B2\+?|C1\+?|C2)\b/);
  if (m2) return { score: null, level: m2[1] };
  return { score: null, level: null };
}

function _parseReproDimensions(resp) {
  // Parse DIMENSIONS: sem=X.X coll=X.X struct=X.X reg=X.X
  const m = resp.match(/DIMENSIONS:\s*sem=([\d.]+)\s+coll=([\d.]+)\s+struct=([\d.]+)\s+reg=([\d.]+)/i);
  if (m) return { sem: parseFloat(m[1]), coll: parseFloat(m[2]), struct: parseFloat(m[3]), reg: parseFloat(m[4]) };
  return null;
}

// ============ INTERFERENCE PATTERN TRACKER ============
function _parseInterferencePatterns(resp) {
  // Parse INTERFERENCE: pattern1 | pattern2 | pattern3
  const m = resp.match(/INTERFERENCE:\s*(.+)/i);
  if (!m) return [];
  return m[1].split('|').map(p => p.trim()).filter(p => p.length > 3);
}

function _updateInterferenceProfile(patterns) {
  if (!patterns || !patterns.length) return;
  const d = load();
  if (!d.interferenceProfile) d.interferenceProfile = [];
  const profile = d.interferenceProfile;
  const dt = today();
  patterns.forEach(pat => {
    const normalized = pat.toLowerCase();
    const existing = profile.find(p => p.pattern.toLowerCase() === normalized);
    if (existing) {
      existing.count = (existing.count || 1) + 1;
      existing.lastSeen = dt;
    } else {
      profile.push({ pattern: pat, count: 1, firstSeen: dt, lastSeen: dt });
    }
  });
  // Sort by count descending, keep top 20
  profile.sort((a, b) => b.count - a.count);
  d.interferenceProfile = profile.slice(0, 20);
  save(d);
}

function _getTopInterferenceContext() {
  const d = load();
  const profile = d.interferenceProfile || [];
  if (!profile.length) return '';
  const top3 = profile.slice(0, 3).map(p => '- ' + p.pattern + ' (rilevato ' + p.count + ' volte)');
  return '\n\nPATTERN DI INTERFERENZA RICORRENTI DELLO STUDENTE (presta particolare attenzione a questi):\n' + top3.join('\n');
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
    const feedbackPrompt = CORRECTION_PROMPT_DAILY(txt);
    const feedbackResp = await callClaude(key, feedbackPrompt);
    res.innerHTML = '<div style="background:var(--bg);padding:10px;border-radius:6px;font-size:13px;white-space:pre-wrap;border:1px solid var(--border)">' + escHtml(feedbackResp) + '</div>';
    // Parse and save score + update interference profile
    const scoreData = _parseReflectionScore(feedbackResp);
    const intPatterns = _parseInterferencePatterns(feedbackResp);
    _updateInterferenceProfile(intPatterns);
    // Save correction with score
    const d = getGlobal();
    d.corrections.push({ date: today(), text: txt, response: feedbackResp, score: scoreData });
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

