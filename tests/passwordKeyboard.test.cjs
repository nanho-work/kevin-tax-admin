const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const vm = require('node:vm')
const code = ts.transpileModule(fs.readFileSync('src/utils/passwordKeyboard.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const sandbox = { exports: {} }
vm.runInNewContext(code, sandbox)
const convert = sandbox.exports.toEnglishPasswordKeys

test('preserves Latin case, digits and password symbols', () => {
  assert.equal(convert('AbC123!@#$%^&*()_+-= []{}'), 'AbC123!@#$%^&*()_+-= []{}')
})
test('converts complete syllables and complex final consonants', () => {
  assert.equal(convert('한글'), 'gksrmf')
  assert.equal(convert('값괜찮'), 'rkqtrhoscksg')
})
test('converts unfinished IME jamo and shifted Korean keys', () => {
  assert.equal(convert('ㅁㄴㅇㄹㅂㅈㄷㄱㅅ'), 'asdfqwert')
  assert.equal(convert('ㅃㅉㄸㄲㅆㅒㅖ'), 'QWERTOP')
})
test('handles decomposed Unicode from pasted Korean', () => {
  assert.equal(convert('한글'.normalize('NFD')), 'gksrmf')
})
test('mixed input keeps surrounding content and is idempotent', () => {
  const mixed = 'Ab한글123!'
  assert.equal(convert(mixed), 'Abgksrmf123!')
  assert.equal(convert(convert(mixed)), convert(mixed))
  assert.equal(convert(''), '')
})
