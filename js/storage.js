(function (root) {
  'use strict';
  const LEGACY_KEY = 'words.collection.v1';
  let pendingSave = Promise.resolve();

  function database() {
    return new Promise((resolve, reject) => {
      if (!root.indexedDB) { reject(new Error('storageUnavailable')); return; }
      const request = root.indexedDB.open('words-library', 1);
      let abandoned = false;
      request.onupgradeneeded = () => request.result.createObjectStore('documents');
      request.onsuccess = () => {
        if (abandoned) { request.result.close(); return; }
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => { abandoned = true; reject(new Error('storageUnavailable')); };
    });
  }

  async function load() {
    let db;
    try {
      db = await database();
      const value = await new Promise((resolve, reject) => {
        const tx = db.transaction('documents', 'readonly');
        const request = tx.objectStore('documents').get('collection');
        let stored = null;
        request.onsuccess = () => { stored = request.result || null; };
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => resolve(stored);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      if (value) return value;
    } catch (_) { /* older browser or file origin: try the earlier cache */ }
    finally { if (db) db.close(); }
    try {
      const legacy = root.localStorage.getItem(LEGACY_KEY);
      return legacy ? JSON.parse(legacy) : null;
    } catch (_) { return null; }
  }

  async function persist(collection) {
    let db;
    try {
      db = await database();
    } catch (_) {
      try { root.localStorage.setItem(LEGACY_KEY, JSON.stringify(collection)); return true; }
      catch (_) { return false; }
    }
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction('documents', 'readwrite');
        tx.objectStore('documents').put(collection, 'collection');
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      // A successful migration must not leave an older library to reappear later.
      try { root.localStorage.removeItem(LEGACY_KEY); } catch (_) { /* optional legacy cleanup */ }
      return true;
    } catch (_) { return false; }
    finally { db.close(); }
  }

  function save(collection) {
    const snapshot = structuredClone(collection);
    pendingSave = pendingSave.then(() => persist(snapshot), () => persist(snapshot));
    return pendingSave;
  }

  root.WordsStorage = { load, save };
})(globalThis);
