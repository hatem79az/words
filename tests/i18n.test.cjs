const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(require.resolve('../js/i18n.js'), 'utf8'), context);
const { strings } = context.WordsI18n;
const placeholders = text => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();

test('all four dictionaries have the same keys and interpolation fields', () => {
  for (const [language, values] of Object.entries(strings)) {
    assert.deepEqual(Object.keys(values).sort(), Object.keys(strings.en).sort(), language);
    for (const [key, value] of Object.entries(values)) {
      assert.ok(value.trim(), `${language}.${key}`);
      assert.deepEqual(placeholders(value), placeholders(strings.en[key]), `${language}.${key}`);
    }
  }
});

test('every static HTML translation and all eighteen activity labels exist', () => {
  const html = fs.readFileSync(require.resolve('../index.html'), 'utf8');
  for (const [, key] of html.matchAll(/data-i18n(?:-placeholder)?="([^"]+)"/g)) {
    for (const values of Object.values(strings)) assert.ok(values[key], key);
  }
  const options = html.match(/<select id="game-mode">([\s\S]*?)<\/select>/)[1];
  assert.equal([...options.matchAll(/<option /g)].length, 18);
});
