#!/usr/bin/env node
/**
 * Flashcard Deck Audit — Phase 1 Triage Script
 * Reads anki_cards.json → produces audit-report.json
 * 
 * Flag categories:
 *   COGNATE        – front/back are transparently similar
 *   TOO_EASY       – high interval, zero lapses, high ease (deeply known basic vocab)
 *   SPELLING_ERROR – known misspellings in the Italian
 *   ARCHAIC        – words unlikely to appear in modern formal writing or a contemporary novel
 *   DUPLICATE      – same Italian word tested by multiple cards
 *   GRAMMAR        – conjugation tables, preposition fills
 *   SYNONYM_CLUSTER – groups cards sharing the same English gloss
 *   BASIC_VOCAB    – elementary body-parts, household items, etc. that a B2 learner already knows
 */

const fs = require('fs');
const path = require('path');

const cards = JSON.parse(fs.readFileSync(path.join(__dirname, 'anki_cards.json'), 'utf8'));

// ─── helpers ────────────────────────────────────────────────────────────────

function normalize(s) {
  return (s || '').toLowerCase()
    .replace(/[^a-zà-ÿ0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const d = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      d[i][j] = a[i-1] === b[j-1]
        ? d[i-1][j-1]
        : 1 + Math.min(d[i-1][j], d[i][j-1], d[i-1][j-1]);
    }
  }
  return d[m][n];
}

function similarity(a, b) {
  const na = normalize(a), nb = normalize(b);
  if (!na || !nb) return 0;
  const dist = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  return maxLen === 0 ? 1 : 1 - dist / maxLen;
}

// ─── known spelling errors ──────────────────────────────────────────────────

const KNOWN_SPELLING_ERRORS = {
  'Buzurro': 'Buzzurro',
  'Traditto': 'Tradito',
  'Perceptio': 'Percepito',
  'Misognistico': 'Misogino',
  'segurie la prassi': 'seguire la prassi',
  'Dice le cose some stanno': 'Dice le cose come stanno',
  'Distraire': 'Distrarre',
  'l\'ignegno più acuto': 'l\'ingegno più acuto',
  'Inguino': 'Inguine',
  'la Miccia accessa': 'la miccia accesa',
  'Le spoglie umani': 'Le spoglie umane',
  'Kanguro': 'Canguro',
  'faggiano': 'fagiano',
  'Alfabetizzazione letteraria': 'Alfabetizzazione mediatica',
};

// ─── archaic / medieval / purely literary words ─────────────────────────────
// These would NOT plausibly appear in a modern novel or formal essay

const ARCHAIC_WORDS = new Set([
  'sollazzo', 'rena', 'libare', 'marmoreo', 'marmorea', 'guiderdone',
  'mercede', 'letizia', 'auliche', 'aulico', 'alatissimo',
  'tumulozzo', 'caccoletta', 'melmosetti',
  'saio',  // too specialized-medieval
]);

// Check if a card's back contains an archaic marker
const ARCHAIC_PATTERNS = [
  /\(letterario\)/i, /\(poetico\)/i, /\(arcaico\)/i, /\(archaic\)/i,
  /\(biblical\)/i, /\(medievale\)/i,
];

// ─── cognate detection ──────────────────────────────────────────────────────

const TRANSPARENT_COGNATES = new Set([
  'avocado', 'trilogia', 'apartheid', 'realistico', 'cilindrico',
  'isolante', 'opaco', 'precario', 'sofisticato', 'professionista',
  'professionale', 'mensile', 'adiacente', 'galvanizzato',
  'esacerbato', 'tracciabile', 'anidride carbonica',
]);

function isCognate(front, back) {
  const nf = normalize(front);
  const nb = normalize(back);
  
  // Direct match
  if (nf === nb) return true;
  
  // Check transparent cognates list
  if (TRANSPARENT_COGNATES.has(nb) || TRANSPARENT_COGNATES.has(nf)) return true;
  
  // Very high string similarity (> 0.80) between single-word front and back
  const frontWords = nf.split(' ');
  const backWords = nb.split(' ');
  if (frontWords.length === 1 && backWords.length === 1 && similarity(nf, nb) > 0.80) {
    return true;
  }
  
  // Common cognate patterns: -tion → -zione, -ty → -tà, -ment → -mento, etc.
  const cognatePatterns = [
    [/tion$/, /zione$/],
    [/ty$/, /tà$/],
    [/ment$/, /mento$/],
    [/ous$/, /oso$/],
    [/ive$/, /ivo$/],
    [/ble$/, /bile$/],
    [/ance$/, /anza$/],
    [/ence$/, /enza$/],
    [/al$/, /ale$/],
    [/ist$/, /ista$/],
  ];
  
  if (frontWords.length === 1 && backWords.length === 1) {
    for (const [enPat, itPat] of cognatePatterns) {
      if (enPat.test(nf) && itPat.test(nb)) {
        const enRoot = nf.replace(enPat, '');
        const itRoot = nb.replace(itPat, '');
        if (similarity(enRoot, itRoot) > 0.70) return true;
      }
    }
  }
  
  return false;
}

// ─── basic vocab (B1 or below) ──────────────────────────────────────────────

const BASIC_VOCAB_PATTERNS = [
  // Body parts at beginner level
  /^(il |la |le |lo |l'|i |gli )?(braccio|braccia|spalla|gamba|gamme|mano|piede|testa|occhio|orecchio|naso|bocca|dente|denti|capello|capelli|dito|dita|ginocchio|collo|schiena|pancia|stomaco)$/i,
  // Very basic household
  /^(il |la |le |lo |l'|i |gli )?(cucchiaio|forchetta|coltello|piatto|bicchiere|sedia|tavolo|letto|porta|finestra|muro|pavimento|tetto|chiave|lampada)$/i,
  // Basic colors
  /^(rosso|blu|verde|giallo|nero|bianco|arancione|viola|rosa|marrone|grigio)$/i,
  // Basic greetings/phrases that are too elementary
  /^(ciao|buongiorno|buonasera|grazie|prego|scusa|per favore|arrivederci)$/i,
];

function isBasicVocab(back) {
  const nb = normalize(back);
  return BASIC_VOCAB_PATTERNS.some(p => p.test(nb));
}

// ─── grammar card detection ─────────────────────────────────────────────────

function isGrammarCard(front, back) {
  // Conjugation tables (passato remoto, etc.)
  if (/\(passato remoto\)/i.test(front)) return true;
  if (/·/.test(back) && (back.match(/·/g) || []).length >= 4) return true;
  
  // Preposition fill exercises
  if (/^(il |la |le |lo |l'|i |gli )?\w+\s+__\s*$/i.test(front)) return false; // cloze, not grammar
  
  // Tags
  const tags = (front + ' ' + back).toLowerCase();
  if (tags.includes('grammar')) return true;
  
  // Preposition-only answers
  const shortBack = normalize(back);
  if (['a', 'di', 'da', 'in', 'con', 'su', 'per', 'tra', 'fra',
       'al', 'del', 'dal', 'nel', 'sul', 'dello', 'dello', 'alla', 'della',
       'dalla', 'nella', 'sulla', 'ai', 'dei', 'dai', 'nei', 'sui',
       'agli', 'degli', 'dagli', 'negli', 'sugli', 'alle', 'delle',
       'dalle', 'nelle', 'sulle', 'sull\'', 'dall\''].includes(shortBack)) {
    return true;
  }
  
  return false;
}

// ─── "too easy" detection ───────────────────────────────────────────────────

function isTooEasy(card) {
  return card.ivl > 120 && card.lapses === 0 && card.ease >= 2650;
}

function isVeryEasy(card) {
  return card.ivl > 180 && card.lapses === 0 && card.ease >= 2800;
}

// ─── archaic detection ──────────────────────────────────────────────────────

function isArchaic(front, back) {
  const combined = (front + ' ' + back).toLowerCase();
  
  // Check explicit archaic words
  for (const word of ARCHAIC_WORDS) {
    if (combined.includes(word.toLowerCase())) return true;
  }
  
  // Check if the card itself contains archaic/literary register notes
  for (const pat of ARCHAIC_PATTERNS) {
    if (pat.test(combined)) return true;
  }
  
  return false;
}

// ─── spelling error detection ───────────────────────────────────────────────

function findSpellingError(front, back) {
  for (const [wrong, right] of Object.entries(KNOWN_SPELLING_ERRORS)) {
    if (back.includes(wrong) || front.includes(wrong)) {
      return { wrong, suggested: right };
    }
  }
  return null;
}

// ─── duplicate detection ────────────────────────────────────────────────────

function buildDuplicateMap(cards) {
  const backMap = {};
  for (const card of cards) {
    const nb = normalize(card.back);
    if (nb.length < 3) continue; // skip very short
    if (!backMap[nb]) backMap[nb] = [];
    backMap[nb].push(card.id);
  }
  return backMap;
}

// ─── synonym cluster detection ──────────────────────────────────────────────

function buildSynonymClusters(cards) {
  // Group by normalized English front (for EN→IT cards)
  const frontMap = {};
  for (const card of cards) {
    const nf = normalize(card.front);
    if (nf.length < 3) continue;
    // Only group single-concept fronts (not sentences)
    if (nf.includes('___') || nf.length > 60) continue;
    if (!frontMap[nf]) frontMap[nf] = [];
    frontMap[nf].push(card.id);
  }
  return frontMap;
}

// ═══════════════════════════════════════════════════════════════════════════
//  MAIN TRIAGE
// ═══════════════════════════════════════════════════════════════════════════

const report = [];
const duplicateMap = buildDuplicateMap(cards);
const synonymMap = buildSynonymClusters(cards);

for (const card of cards) {
  const flags = [];
  const notes = [];
  let suggestedAction = 'KEEP';
  
  // 1. Cognate check
  if (isCognate(card.front, card.back)) {
    flags.push('COGNATE');
    notes.push(`Transparent cognate: "${card.front}" ↔ "${card.back}"`);
  }
  
  // 2. Too easy check
  if (isVeryEasy(card)) {
    flags.push('VERY_EASY');
    notes.push(`Very easy: ivl=${card.ivl}, lapses=${card.lapses}, ease=${card.ease}`);
  } else if (isTooEasy(card)) {
    flags.push('TOO_EASY');
    notes.push(`Too easy: ivl=${card.ivl}, lapses=${card.lapses}, ease=${card.ease}`);
  }
  
  // 3. Spelling errors
  const spellingErr = findSpellingError(card.front, card.back);
  if (spellingErr) {
    flags.push('SPELLING_ERROR');
    notes.push(`Spelling: "${spellingErr.wrong}" → "${spellingErr.suggested}"`);
  }
  
  // 4. Archaic/literary
  if (isArchaic(card.front, card.back)) {
    flags.push('ARCHAIC');
    notes.push('Archaic or purely literary — unlikely in modern formal writing');
  }
  
  // 5. Basic vocab
  if (isBasicVocab(card.back)) {
    flags.push('BASIC_VOCAB');
    notes.push('Elementary vocabulary below B2 threshold');
  }
  
  // 6. Grammar card
  if (isGrammarCard(card.front, card.back)) {
    flags.push('GRAMMAR');
    notes.push('Grammar exercise card (conjugation/preposition)');
  }
  
  // 7. Duplicates
  const nb = normalize(card.back);
  if (duplicateMap[nb] && duplicateMap[nb].length > 1) {
    flags.push('DUPLICATE');
    const others = duplicateMap[nb].filter(id => id !== card.id);
    notes.push(`Same answer as ${others.length} other card(s)`);
  }
  
  // 8. Synonym cluster
  const nf = normalize(card.front);
  if (synonymMap[nf] && synonymMap[nf].length > 1 && !nf.includes('___') && nf.length <= 60) {
    flags.push('SYNONYM_CLUSTER');
    notes.push(`Shares English gloss with ${synonymMap[nf].length - 1} other card(s)`);
  }
  
  // 9. Never-reviewed cards (queue=0, ivl=0) — new cards, flag for review
  if (card.queue === 0 && card.ivl === 0 && card.reps === 0) {
    flags.push('NEVER_SEEN');
    notes.push('Card has never been reviewed');
  }
  
  // Determine suggested action
  if (flags.includes('COGNATE') && (flags.includes('TOO_EASY') || flags.includes('VERY_EASY'))) {
    suggestedAction = 'DELETE';
  } else if (flags.includes('ARCHAIC')) {
    suggestedAction = 'DELETE';
  } else if (flags.includes('COGNATE')) {
    suggestedAction = 'DELETE';
  } else if (flags.includes('BASIC_VOCAB') && flags.includes('TOO_EASY')) {
    suggestedAction = 'DELETE';
  } else if (flags.includes('VERY_EASY') && !flags.includes('GRAMMAR')) {
    suggestedAction = 'REVIEW';
  } else if (flags.includes('SPELLING_ERROR')) {
    suggestedAction = 'FIX';
  } else if (flags.includes('DUPLICATE')) {
    suggestedAction = 'REVIEW';
  } else if (flags.length === 0) {
    suggestedAction = 'KEEP';
  } else {
    suggestedAction = 'REVIEW';
  }
  
  report.push({
    id: card.id,
    front: card.front,
    back: card.back,
    tags: card.tags,
    queue: card.queue,
    ivl: card.ivl,
    ease: card.ease,
    reps: card.reps,
    lapses: card.lapses,
    flags,
    notes,
    suggestedAction,
  });
}

// ─── summary stats ──────────────────────────────────────────────────────────

const summary = {
  totalCards: report.length,
  flagged: report.filter(r => r.flags.length > 0).length,
  unflagged: report.filter(r => r.flags.length === 0).length,
  byAction: {
    DELETE: report.filter(r => r.suggestedAction === 'DELETE').length,
    FIX: report.filter(r => r.suggestedAction === 'FIX').length,
    REVIEW: report.filter(r => r.suggestedAction === 'REVIEW').length,
    KEEP: report.filter(r => r.suggestedAction === 'KEEP').length,
  },
  byFlag: {},
};

const allFlags = ['COGNATE', 'TOO_EASY', 'VERY_EASY', 'SPELLING_ERROR', 'ARCHAIC',
                  'BASIC_VOCAB', 'GRAMMAR', 'DUPLICATE', 'SYNONYM_CLUSTER', 'NEVER_SEEN'];
for (const f of allFlags) {
  summary.byFlag[f] = report.filter(r => r.flags.includes(f)).length;
}

const output = { summary, cards: report };
fs.writeFileSync(path.join(__dirname, 'audit-report.json'), JSON.stringify(output, null, 2));

console.log('\n═══ FLASHCARD AUDIT REPORT ═══');
console.log(`Total cards: ${summary.totalCards}`);
console.log(`Flagged: ${summary.flagged} | Clean: ${summary.unflagged}`);
console.log('\nBy suggested action:');
for (const [action, count] of Object.entries(summary.byAction)) {
  console.log(`  ${action}: ${count}`);
}
console.log('\nBy flag:');
for (const [flag, count] of Object.entries(summary.byFlag)) {
  if (count > 0) console.log(`  ${flag}: ${count}`);
}
console.log(`\nReport written to audit-report.json`);