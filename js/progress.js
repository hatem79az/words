(function (root, factory) {
  const progress = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = progress;
  else root.WordsProgress = progress;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  const KEY = 'words.progress.v1';
  const MAX_ENTRIES = 500;
  const LANGUAGES = ['en', 'pl', 'ar', 'de'];
  const MODES = new Set(['flashcards', 'quiz', 'matching', 'memory', 'trueFalse', 'typing', 'tiles', 'missing',
    'picture', 'pictureLabels', 'categorySort', 'sentenceOrder', 'sentenceCompletion', 'listening',
    'listenType', 'guess', 'wordSearch', 'crossword']);

  function valid(entry) {
    return entry && typeof entry === 'object' && !Array.isArray(entry) &&
      typeof entry.lessonId === 'string' && entry.lessonId.length > 0 && entry.lessonId.length <= 100 &&
      MODES.has(entry.mode) && LANGUAGES.includes(entry.front) && LANGUAGES.includes(entry.back) && entry.front !== entry.back &&
      Number.isInteger(entry.total) && entry.total > 0 && entry.total <= 500 &&
      (entry.mode === 'flashcards' ? entry.score === null : Number.isInteger(entry.score) && entry.score >= 0 && entry.score <= entry.total) &&
      typeof entry.finishedAt === 'string' && entry.finishedAt.length <= 40 && Number.isFinite(Date.parse(entry.finishedAt));
  }

  function append(entries, entry) {
    if (!valid(entry)) throw new Error('invalidProgress');
    return [...entries, { lessonId: entry.lessonId, mode: entry.mode, front: entry.front, back: entry.back,
      score: entry.score, total: entry.total, finishedAt: entry.finishedAt }].slice(-MAX_ENTRIES);
  }

  function forLesson(entries, lessonId) { return entries.filter(entry => entry.lessonId === lessonId); }

  function clearLesson(entries, lessonId) { return entries.filter(entry => entry.lessonId !== lessonId); }

  function prune(entries, lessonIds) {
    const ids = new Set(lessonIds);
    return entries.filter(entry => ids.has(entry.lessonId));
  }

  function summary(entries, lessonId) {
    const lesson = forLesson(entries, lessonId);
    const scored = lesson.filter(entry => entry.score !== null);
    return { count: lesson.length, reviews: lesson.length - scored.length,
      correct: scored.reduce((sum, entry) => sum + entry.score, 0),
      total: scored.reduce((sum, entry) => sum + entry.total, 0),
      recent: lesson.slice(-5).reverse() };
  }

  function load(store) {
    try {
      const storage = store || root.localStorage;
      const raw = storage.getItem(KEY);
      if (!raw) return [];
      const data = JSON.parse(raw);
      return data && data.schemaVersion === 1 && Array.isArray(data.entries)
        ? data.entries.filter(valid).slice(-MAX_ENTRIES).map(entry => ({ lessonId: entry.lessonId,
          mode: entry.mode, front: entry.front, back: entry.back, score: entry.score,
          total: entry.total, finishedAt: entry.finishedAt })) : [];
    } catch (_) { return []; }
  }

  function save(entries, store) {
    try {
      const storage = store || root.localStorage;
      storage.setItem(KEY, JSON.stringify({ schemaVersion: 1, entries }));
      return true;
    } catch (_) { return false; }
  }

  return { KEY, MAX_ENTRIES, valid, append, forLesson, clearLesson, prune, summary, load, save };
});
