import { test } from 'node:test';
import assert from 'node:assert/strict';

import decodeResponseText, {
  charsetFromContentType,
  decodeBytes,
  sniffDeclaredEncoding,
} from '../src/js/load_url/decode_text';

// "Драгоманов" encoded as windows-1251.
const CYRILLIC_CP1251 = [0xC4, 0xF0, 0xE0, 0xE3, 0xEE, 0xEC, 0xE0, 0xED, 0xEE, 0xE2];
const CYRILLIC = 'Драгоманов';
// "café" encoded as windows-1252 (invalid as UTF-8).
const CAFE_CP1252 = [0x63, 0x61, 0x66, 0xE9];

function bytes(...parts: (string | number[])[]): Uint8Array {
  const result: number[] = [];

  for (const part of parts) {
    if (typeof part === 'string') {
      for (let i = 0; i < part.length; i++) {
        result.push(part.charCodeAt(i));
      }
    } else {
      result.push(...part);
    }
  }

  return new Uint8Array(result);
}

test('decodes a windows-1251 page declared only by <meta http-equiv>', () => {
  const page = bytes(
    '<html><head><meta http-equiv=Content-Type content="text/html; charset=windows-1251"><title>',
    CYRILLIC_CP1251,
    '</title></head><body></body></html>',
  );

  assert.equal(decodeBytes(page, null), `<html><head><meta http-equiv=Content-Type content="text/html; charset=windows-1251"><title>${CYRILLIC}</title></head><body></body></html>`);
});

test('decodes a page declared by <meta charset>', () => {
  const page = bytes('<!doctype html><meta charset="windows-1251"><p>', CYRILLIC_CP1251);

  assert.ok(decodeBytes(page).endsWith(`<p>${CYRILLIC}`));
});

test('decodes a page declared by an XML declaration', () => {
  const page = bytes('<?xml version="1.0" encoding="windows-1251"?><html><p>', CYRILLIC_CP1251);

  assert.ok(decodeBytes(page).endsWith(`<p>${CYRILLIC}`));
});

test('the Content-Type header wins over the in-document declaration', () => {
  const page = bytes('<meta charset="utf-8"><p>', CYRILLIC_CP1251);

  assert.ok(decodeBytes(page, 'windows-1251').endsWith(`<p>${CYRILLIC}`));
});

test('a Content-Type header that does not match the bytes is ignored', () => {
  const page = bytes('<meta charset="windows-1251"><p>', CYRILLIC_CP1251);

  assert.ok(decodeBytes(page, 'utf-8').endsWith(`<p>${CYRILLIC}`));
});

test('a byte order mark wins over everything', () => {
  const page = bytes([0xEF, 0xBB, 0xBF], '<meta charset="windows-1251"><p>cafÃ©');

  assert.equal(decodeBytes(page, 'windows-1251'), '<meta charset="windows-1251"><p>café');
});

test('defaults to UTF-8 when nothing is declared', () => {
  const page = bytes('<p>cafÃ©');

  assert.equal(decodeBytes(page), '<p>café');
});

test('falls back to windows-1252 when undeclared bytes are not valid UTF-8', () => {
  const page = bytes('<p>', CAFE_CP1252);

  assert.equal(decodeBytes(page), '<p>café');
});

test('ignores unknown encoding labels', () => {
  const page = bytes('<meta charset="klingon"><p>', CAFE_CP1252);

  assert.equal(decodeBytes(page, 'not-a-charset'), '<meta charset="klingon"><p>café');
});

test('treats an in-document UTF-16 declaration as UTF-8', () => {
  const page = bytes('<meta charset="utf-16"><p>cafÃ©');

  assert.equal(decodeBytes(page), '<meta charset="utf-16"><p>café');
});

test('does not pick up a charset mentioned in the body', () => {
  const page = bytes('<html><body><code>&lt;meta charset="windows-1251"&gt;</code>', CAFE_CP1252);

  assert.equal(sniffDeclaredEncoding(page), null);
});

test('reads the charset of a Content-Type header', () => {
  assert.equal(charsetFromContentType('text/html; charset=windows-1251'), 'windows-1251');
  assert.equal(charsetFromContentType('text/html;charset="ISO-8859-2"'), 'ISO-8859-2');
  assert.equal(charsetFromContentType('text/html'), null);
  assert.equal(charsetFromContentType(null), null);
});

test('decodes a Response honouring the page encoding', async () => {
  const page = bytes('<meta charset="windows-1251"><p>', CYRILLIC_CP1251);
  const response = new Response(page, {headers: {'content-type': 'text/html'}});

  assert.equal(await decodeResponseText(response), `<meta charset="windows-1251"><p>${CYRILLIC}`);
});

test('Response.text() would have produced replacement characters', async () => {
  const page = bytes('<meta charset="windows-1251"><p>', CYRILLIC_CP1251);
  const text = await new Response(page).text();

  assert.ok(text.indexOf('�') !== -1);
});
