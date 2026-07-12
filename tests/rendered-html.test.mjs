import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Vite build contains the Thai SPA shell", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  assert.match(html, /<html lang="th">/i);
  assert.match(html, /<title>อิ่มดี \| สั่งง่าย ขายคล่อง<\/title>/i);
  assert.match(html, /id="root"/);
  assert.match(html, /manifest\.webmanifest/);
  assert.match(html, /theme-color/);
  assert.match(html, /\/assets\/.*\.js/);
});
