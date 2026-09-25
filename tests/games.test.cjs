const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../js/model.js');
const games = require('../js/games.js');

function lesson(count = 9) {
  const value = model.createLesson('Words');
  value.items = Array.from({ length: count }, (_, index) => {
    const item = model.createItem();
    item.terms.en = `word ${index}`;
    item.terms.pl = `słowo ${index}`;
    item.terms.ar = `كلمة ${index}`;
    item.terms.de = `Wort ${index}`;
    return item;
  });
  return value;
}

test('four language pairs are selected without assuming Polish is the target', () => {
  const value = lesson(4);
  assert.equal(games.readiness(value, 'de', 'ar').quiz, 4);
  assert.equal(games.eligiblePairs(value, 'ar', 'en').length, 4);
});

test('ambiguous repeated prompts and answers are excluded from recognition games', () => {
  const value = lesson(6);
  value.items[1].terms.en = value.items[0].terms.en;
  value.items[3].terms.pl = value.items[2].terms.pl;
  assert.equal(games.eligiblePairs(value, 'en', 'pl').length, 2);
  assert.equal(games.readiness(value, 'en', 'pl').quiz, 0);
  assert.equal(games.readiness(value, 'en', 'pl').flashcards, 6);
});

test('quiz answers have four distinct options and one correct identifier', () => {
  const pool = games.eligiblePairs(lesson(6), 'en', 'pl');
  const choices = games.quizChoices(pool[0], pool, () => .27);
  assert.equal(choices.length, 4);
  assert.equal(new Set(choices.map(choice => choice.terms.pl)).size, 4);
  assert.equal(choices.filter(choice => choice.id === pool[0].id).length, 1);
});

test('matching rounds cover all nine words without a one-card final round', () => {
  const items = games.eligiblePairs(lesson(9), 'en', 'pl');
  const rounds = games.matchingRounds(items, () => .5);
  assert.deepEqual(rounds.map(round => round.length), [5, 4]);
  assert.deepEqual(new Set(rounds.flat().map(item => item.id)), new Set(items.map(item => item.id)));
});

test('typed spelling normalizes case and whitespace but preserves diacritics', () => {
  assert.equal(games.sameAnswer('  KOT  ', 'kot', 'pl'), true);
  assert.equal(games.sameAnswer('słowo', 'slowo', 'pl'), false);
  assert.equal(games.sameAnswer('STRASSE', 'Straße', 'de'), false);
  assert.equal(games.sameAnswer(' قطة ', 'قطة', 'ar'), true);
});
