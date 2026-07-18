import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readProjectFile = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("authentication form has no embedded test credentials and requires stronger new passwords", async () => {
  const auth = await readProjectFile("app/auth/AuthScreen.tsx");
  assert.doesNotMatch(auth, /admin\d{4}|(?:staff|sell|user)@admin\.com/);
  assert.match(auth, /email:"",password:""/);
  assert.match(auth, /PASSWORD_MIN_LENGTH = 10/);
  assert.match(auth, /autoComplete=\{mode==="login"\?"current-password":"new-password"\}/);
  assert.match(auth, /รหัสผ่านใหม่ต้องมีทั้งตัวอักษรและตัวเลข/);
});

test("Supabase auth callback detection and Vercel security headers are enabled", async () => {
  const client = await readProjectFile("app/lib/supabase.ts");
  const vercel = JSON.parse(await readProjectFile("vercel.json"));
  const headers = Object.fromEntries(vercel.headers[0].headers.map(({ key, value }) => [key, value]));
  assert.match(client, /detectSessionInUrl: true/);
  assert.match(headers["Content-Security-Policy"], /connect-src 'self' https:\/\/\*\.supabase\.co wss:\/\/\*\.supabase\.co/);
  assert.equal(headers["X-Content-Type-Options"], "nosniff");
  assert.equal(headers["X-Frame-Options"], "DENY");
  assert.equal(headers["Permissions-Policy"], "camera=(), microphone=(), geolocation=()");
});

test("CI verifies every push without production secrets", async () => {
  const workflow = await readProjectFile(".github/workflows/ci.yml");
  const envExample = await readProjectFile(".env.example");
  assert.match(workflow, /npm ci/);
  assert.match(workflow, /npm run check/);
  assert.equal(envExample, "VITE_SUPABASE_URL=\nVITE_SUPABASE_ANON_KEY=\n");
});
