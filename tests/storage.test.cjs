const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../js/storage.js'), 'utf8');
const key = 'words.collection.v1';

function setup(options = {}) {
  const values = new Map();
  const writes = [];
  const connections = [];
  let lastRequest;
  const localStorage = {
    getItem: key => values.get(key) || null,
    setItem: (key, value) => { if (options.full) throw Error('quota'); values.set(key, value); },
    removeItem: key => values.delete(key)
  };
  const indexedDB = options.unavailable ? undefined : { open() {
    const db = { closed: false, close() { this.closed = true; },
      transaction(_, mode) {
        const tx = { objectStore() { return {
          get() {
            const request = {};
            queueMicrotask(() => {
              if (options.readAbort) { tx.onabort(); return; }
              request.result = options.stored; request.onsuccess(); tx.oncomplete();
            });
            return request;
          },
          put(value) {
            writes.push(value);
            queueMicrotask(() => { if (options.writeAbort) tx.onabort(); else tx.oncomplete(); });
          }
        }; } };
        return tx;
      }
    };
    connections.push(db);
    const request = { result: db }; lastRequest = request;
    queueMicrotask(() => options.blocked ? request.onblocked() : request.onsuccess());
    return request;
  }};
  const context = vm.createContext({ indexedDB, localStorage, structuredClone });
  vm.runInContext(source, context);
  return { storage: context.WordsStorage, values, writes, connections, get request() { return lastRequest; } };
}

test('read transaction abort falls back without hanging and closes the database', async () => {
  const env = setup({ readAbort: true });
  env.values.set(key, JSON.stringify({ legacy: true }));
  assert.equal((await env.storage.load()).legacy, true);
  assert.equal(env.connections[0].closed, true);
});

test('successful saves remove stale legacy data and serialize independent snapshots', async () => {
  const env = setup(); env.values.set(key, '{"old":true}');
  const value = { revision: 1 };
  const first = env.storage.save(value); value.revision = 2;
  const second = env.storage.save(value); value.revision = 3;
  assert.deepEqual(await Promise.all([first, second]), [true, true]);
  assert.deepEqual(env.writes, [{ revision: 1 }, { revision: 2 }]);
  assert.equal(env.values.has(key), false);
  assert.ok(env.connections.every(db => db.closed));
});

test('blocked opens close late connections; unavailable and full stores return truthful results', async () => {
  const blocked = setup({ blocked: true });
  assert.equal(await blocked.storage.save({ current: true }), true);
  blocked.request.onsuccess();
  assert.equal(blocked.connections[0].closed, true);
  assert.equal(JSON.parse(blocked.values.get(key)).current, true);
  const full = setup({ unavailable: true, full: true });
  assert.equal(await full.storage.save({}), false);
  const aborted = setup({ writeAbort: true });
  assert.equal(await aborted.storage.save({}), false);
  assert.equal(aborted.connections[0].closed, true);
});
