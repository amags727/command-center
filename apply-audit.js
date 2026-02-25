#!/usr/bin/env node
/**
 * Flashcard Deck Audit — Phase 4 Rebuild Script
 * Reads audit-decisions.json + anki_cards.json → outputs cleaned anki_cards.json
 * 
 * Usage: node apply-audit.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');

const dryRun = process.argv.includes('--dry-run');

const cardsPath = path.join(__dirname, 'anki_cards.json');
const decisionsPath = path.join(__dirname, 'audit-decisions.json');
const backupPath = path.join(__dirname, 'anki_cards.pre-audit.json');

// Check files exist
if (!fs.existsSync(decisionsPath)) {
  console.error('❌ audit-decisions.json not found. Export decisions from audit-review.html first.');
  process.exit(1);
}

const cards = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));
const decisions = JSON.parse(fs.readFileSync(decisionsPath, 'utf8'));

console.log(`\n═══ APPLYING AUDIT DECISIONS ═══`);
console.log(`Cards in deck: ${cards.length}`);
console.log(`Decisions loaded: keep=${decisions.stats.keep}, remove=${decisions.stats.remove}, undecided=${decisions.stats.undecided}`);

// Count what we're removing
let removeCount = 0;
let keepCount = 0;
let undecidedCount = 0;

const cleaned = cards.filter(card => {
  const decision = decisions.decisions[card.id];
  if (decision === 0) {
    removeCount++;
    return false; // remove
  } else if (decision === 1) {
    keepCount++;
    return true; // explicit keep
  } else {
    undecidedCount++;
    return true; // undecided = keep by default
  }
});

console.log(`\nResult:`);
console.log(`  Removing: ${removeCount} cards`);
console.log(`  Keeping (explicit): ${keepCount} cards`);
console.log(`  Keeping (undecided): ${undecidedCount} cards`);
console.log(`  Final deck size: ${cleaned.length} cards`);

if (dryRun) {
  console.log('\n🔍 DRY RUN — no files modified.');
} else {
  // Backup original
  fs.copyFileSync(cardsPath, backupPath);
  console.log(`\n💾 Backup saved to anki_cards.pre-audit.json`);
  
  // Write cleaned deck
  fs.writeFileSync(cardsPath, JSON.stringify(cleaned, null, 2));
  console.log(`✅ anki_cards.json updated (${cleaned.length} cards)`);
}