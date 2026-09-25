(function (root, factory) {
  const games = factory(typeof module === 'object' && module.exports ? require('./model.js') : root.WordsModel);
  if (typeof module === 'object' && module.exports) module.exports = games;
  else root.WordsGames = games;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (model) {
  'use strict';

  function answerKey(text, language) {
    return text.normalize('NFC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase(language);
  }

  function sameAnswer(actual, expected, language) {
    return answerKey(actual, language) === answerKey(expected, language);
  }

  function eligiblePairs(lesson, front, back, requireUnique = true) {
    const items = model.cardsFor(lesson, front, back);
    if (!requireUnique) return items;
    const frontCounts = new Map();
    const backCounts = new Map();
    for (const item of items) {
      const a = answerKey(item.terms[front], front);
      const b = answerKey(item.terms[back], back);
      frontCounts.set(a, (frontCounts.get(a) || 0) + 1);
      backCounts.set(b, (backCounts.get(b) || 0) + 1);
    }
    return items.filter(item => frontCounts.get(answerKey(item.terms[front], front)) === 1 && backCounts.get(answerKey(item.terms[back], back)) === 1);
  }

  function shuffle(items, random = Math.random) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function quizChoices(question, pool, random = Math.random) {
    const distractors = shuffle(pool.filter(item => item.id !== question.id), random).slice(0, 3);
    if (distractors.length < 3) throw new Error('needFour');
    return shuffle([question, ...distractors], random);
  }

  function mediaPairs(lesson, assets, front, back, mode) {
    const clueFor = item => assets[mode === 'picture' ? item.media.image : item.media.audio[front]]?.data;
    const pairs = eligiblePairs(lesson, front, back, true).filter(item => {
      return Boolean(clueFor(item));
    });
    const clues = new Map();
    for (const item of pairs) {
      const clue = clueFor(item);
      clues.set(clue, (clues.get(clue) || 0) + 1);
    }
    return pairs.filter(item => clues.get(clueFor(item)) === 1);
  }

  function matchingRounds(items, random = Math.random) {
    if (items.length < 4) throw new Error('needFour');
    const pool = shuffle(items, random);
    const rounds = [];
    for (let offset = 0; offset < pool.length;) {
      const remaining = pool.length - offset;
      let size = Math.min(8, remaining);
      if (remaining - size > 0 && remaining - size < 4) size -= 4 - (remaining - size);
      rounds.push(pool.slice(offset, offset + size));
      offset += size;
    }
    return rounds;
  }

  function readiness(lesson, front, back, assets = {}) {
    const cards = eligiblePairs(lesson, front, back, false);
    const distinct = eligiblePairs(lesson, front, back, true);
    const pictures = mediaPairs(lesson, assets, front, back, 'picture').length;
    const listening = mediaPairs(lesson, assets, front, back, 'listening').length;
    return {
      flashcards: cards.length,
      quiz: distinct.length >= 4 ? distinct.length : 0,
      matching: distinct.length >= 4 ? distinct.length : 0,
      typing: distinct.length,
      picture: pictures >= 4 ? pictures : 0,
      listening: listening >= 4 ? listening : 0
    };
  }

  return { answerKey, sameAnswer, eligiblePairs, mediaPairs, shuffle, quizChoices, matchingRounds, readiness };
});
