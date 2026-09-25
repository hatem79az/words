(function (root, factory) {
  const model = factory();
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.WordsModel = model;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SCHEMA_VERSION = 1;
  const LANGUAGES = Object.freeze(['en', 'pl', 'ar', 'de']);
  const MAX_LESSONS = 500;
  const MAX_ITEMS = 500;

  function id() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function cleanText(value, maxLength) {
    if (typeof value !== 'string' || value.length > maxLength) throw new Error('invalidText');
    return value.trim();
  }

  function newCollection() {
    return { schemaVersion: SCHEMA_VERSION, lessons: [] };
  }

  function createLesson(title = '') {
    const now = new Date().toISOString();
    return { id: id(), title, createdAt: now, updatedAt: now, items: [] };
  }

  function createItem() {
    return { id: id(), terms: { en: '', pl: '', ar: '', de: '' }, media: { image: null, audio: null } };
  }

  function validateItem(value) {
    if (!isObject(value) || typeof value.id !== 'string' || !value.id || value.id.length > 100 || !isObject(value.terms)) {
      throw new Error('invalidItem');
    }
    const terms = {};
    for (const language of LANGUAGES) terms[language] = cleanText(value.terms[language] ?? '', 500);
    if (Object.values(terms).filter(Boolean).length < 2) throw new Error('twoLanguages');
    const media = value.media ?? { image: null, audio: null };
    if (!isObject(media) || media.image !== null || media.audio !== null) throw new Error('unsupportedMedia');
    return { id: value.id, terms, media: { image: null, audio: null } };
  }

  function validateLesson(value) {
    if (!isObject(value) || typeof value.id !== 'string' || !value.id || value.id.length > 100 || !Array.isArray(value.items) || value.items.length > MAX_ITEMS) {
      throw new Error('invalidLesson');
    }
    const title = cleanText(value.title, 120);
    if (!title) throw new Error('nameRequired');
    if (!value.items.length) throw new Error('itemRequired');
    const items = value.items.map(validateItem);
    if (new Set(items.map(item => item.id)).size !== items.length) throw new Error('duplicateId');
    const createdAt = cleanText(value.createdAt, 40);
    const updatedAt = cleanText(value.updatedAt, 40);
    if (!Number.isFinite(Date.parse(createdAt)) || !Number.isFinite(Date.parse(updatedAt))) throw new Error('invalidLesson');
    return { id: value.id, title, createdAt, updatedAt, items };
  }

  function validateCollection(value) {
    if (!isObject(value) || value.schemaVersion !== SCHEMA_VERSION || !Array.isArray(value.lessons) || value.lessons.length > MAX_LESSONS) {
      throw new Error('invalidCollection');
    }
    const lessons = value.lessons.map(validateLesson);
    if (new Set(lessons.map(lesson => lesson.id)).size !== lessons.length) throw new Error('duplicateId');
    return { schemaVersion: SCHEMA_VERSION, lessons };
  }

  function saveLesson(collection, lesson) {
    const checked = validateLesson(lesson);
    const current = validateCollection(collection);
    const existingIndex = current.lessons.findIndex(item => item.id === checked.id);
    if (existingIndex >= 0) current.lessons[existingIndex] = checked;
    else {
      if (current.lessons.length >= MAX_LESSONS) throw new Error('tooManyLessons');
      current.lessons.push(checked);
    }
    return current;
  }

  function duplicateLesson(lesson) {
    const original = validateLesson(lesson);
    const copy = createLesson(original.title);
    copy.items = original.items.map(item => ({ ...item, id: id(), terms: { ...item.terms }, media: { ...item.media } }));
    return copy;
  }

  function cardsFor(lesson, frontLanguage, backLanguage) {
    if (!LANGUAGES.includes(frontLanguage) || !LANGUAGES.includes(backLanguage) || frontLanguage === backLanguage) return [];
    return validateLesson(lesson).items.filter(item => item.terms[frontLanguage] && item.terms[backLanguage]);
  }

  return { SCHEMA_VERSION, LANGUAGES, newCollection, createLesson, createItem, validateCollection, validateLesson, saveLesson, duplicateLesson, cardsFor };
});
