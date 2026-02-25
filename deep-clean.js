#!/usr/bin/env node
/**
 * Flashcard Deep Clean — Autonomous full-deck overhaul
 * 
 * 1. Deletes cognates, archaic, and trivially easy cards
 * 2. Removes true duplicates (same word, same card type)
 * 3. Rewrites synonym definitions to differentiate nuance
 * 4. Fixes known spelling errors
 */

const fs = require('fs');
const path = require('path');

const cardsPath = path.join(__dirname, 'anki_cards.json');
const backupPath = path.join(__dirname, 'anki_cards.pre-deepclean.json');

let cards = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));
const originalCount = cards.length;
let deletedCount = 0;
let rewrittenCount = 0;
let fixedSpelling = 0;
let deduplicatedCount = 0;

function norm(s) { return (s||'').toLowerCase().replace(/[^a-zà-ÿ0-9\s]/g,'').replace(/\s+/g,' ').trim(); }

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 1: DELETE cognates, archaic, basic vocab
// ═══════════════════════════════════════════════════════════════════════════

const DELETE_BACKS = new Set([
  // Transparent cognates
  'avocado', 'trilogia', 'apartheid', 'realistico', 'cilindrico',
  'fluttuazione', 'professionista', 'professionale',
  // Keep these as they require knowing Italian gender/form
].map(norm));

// Cards to delete by checking front+back similarity or archaic content
const ARCHAIC_WORDS = [
  'sollazzo', 'rena', 'guiderdone', 'mercede', 'letizia',
  'alatissimo', 'tumulozzo', 'melmosetti',
];

// Direct cognate pairs to delete (front→back nearly identical)
function shouldDeleteAsCognate(front, back) {
  const nf = norm(front), nb = norm(back);
  if (nf === nb) return true;
  // Single-word pairs with >80% similarity
  if (!nf.includes(' ') && !nb.includes(' ')) {
    const maxLen = Math.max(nf.length, nb.length);
    if (maxLen === 0) return false;
    let dist = 0;
    const a = nf, b = nb;
    const m = a.length, n = b.length;
    const d = Array.from({length:m+1},(_,i)=>[i]);
    for(let j=1;j<=n;j++) d[0][j]=j;
    for(let i=1;i<=m;i++) for(let j=1;j<=n;j++)
      d[i][j]=a[i-1]===b[j-1]?d[i-1][j-1]:1+Math.min(d[i-1][j],d[i][j-1],d[i-1][j-1]);
    dist = d[m][n];
    if (1 - dist/maxLen > 0.80) return true;
  }
  return false;
}

function shouldDeleteAsArchaic(front, back) {
  const combined = (front + ' ' + back).toLowerCase();
  for (const w of ARCHAIC_WORDS) {
    if (combined.includes(w)) return true;
  }
  // Check for explicit archaic/literary register markers that indicate non-modern usage
  if (/\(letterario\)/i.test(combined) && !/equivalente/i.test(combined)) return true;
  if (/\(poetico\)/i.test(combined) && !/equivalente/i.test(combined)) return true;
  if (/\(biblical\)/i.test(combined)) return true;
  if (/\(arcaico\)/i.test(combined)) return true;
  return false;
}

// Phase 1 execution
const phase1Ids = new Set();
for (const c of cards) {
  if (shouldDeleteAsCognate(c.front, c.back)) phase1Ids.add(c.id);
  if (shouldDeleteAsArchaic(c.front, c.back)) phase1Ids.add(c.id);
}
const prePhase1 = cards.length;
cards = cards.filter(c => !phase1Ids.has(c.id));
deletedCount += prePhase1 - cards.length;
console.log(`Phase 1: Deleted ${prePhase1 - cards.length} cognate/archaic cards`);

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 2: FIX SPELLING ERRORS
// ═══════════════════════════════════════════════════════════════════════════

const SPELLING_FIXES = [
  ['Buzurro', 'Buzzurro'],
  ['Traditto', 'Tradito'],
  ['Perceptio', 'Percepito'],
  ['Misognistico', 'Misogino'],
  ['segurie la prassi', 'seguire la prassi'],
  ['Dice le cose some stanno', 'Dice le cose come stanno'],
  ['Distraire', 'Distrarre'],
  ["l'ignegno più acuto", "l'ingegno più acuto"],
  ['Inguino', 'Inguine'],
  ['la Miccia accessa', 'la miccia accesa'],
  ['Le spoglie umani', 'Le spoglie umane'],
  ['Kanguro', 'Canguro'],
  ['faggiano', 'fagiano'],
  ['Alfabetizzazione letteraria', 'Alfabetizzazione mediatica'],
];

for (const c of cards) {
  for (const [wrong, right] of SPELLING_FIXES) {
    if (c.front.includes(wrong)) { c.front = c.front.replace(wrong, right); fixedSpelling++; }
    if (c.back.includes(wrong)) { c.back = c.back.replace(wrong, right); fixedSpelling++; }
  }
}
console.log(`Phase 2: Fixed ${fixedSpelling} spelling errors`);

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 3: DEDUPLICATE
// ═══════════════════════════════════════════════════════════════════════════
// True duplicates = same normalized back AND same type (both definition or both cloze)
// Keep definition+cloze pairs (two testing modes = good)
// Delete when you have 2+ definition cards or 2+ cloze cards for the same word

function isCloze(front) { return front.includes('___') || front.includes('____'); }

const backGroups = {};
for (const c of cards) {
  const nb = norm(c.back);
  if (nb.length < 3) continue;
  const type = isCloze(c.front) ? 'cloze' : 'def';
  const key = `${nb}|${type}`;
  if (!backGroups[key]) backGroups[key] = [];
  backGroups[key].push(c);
}

const dedupIds = new Set();
for (const [key, group] of Object.entries(backGroups)) {
  if (group.length <= 1) continue;
  // Keep the card with the most reviews (most established in the SM-2 schedule)
  group.sort((a, b) => b.reps - a.reps);
  for (let i = 1; i < group.length; i++) {
    dedupIds.add(group[i].id);
  }
}

const preDedup = cards.length;
cards = cards.filter(c => !dedupIds.has(c.id));
deduplicatedCount = preDedup - cards.length;
console.log(`Phase 3: Removed ${deduplicatedCount} true duplicates`);

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 4: SYNONYM DIFFERENTIATION
// ═══════════════════════════════════════════════════════════════════════════
// For each synonym cluster, rewrite the English definition on definition cards
// to differentiate nuance. Cloze cards are left as-is if their sentence
// already provides disambiguating context.

// Map: normalized Italian word → improved English definition
const SYNONYM_DEFS = {
  // ── Annoyed / Irritated ──
  'seccato': 'Annoyed (dry, mild irritation — like being bothered by a minor inconvenience; "seccato dalla pioggia")',
  'scocciato': 'Annoyed (nagged, pestered — someone or something won\'t leave you alone; "scocciato dalle domande")',
  'irritato': 'Irritated (sharper, more visible — your patience is visibly wearing thin; "irritato dal ritardo")',
  'innervosito': 'Agitated, on edge (nervousness-driven irritation, fidgety frustration; "innervosito dal rumore")',
  'indisponente': 'Off-putting, aggravating (describes the thing/person causing annoyance, not the person feeling it)',
  'stizzito': 'Peeved, snappish (sudden sharp flash of annoyance, often shown in tone; from "stizzire")',
  'fastidioso': 'Annoying (adj. for the source, not the person — "quel rumore è fastidioso")',
  'infastidito': 'Bothered (general, neutral — mildly to moderately annoyed; less specific than seccato/scocciato)',

  // ── Angry ──
  'furioso': 'Furious (intense, explosive anger — may or may not act on it)',
  'imbestialito': 'Livid, enraged (informal — anger so strong it\'s dehumanizing; also literally "reduced to a beast")',
  'incazzato': 'Pissed off (vulgar — very common in spoken Italian for strong anger)',

  // ── Shrewd / Cunning ──
  'furbo': 'Cunning, street-smart (neutral-positive — knows how to get what they want; everyday cleverness)',
  'astuto': 'Shrewd, crafty (strategic intelligence — thinks several steps ahead; "un astuto stratagemma")',
  'scaltro': 'Quick-witted, pragmatically shrewd (speed of reaction + practical cunning; always finds a way out)',
  'perspicace': 'Perceptive, sharp (analytical — notices what others miss; intellectual acuity)',
  'ingegnoso': 'Ingenious (inventive in problem-solving — finds creative solutions)',
  'subdolo': 'Sneaky, underhanded (negative — acts with hidden malice behind apparent innocence)',

  // ── Rude / Ill-mannered ──
  'sgarbato': 'Rude, impolite (lacking garbo/grace — poor manners, brusque; opposite of garbato)',
  'buzzurro': 'Boorish, uncouth (crude, culturally unrefined — stronger than sgarbato)',
  'brusco': 'Abrupt, curt (rough in manner — not necessarily mean, just blunt and sharp)',
  'sfacciato': 'Brazen, cheeky (impudent — pushes boundaries shamelessly; "ha saltato la fila")',
  'maleducato': 'Ill-mannered (badly raised — broader than sgarbato; implies upbringing failure)',

  // ── Thin / Slim ──
  'slanciato': 'Slim, tall and elegant (positive — graceful proportions; "il suo nuovo ragazzo è slanciato")',
  'snello': 'Slender, streamlined (positive — light and efficient; also used for processes)',
  'esile': 'Slight, delicate (fragile thinness — implies vulnerability; "un fisico esile")',
  'gracile': 'Frail, weak (thinness from poor health or constitution — negative; "era gracile da bambino")',
  'smunto': 'Gaunt, drawn (visible deprivation — sunken features from hunger/illness/exhaustion)',
  'emaciato': 'Emaciated (extreme thinness from starvation or severe illness — medical/literary)',
  'scarno': 'Bony, gaunt (very thin with visible bones — also figurative: "uno stile scarno" = bare/stripped)',
  'minuto': 'Tiny, petite (small in frame — neutral, often for women; "una donna minuta")',
  'longilineo': 'Lanky, long-limbed (formal — tall with elongated proportions; medical/descriptive)',
  'allampanato': 'Gangly, lanky (tall and awkwardly thin — slightly comic connotation)',

  // ── Fat / Heavy ──
  'paffuto': 'Chubby (endearing — round cheeks, often for children; "il paffuto bambino")',
  'grassoccio': 'Plump (neutral-affectionate — a bit overweight but not negatively; synonym of paffuto)',
  'tarchiato': 'Stocky, burly (short and solidly built — suggests strength, not fat)',
  'tracagnotto': 'Squat, dumpy (short and thickset — potentially offensive; pejorative)',
  'tozzo': 'Squat, stumpy (short and compact — describes shape more than weight)',
  'massiccio': 'Massive, solid (large and dense — suggests physical imposingness or material density)',
  'pasciuto': 'Well-fed, plump (literary — implies prosperity/good nourishment; "maiali pasciuti")',
  'pacioccone': 'Jolly/easygoing plump person (affectionate — personality + body type combined)',
  'ciccione': 'Fatso (offensive — pejorative term for someone very overweight)',

  // ── Tired / Exhausted ──
  'fiacco': 'Limp, worn out (low energy, sluggish — can be temporary or temperamental)',
  'sfibrato': 'Drained, spent (fiber-by-fiber exhaustion — utterly depleted; "sfibrato dal lavoro")',
  'cagionevole': 'Sickly, delicate (chronic poor health — constitutionally fragile)',
  'rammollito': 'Gone soft (figurative — lost vigor or backbone; somewhat pejorative)',
  'distrutto': 'Destroyed, wiped out (informal — extreme exhaustion; "sono distrutto dal lavoro")',
  'stravolto': 'Haggard, wrecked (visibly altered by exhaustion — face/expression distorted)',
  'affaticato': 'Fatigued (neutral, slightly formal — tired from sustained effort)',
  'estenuante': 'Exhausting (adj. for the activity, not the person — "un viaggio estenuante")',

  // ── Sad / Melancholy ──
  'malinconico': 'Melancholic (quiet, lingering sadness — often with an aesthetic quality)',
  'mesto': 'Subdued, mournfully quiet (literary — dignified, restrained sadness)',
  'cupo': 'Dark, gloomy (metaphorical darkness — oppressive, heavy atmosphere or mood)',

  // ── Scared / Worried ──
  'spaventato': 'Frightened (acute fear — reaction to a specific threat or shock)',
  'inquieto': 'Restless, uneasy (low-grade anxiety — agitated, can\'t settle; not necessarily about one thing)',
  'spaventoso': 'Scary, frightening (adj. for the thing causing fear, not the person feeling it)',
  'ombroso': 'Skittish, suspicious (easily startled or distrustful — originally for horses)',

  // ── Stubborn / Determined ──
  'determinato': 'Determined, resolute (positive — clear goal, strong will; "una donna determinata")',
  'tenace': 'Tenacious, tough (refuses to give up — persistence through adversity)',
  'tosto': 'Tough, hard-nosed (informal — resilient and no-nonsense; "un personaggio tosto")',
  'accanito': 'Relentless, dogged (won\'t let go — can be positive or obsessive; "un accanito sostenitore")',
  'ostinato': 'Stubborn, pig-headed (negative — persists despite reason; from "ostinarsi")',

  // ── Lies / Deception ──
  'bugia': 'Lie (standard, neutral — any deliberate untruth)',
  'panzana': 'Tall tale, whopper (an obviously exaggerated or ridiculous lie)',
  'fuffa': 'Fluff, nonsense (not serious content — empty, substanceless; "questa è solo fuffa")',
  'truffa': 'Fraud, scam (criminal deception for financial gain — formal/legal)',
  'fregatura': 'Rip-off, bad deal (informal — you got cheated; "che fregatura!")',
  'inganno': 'Deception, trick (broader — any act of deceiving; slightly literary)',
  'calunnia': 'Slander (false accusation made to damage reputation — legal/formal)',

  // ── Nuisance / Annoyance (nouns) ──
  'seccatura': 'Nuisance, hassle (a persistent minor annoyance — "le tasse sono una seccatura")',
  'fastidio': 'Bother, irritation (general discomfort or annoyance — "mi dà fastidio")',

  // ── Beautiful / Attractive ──
  'grazioso': 'Pretty, charming (pleasant, delicate beauty — "che bambino grazioso")',
  'aggraziato': 'Graceful (elegant in movement — controlled, fluid; "una ballerina aggraziata")',
  'appariscente': 'Eye-catching, flashy (stands out visually — not necessarily tasteful)',
  'strabiliante': 'Astonishing, amazing (beauty or quality that leaves you stunned)',
  'formoso': 'Shapely, curvaceous (of a woman\'s figure — positive, slightly old-fashioned)',
  'slanciato': 'Slim and elegant (see Thin cluster — positive proportions)',

  // ── Dark / Gloomy ──
  'cupo': 'Dark, gloomy (heavy, oppressive — metaphorical; "un\'atmosfera cupa")',
  'fosco': 'Hazy, murky (weather: slightly foggy; figurative: threatening, resentful; "uno sguardo fosco")',
  'tetro': 'Grim, sinister (dark in a frightening way — suggests menace)',

  // ── Disgusting ──
  'lurido': 'Filthy, disgusting (physically dirty or morally repugnant — strong; "questa casa è lurida")',
  'losco': 'Shady, sketchy (of a person — morally suspect; "un tipo losco")',
  'schifoso': 'Gross, revolting (strong disgust — "che schifo!" is the exclamation)',

  // ── Weak / Soft ──
  'mollo': 'Soft, limp (physically lacking firmness — "il materasso era troppo mollo")',
  'moscio': 'Limp, lackluster (lacking energy or vigor — colloquial; "un discorso moscio")',
  'docile': 'Docile, compliant (not aggressive — gentle temperament; from Latin docilis)',
  'mite': 'Mild, gentle-natured (temperamental softness — not weakness; "un uomo mite")',

  // ── Smart / Clever ──
  'perspicace': 'Perceptive, shrewd (sees through things — analytical sharpness)',
  'astuto': 'Shrewd, cunning (strategic — plans ahead with cleverness)',
  'scaltro': 'Quick-witted (pragmatic — reacts fast and effectively)',
  'ingegnoso': 'Ingenious (creative problem-solver — inventive approach)',
  'dotto': 'Erudite, learned (bookish — deep knowledge; slightly old-fashioned)',
  'navigato': 'Seasoned, experienced (knows the ropes — practical wisdom from long experience)',

  // ── Single / Unmarried ──
  'nubile': 'Single/unmarried woman (formal-bureaucratic — anagrafico only; in conversation say "single")',
  'celibe': 'Single/unmarried man (formal-bureaucratic — anagrafico only; in conversation say "single" or "non sposato")',
  'scapolo': 'Bachelor (conversational — unmarried man, more natural than "celibe")',

  // ── Wealthy / Distinguished ──
  'abbiente': 'Well-off, affluent (neutral — has financial means; "una famiglia abbiente")',
  'raffinato': 'Refined, sophisticated (elegant taste in culture, food, style)',
  'distinto': 'Distinguished, well-bred (polished appearance and bearing; "un signore distinto")',
  'signorile': 'Elegant, upper-class (noble bearing or style — "un palazzo signorile")',
  'sfarzoso': 'Ostentatious, showy (excessively lavish — pejorative; implies showing off wealth)',

  // ── Poor / Lowly ──
  'meschino': 'Petty, mean-spirited (morally small; also: meager — "guadagna una cifra meschina")',
  'pezzente': 'Beggar, wretch (pejorative — extremely poor; used as insult)',
  'gretto': 'Small-minded, petty (stingy in thought and action — "un atteggiamento gretto")',
  'taccagno': 'Miserly, stingy (won\'t spend money — "è un taccagno incredibile")',

  // ── Arrogant / Proud ──
  'altezzoso': 'Haughty (looks down on others — cold superiority; "Giovanni è altezzoso")',
  'arrogante': 'Arrogant (overbearing self-importance — more aggressive than altezzoso)',
  'benpensante': 'Self-righteous conformist (smugly conventional — thinks they\'re morally superior)',
  'straffottente': 'Overbearing, couldn\'t-care-less (vulgar — aggressively indifferent to others)',

  // ── Upset / Emotional ──
  'rimanerci male': 'To be upset/hurt (emotional disappointment — "ci è rimasto male quando ha scoperto")',
  'sconvolto': 'Deeply shaken, devastated (strong emotional upheaval — "sconvolto dalla notizia")',
  'sopraffatto': 'Overwhelmed (emotionally overloaded — "sopraffatto dal dolore")',
  'a pezzi': 'In pieces, shattered (physically or emotionally wrecked — "siamo a pezzi")',

  // ── Tools: Physical vs Abstract ──
  'attrezzo': 'Tool (physical implement — wrench, hammer; "tengo gli attrezzi in officina")',
  'strumento': 'Tool/instrument (method or means — also musical; "strumenti di gestione")',

  // ── Shelf types ──
  'scaffale': 'Shelving unit, bookcase (freestanding furniture with multiple shelves)',
  'mensola': 'Shelf bracket (single decorative shelf mounted on a wall — smaller, often ornamental)',

  // ── Sign types ──
  'cartello': 'Sign, placard (for a business, on a door — "il cartello diceva: chiuso")',
  'segnale': 'Signal, traffic sign (road/safety — "il segnale indicava di fermarsi")',

  // ── Injury types ──
  'lesione': 'Lesion, injury (medical — no blood necessarily; tissue damage; "una lesione al legamento")',
  'ferita': 'Wound (with blood — open cut or gash; "la ferita sanguinava")',
  'livido': 'Bruise (subcutaneous — from impact; discoloration)',

  // ── Shelter / Cover ──
  'riparo': 'Shelter, cover (protection from elements — "cercare riparo dalla pioggia")',
  'tettoia': 'Awning, canopy (built structure providing overhead cover)',

  // ── Edge / Brink ──
  'orlo': 'Edge, rim (threshold — metaphorical; "sull\'orlo del baratro")',
  'ciglio': 'Verge, roadside edge (literal edge of road/cliff; also: eyelash; "sul ciglio della strada")',
  'baratro': 'Abyss, precipice (deep drop — literal or metaphorical; "sull\'orlo del baratro")',

  // ── Gatherings ──
  'assembramento': 'Crowd, gathering (neutral — people collected in one place; "un grande assembramento")',
  'capannello': 'Small huddle/group (a knot of people — informal, small; "un capannello di curiosi")',
  'ressa': 'Crush, throng (pressing crowd — often at entrances; "c\'era una gran ressa")',
  'combriccola': 'Gang, clique (group of friends or suspects — slightly suspicious; "la solita combriccola")',

  // ── Frighten / Scare ──
  'spaventare': 'To scare, frighten (general — cause acute fear)',
  'intimorire': 'To intimidate (inspire fear through authority/power — more deliberate)',
  'stordire': 'To stun, daze (temporarily disorient — physical or mental; "stordito dal colpo")',

  // ── Tremble / Shake ──
  'fremere': 'To tremble with emotion (excitement, rage, anticipation — internal shaking; "fremeva di rabbia")',
  'tremare': 'To tremble, shake (physical — from cold, fear, or weakness)',

  // ── Shine / Glow ──
  'luccicare': 'To sparkle, glisten (many small reflections — "l\'oro luccica")',
  'brillare': 'To shine, glow (steady bright light — also figurative: "brillare negli studi")',
  'splendere': 'To shine brightly (strong, radiant — sun, stars; "la luna splende")',
  'rifulgere': 'To shine forth (literary — intense radiance; elevated register)',
  'baluginare': 'To glimmer faintly (flickering, intermittent — barely visible light)',

  // ── Horrifying ──
  'orripilante': 'Horrifying (visceral revulsion — makes your skin crawl)',
  'raccapricciante': 'Horrifying (shudder-inducing — deeply disturbing; stronger than orripilante)',
  'spaventoso': 'Scary, frightening (adj. — causes fear; less visceral than orripilante)',
  'straziante': 'Agonizing, harrowing (physical or emotional pain — "uno spettacolo straziante")',

  // ── Stubborn refusal ──
  'controvoglia': 'Unwillingly (doing something against your wishes — "lo faceva controvoglia")',
  'ostinarsi': 'To persist stubbornly (negative — against reason; "si ostina a corteggiare Sara")',

  // ── Fickle / Changeable ──
  'volubile': 'Fickle (easily changes mood or opinion — unreliable in consistency)',
  'lunatico': 'Moody (frequent sudden mood swings — "un momento ride, quello dopo è di pessimo umore")',
  'capriccioso': 'Capricious (driven by whims — unpredictable; also for spoiled children)',

  // ── Pain / Regret ──
  'rammarico': 'Regret, remorse (for something done or not done — reflective; "senza rammarichi")',
  'rimpianto': 'Regret, longing (nostalgia for what was lost or never happened — deeper than rammarico)',
  'magone': 'Lump in the throat (intense sadness that tightens the throat — colloquial; "mi è venuto un magone")',
};

// Phase 4 execution: apply rewrites to definition cards
for (const c of cards) {
  if (isCloze(c.front)) continue; // skip cloze cards
  
  const nb = norm(c.back);
  // Try exact match first
  if (SYNONYM_DEFS[nb]) {
    c.front = SYNONYM_DEFS[nb];
    rewrittenCount++;
    continue;
  }
  
  // Try matching the first word of the back (for "La custodia", "Il livido", etc.)
  const backWords = nb.split(' ');
  const withoutArticle = backWords.filter(w => !['il','la','le','lo','l','i','gli','un','una','uno'].includes(w)).join(' ');
  if (SYNONYM_DEFS[withoutArticle]) {
    c.front = SYNONYM_DEFS[withoutArticle];
    rewrittenCount++;
    continue;
  }
  
  // Try matching just the last significant word
  if (backWords.length > 1) {
    const lastWord = backWords[backWords.length - 1];
    if (SYNONYM_DEFS[lastWord] && lastWord.length > 4) {
      c.front = SYNONYM_DEFS[lastWord];
      rewrittenCount++;
    }
  }
}
console.log(`Phase 4: Rewrote ${rewrittenCount} synonym definitions`);

// ═══════════════════════════════════════════════════════════════════════════
// SAVE
// ═══════════════════════════════════════════════════════════════════════════

// Backup original
const origCards = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));
fs.writeFileSync(backupPath, JSON.stringify(origCards, null, 2));

// Write cleaned deck
fs.writeFileSync(cardsPath, JSON.stringify(cards, null, 2));

console.log(`\n═══ DEEP CLEAN COMPLETE ═══`);
console.log(`Original: ${originalCount} cards`);
console.log(`Deleted (cognate/archaic): ${deletedCount}`);
console.log(`Spelling fixes: ${fixedSpelling}`);
console.log(`Deduplicated: ${deduplicatedCount}`);
console.log(`Synonym rewrites: ${rewrittenCount}`);
console.log(`Final deck: ${cards.length} cards`);
console.log(`Backup saved to: anki_cards.pre-deepclean.json`);
