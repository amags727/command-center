#!/usr/bin/env node
/**
 * Phase 1: Mechanical cleanup of anki_cards.json
 * - Remove duplicates (keep best scheduling: highest ivl)
 * - Remove transparent cognates (minus user-approved keeps)
 * - Remove below-B2 basics (minus user-approved keeps)
 * - Fix spelling errors
 * - Update archaic/literary glosses
 * - Tag grammar cards
 */

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'anki_cards.json');
const cards = JSON.parse(fs.readFileSync(FILE, 'utf8'));

let removedCount = 0;
let fixedCount = 0;
let glossUpdated = 0;
let tagged = 0;

// ── DUPLICATE GROUPS: remove all but best (highest ivl) ──
const dupGroups = [
  // Economics set imported 2-3x
  ['anki_1714491880557','anki_1714491880595','anki_1714491880609'],
  ['anki_1714491880558','anki_1714491880596','anki_1714491880610'],
  ['anki_1714491880566','anki_1714491880597','anki_1714491880611'],
  ['anki_1714491880571','anki_1714491880599','anki_1714491880613'],
  ['anki_1714491880572','anki_1714491880600','anki_1714491880614'],
  ['anki_1714491880573','anki_1714491880601','anki_1714491880615'],
  ['anki_1714491880577','anki_1714491880602','anki_1714491880616'],
  ['anki_1714491880582','anki_1714491880603','anki_1714491880617'],
  ['anki_1714491880583','anki_1714491880604','anki_1714491880618'],
  ['anki_1714491880590','anki_1714491880605','anki_1714491880619'],
  ['anki_1714491880591','anki_1714491880606','anki_1714491880620'],
  ['anki_1714491880593','anki_1714491880607','anki_1714491880621'],
  ['anki_1714491880555','anki_1714491880594','anki_1714491880608'],
  ['anki_1714491880567','anki_1714491880598','anki_1714491880612'],
  // Other dups
  ['anki_1715594430368','anki_1715899440384'],
  ['anki_1732554586968','anki_1732567567109'],
  ['anki_1713551161720','anki_1713551161721'], // pieno di
  ['anki_1732567567116','anki_1732568047871'], // andare in orbita
  ['anki_1732567567117','anki_1732568047872'], // galleria
  ['anki_1715019388977','anki_1716519189518'], // mollo/molle
  ['anki_1716519105712','anki_1727747676695'], // cavarsela
  ['anki_1717855277929','anki_1717855292499'], // scocciato
  ['anki_1732151001396','anki_1732193657909','anki_1732193674077','anki_1732193699376'], // massiccio
];

const idsToRemoveFromDups = new Set();
const cardMap = new Map();
cards.forEach(c => cardMap.set(c.id, c));

for (const group of dupGroups) {
  const groupCards = group.map(id => cardMap.get(id)).filter(Boolean);
  if (groupCards.length <= 1) continue;
  // Keep the one with highest interval
  groupCards.sort((a, b) => b.ivl - a.ivl);
  for (let i = 1; i < groupCards.length; i++) {
    idsToRemoveFromDups.add(groupCards[i].id);
  }
}

// ── COGNATES TO REMOVE (minus user keeps) ──
const cognateRemoveIds = new Set([
  'anki_1713551161710', // Reale
  'anki_1713551161716', // Elasticità
  // anki_1713551161714 Effettivo — KEEP (user decision)
  'anki_1713551161730', // Incompleto
  // anki_1713551161733 Sviluppare — borderline, keep
  'anki_1713551161740', // Nostalgia
  'anki_1713551161724', // Non convenzionale
  'anki_1713551161737', // Inabitabile
  'anki_1713551161739', // Disorientante
  'anki_1714491880570', // Islanda
  'anki_1714491880585', // Annualmente
  'anki_1714491880589', // Coefficiente
  'anki_1714491880592', // Territorio
  'anki_1713551161723', // Coorte
  'anki_1713266082856', // Scalabilità
  'anki_1713266082864', // Barriera
  'anki_1713266082878', // Petizione
  'anki_1713266082874', // Percorso
  'anki_1713266082872', // Motore
  'anki_1713266082876', // Stabilimento
  'anki_1713551161735', // Ambiente
  'anki_1713551161757', // Miglioramento
  'anki_1713551161713', // Confrontare
  'anki_1714491880574', // Remoto
  'anki_1731074736036', // Batterio
  'anki_1731074736035', // Pediatra
  'anki_1731074736021', // Termometro
  'anki_1726932467096', // Fluttuazione -- note: user didn't explicitly keep
  'anki_1746972018885', // Deprimente
  // anki_1770642835928 Manipolatore — KEEP (user decision)
  // anki_1732151001446 Professionale — KEEP
  // anki_1732151001447 Professionista — KEEP
  // anki_1713551161751 Codice fiscale — KEEP
  'anki_1713551161736', // Contesto
]);

// ── BELOW-B2 BASICS TO REMOVE (minus user keeps) ──
const basicRemoveIds = new Set([
  // anki_1713551161710 already in cognates
  'anki_1714491880564', // L'azienda
  'anki_1714491880565', // Il negozio
  'anki_1713266082848', // Vapore
  'anki_1713266082822', // Letteratura
  'anki_1713266082752', // Sporco
  'anki_1713551161749', // Campo
  'anki_1713551161748', // Splendere
  'anki_1715164771221', // Metà
  'anki_1725626324738', // Mille
  'anki_1725626349509', // Duemila
  'anki_1727091041137', // La carne
  'anki_1731074736011', // Butta la pasta
  'anki_1731074736026', // Ho la febbre
  'anki_1731074736037', // Ho il ciclo
  'anki_1732567567119', // ci sono dei cani
  'anki_1732567567120', // la loro madre
  'anki_1732567567121', // il suo fratellino
  'anki_1732151001439', // Tre del mattino
  // anki_1770642703896 ha saltato — KEEP (user decision)
  // anki_1770691993042 sole — KEEP (user decision)
]);

// Combine all removal IDs
const allRemoveIds = new Set([...idsToRemoveFromDups, ...cognateRemoveIds, ...basicRemoveIds]);

// ── SPELLING FIXES ──
const spellingFixes = {
  'anki_1713266082834': { field: 'back', old: 'Buzurro', new: 'Buzzurro' },
  'anki_1713266082835': { field: 'front', find: 'Buzurro', replace: 'Buzzurro' }, // cloze uses it too
  'anki_1713445469407': { field: 'back', old: 'Altezzo', new: 'Altezza' },
  'anki_1713445469408': { field: 'back', old: 'Altezzo', new: 'Altezza' },
  'anki_1713266082784': { field: 'back', old: 'Accastarsi', new: 'Accatastarsi' },
  'anki_1713266082785': { field: 'back', old: 'Accastare', new: 'Accatastare' },
  'anki_1717190186947': { field: 'back', old: 'no sa parlare italian', new: 'non sa parlare italiano' },
  'anki_1747100445854': { field: 'back', old: 'fiocho', new: 'fioco' },
  'anki_1747100457331': { field: 'back', old: 'fiocha', new: 'fioca' },
  'anki_1746972035685': { field: 'back', old: 'il callante', new: 'il refrigerante' },
};

// ── ARCHAIC/LITERARY GLOSS UPDATES ──
const glossUpdates = {
  'anki_1715557756332': { // celibe
    back: 'celibe — (formale/anagrafico) single man; in conversazione si dice "single" o "non sposato"'
  },
  'anki_1769379833486': { // sollazzo
    back: 'sollazzo — (letterario) divertimento, svago; equivalente moderno: svago, divertimento'
  },
  'anki_1713813318972': { // giacché
    back: 'giacché — (formale/scritto) since, as; equivalente colloquiale: siccome, dato che'
  },
  'anki_1732656149935': { // Rena
    back: 'Rena — (poetico) sand; equivalente standard: sabbia'
  },
  'anki_1736278186379': { // marmoreo
    back: 'marmoreo — (letterario) of marble; la forma standard è "di marmo"'
  },
  'anki_1727751224983': { // Libare
    back: 'Libare — (letterario/poetico) to sip; in conversazione: sorseggiare'
  },
  'anki_1736278186386': { // letizia
    back: 'letizia — (letterario/formale) joy, serene happiness; in conversazione: gioia, felicità'
  },
};

// ── GRAMMAR CARD IDS TO TAG ──
const grammarTagIds = new Set([
  'anki_1732567567131','anki_1732567567132','anki_1732567567133',
  'anki_1732567567134','anki_1732567567135','anki_1732567567137',
  'anki_1732567567140','anki_1732567567141','anki_1732567567143',
  'anki_1732567567144','anki_1732567567146','anki_1732567567147',
  'anki_1732567567148',
  // passato remoto tables
  'anki_1769565660217','anki_1769565660218','anki_1769565660219',
  'anki_1769565660220','anki_1769565660221','anki_1769565660222',
  'anki_1769565660223','anki_1769565660224','anki_1769565660225',
  'anki_1769565660226','anki_1769565660227','anki_1769565660228',
  'anki_1769565660229','anki_1769565660230','anki_1769565660231',
  'anki_1769565660232','anki_1769565660233','anki_1769565660234',
  'anki_1769565660235','anki_1769565660236','anki_1769565660237',
  'anki_1769565660238','anki_1769565660239','anki_1769565660240',
  'anki_1769565660241','anki_1769565660242',
]);

// ── APPLY CHANGES ──
const result = [];

for (const card of cards) {
  // Skip removed cards
  if (allRemoveIds.has(card.id)) {
    removedCount++;
    continue;
  }

  // Spelling fixes
  if (spellingFixes[card.id]) {
    const fix = spellingFixes[card.id];
    if (fix.field === 'back' && card.back === fix.old) {
      card.back = fix.new;
      fixedCount++;
    } else if (fix.field === 'back' && card.back.includes(fix.old)) {
      card.back = card.back.replace(fix.old, fix.new);
      fixedCount++;
    } else if (fix.field === 'front' && fix.find && card.front.includes(fix.find)) {
      card.front = card.front.replace(fix.find, fix.replace);
      fixedCount++;
    }
  }

  // Archaic/literary gloss updates
  if (glossUpdates[card.id]) {
    const update = glossUpdates[card.id];
    if (update.back) {
      card.back = update.back;
      glossUpdated++;
    }
  }

  // Grammar tags
  if (grammarTagIds.has(card.id)) {
    if (!card.tags.includes('grammar')) {
      card.tags.push('grammar');
      tagged++;
    }
  }

  result.push(card);
}

// Write result
fs.writeFileSync(FILE, JSON.stringify(result, null, 2));

console.log(`Phase 1 complete:`);
console.log(`  Cards removed: ${removedCount}`);
console.log(`  Spelling fixed: ${fixedCount}`);
console.log(`  Archaic glosses updated: ${glossUpdated}`);
console.log(`  Grammar cards tagged: ${tagged}`);
console.log(`  Total cards remaining: ${result.length}`);