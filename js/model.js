(function (root, factory) {
  const model = factory();
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.WordsModel = model;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SCHEMA_VERSION = 4;
  const LANGUAGES = Object.freeze(['en', 'pl', 'ar', 'de']);
  const MAX_LESSONS = 500;
  const MAX_ITEMS = 500;
  const MAX_CATEGORIES = 30;
  const ASSET_ID = /^(?!__proto__$|constructor$|prototype$)[a-zA-Z0-9_-]{1,100}$/;
  const AUDIO_TYPES = Object.freeze(['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4']);
  const MAX_HOTSPOTS = 8;
  const HOTSPOT_SPACING = .16;

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
    return { schemaVersion: SCHEMA_VERSION, lessons: [], assets: {} };
  }

  function createLesson(title = '') {
    const now = new Date().toISOString();
    return { id: id(), title, createdAt: now, updatedAt: now, categories: [], items: [] };
  }

  function createItem() {
    return { id: id(), terms: { en: '', pl: '', ar: '', de: '' }, categoryId: null,
      media: { image: null, audio: {}, hotspots: [] } };
  }

  function validateItem(value) {
    if (!isObject(value) || typeof value.id !== 'string' || !value.id || value.id.length > 100 || !isObject(value.terms)) {
      throw new Error('invalidItem');
    }
    const terms = {};
    for (const language of LANGUAGES) terms[language] = cleanText(value.terms[language] ?? '', 500);
    if (Object.values(terms).filter(Boolean).length < 2) throw new Error('twoLanguages');
    const categoryId = value.categoryId ?? null;
    if (categoryId !== null && (typeof categoryId !== 'string' || !ASSET_ID.test(categoryId))) throw new Error('invalidCategories');
    const media = value.media ?? { image: null, audio: null };
    if (!isObject(media) || (media.image !== null && (typeof media.image !== 'string' || !ASSET_ID.test(media.image))) ||
        (media.audio !== null && !isObject(media.audio))) throw new Error('unsupportedMedia');
    const audio = {};
    for (const [language, assetId] of Object.entries(media.audio || {})) {
      if (!LANGUAGES.includes(language) || typeof assetId !== 'string' || !ASSET_ID.test(assetId)) throw new Error('unsupportedMedia');
      audio[language] = assetId;
    }
    const rawHotspots = media.hotspots ?? [];
    if (!Array.isArray(rawHotspots) || rawHotspots.length > MAX_HOTSPOTS || (rawHotspots.length && !media.image)) throw new Error('invalidHotspots');
    const hotspots = rawHotspots.map(point => {
      if (!isObject(point) || typeof point.itemId !== 'string' || !point.itemId || point.itemId.length > 100 ||
          typeof point.x !== 'number' || typeof point.y !== 'number' || !Number.isFinite(point.x) || !Number.isFinite(point.y) ||
          point.x < .05 || point.x > .95 || point.y < .05 || point.y > .95) throw new Error('invalidHotspots');
      return { itemId: point.itemId, x: point.x, y: point.y };
    });
    if (new Set(hotspots.map(point => point.itemId)).size !== hotspots.length ||
        hotspots.some((point, index) => hotspots.slice(index + 1).some(other =>
          Math.hypot(point.x - other.x, point.y - other.y) < HOTSPOT_SPACING))) throw new Error('invalidHotspots');
    return { id: value.id, terms, categoryId, media: { image: media.image, audio, hotspots } };
  }

  function validateLesson(value) {
    if (!isObject(value) || typeof value.id !== 'string' || !value.id || value.id.length > 100 || !Array.isArray(value.items) || value.items.length > MAX_ITEMS) {
      throw new Error('invalidLesson');
    }
    const title = cleanText(value.title, 120);
    if (!title) throw new Error('nameRequired');
    if (!value.items.length) throw new Error('itemRequired');
    const rawCategories = value.categories ?? [];
    if (!Array.isArray(rawCategories) || rawCategories.length > MAX_CATEGORIES) throw new Error('invalidCategories');
    const categories = rawCategories.map(category => {
      if (!isObject(category) || typeof category.id !== 'string' || !ASSET_ID.test(category.id) || !isObject(category.names)) {
        throw new Error('invalidCategories');
      }
      const names = {};
      for (const language of LANGUAGES) names[language] = cleanText(category.names[language] ?? '', 80);
      if (!Object.values(names).some(Boolean)) throw new Error('invalidCategories');
      return { id: category.id, names };
    });
    if (new Set(categories.map(category => category.id)).size !== categories.length) throw new Error('invalidCategories');
    for (const language of LANGUAGES) {
      const names = categories.map(category => category.names[language]).filter(Boolean)
        .map(name => name.normalize('NFC').replace(/\s+/gu, ' ').toLocaleLowerCase(language));
      if (new Set(names).size !== names.length) throw new Error('invalidCategories');
    }
    const items = value.items.map(validateItem);
    if (new Set(items.map(item => item.id)).size !== items.length) throw new Error('duplicateId');
    const itemIds = new Set(items.map(item => item.id));
    const categoryIds = new Set(categories.map(category => category.id));
    if (items.some(item => item.categoryId && !categoryIds.has(item.categoryId))) throw new Error('invalidCategories');
    if (items.some(item => item.media.hotspots.some(point => !itemIds.has(point.itemId)))) throw new Error('invalidHotspots');
    const createdAt = cleanText(value.createdAt, 40);
    const updatedAt = cleanText(value.updatedAt, 40);
    if (!Number.isFinite(Date.parse(createdAt)) || !Number.isFinite(Date.parse(updatedAt))) throw new Error('invalidLesson');
    return { id: value.id, title, createdAt, updatedAt, categories, items };
  }

  function validateCollection(value) {
    if (!isObject(value) || ![1, 2, 3, SCHEMA_VERSION].includes(value.schemaVersion) || !Array.isArray(value.lessons) || value.lessons.length > MAX_LESSONS) {
      throw new Error('invalidCollection');
    }
    const rawAssets = value.schemaVersion === 1 ? {} : value.assets;
    if (!isObject(rawAssets) || Object.keys(rawAssets).length > 2000) throw new Error('invalidCollection');
    const assets = {};
    let total = 0;
    for (const [assetId, asset] of Object.entries(rawAssets)) {
      if (!ASSET_ID.test(assetId) || !isObject(asset) || !['image/webp', ...AUDIO_TYPES].includes(asset.mime) || typeof asset.data !== 'string') throw new Error('unsupportedMedia');
      const max = asset.mime === 'image/webp' ? 2_200_000 : 5_600_000;
      if (asset.data.length > max || !asset.data.startsWith(`data:${asset.mime};base64,`) ||
          !/^data:[\w/+-]+;base64,[A-Za-z0-9+/]+={0,2}$/.test(asset.data)) throw new Error('unsupportedMedia');
      total += asset.data.length;
      if (total > 32_000_000) throw new Error('fileTooLarge');
      assets[assetId] = { mime: asset.mime, data: asset.data };
    }
    const lessons = value.lessons.map(validateLesson);
    if (new Set(lessons.map(lesson => lesson.id)).size !== lessons.length) throw new Error('duplicateId');
    for (const lesson of lessons) for (const item of lesson.items) {
      if (item.media.image && (!assets[item.media.image] || assets[item.media.image].mime !== 'image/webp')) throw new Error('missingMedia');
      for (const assetId of Object.values(item.media.audio)) if (!assets[assetId] || !AUDIO_TYPES.includes(assets[assetId].mime)) throw new Error('missingMedia');
    }
    return { schemaVersion: SCHEMA_VERSION, lessons, assets };
  }

  function pruneAssets(collection) {
    const used = new Set();
    for (const lesson of collection.lessons) for (const item of lesson.items) {
      if (item.media.image) used.add(item.media.image);
      for (const assetId of Object.values(item.media.audio)) used.add(assetId);
    }
    return { ...collection, assets: Object.fromEntries(Object.entries(collection.assets).filter(([assetId]) => used.has(assetId))) };
  }

  function saveLesson(collection, lesson, addedAssets = {}) {
    const checked = validateLesson(lesson);
    const current = validateCollection(collection);
    const existingIndex = current.lessons.findIndex(item => item.id === checked.id);
    if (existingIndex >= 0) current.lessons[existingIndex] = checked;
    else {
      if (current.lessons.length >= MAX_LESSONS) throw new Error('tooManyLessons');
      current.lessons.push(checked);
    }
    return pruneAssets(validateCollection({ ...current, assets: { ...current.assets, ...addedAssets } }));
  }

  function duplicateLesson(lesson) {
    const original = validateLesson(lesson);
    const copy = createLesson(original.title);
    const ids = new Map(original.items.map(item => [item.id, id()]));
    const categoryIds = new Map(original.categories.map(category => [category.id, id()]));
    copy.categories = original.categories.map(category => ({ id: categoryIds.get(category.id), names: { ...category.names } }));
    copy.items = original.items.map(item => ({ ...item, id: ids.get(item.id), terms: { ...item.terms },
      categoryId: item.categoryId ? categoryIds.get(item.categoryId) : null,
      media: { image: item.media.image, audio: { ...item.media.audio },
        hotspots: item.media.hotspots.map(point => ({ ...point, itemId: ids.get(point.itemId) })) } }));
    return copy;
  }

  function cardsFor(lesson, frontLanguage, backLanguage) {
    if (!LANGUAGES.includes(frontLanguage) || !LANGUAGES.includes(backLanguage) || frontLanguage === backLanguage) return [];
    return validateLesson(lesson).items.filter(item => item.terms[frontLanguage] && item.terms[backLanguage]);
  }

  return { SCHEMA_VERSION, LANGUAGES, AUDIO_TYPES, MAX_HOTSPOTS, HOTSPOT_SPACING, MAX_CATEGORIES,
    newCollection, createLesson, createItem, validateCollection, validateLesson, saveLesson, duplicateLesson,
    pruneAssets, cardsFor, newAssetId: id, newCategoryId: id };
});
