import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readProjectFile = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Google OAuth uses Supabase and preserves role onboarding", async () => {
  const provider = await readProjectFile("app/auth/AuthProvider.tsx");
  const auth = await readProjectFile("app/auth/AuthScreen.tsx");
  assert.match(provider, /signInWithOAuth/);
  assert.match(provider, /provider:"google"/);
  assert.match(provider, /complete_google_onboarding/);
  assert.match(auth, /เข้าสู่ระบบด้วย Google/);
  assert.match(auth, /สมัครผู้ขายด้วย Google/);
});

test("seller OAuth onboarding always creates a closed pending restaurant", async () => {
  const migration = await readProjectFile("supabase/migrations/20260718010000_google_oauth_onboarding.sql");
  assert.match(migration, /p_role not in \('customer','seller'\)/);
  assert.match(migration, /v_profile\.role = 'admin'/);
  assert.match(migration, /'pending',coalesce\(v_gp,15\),false/);
  assert.doesNotMatch(migration, /'approved'.*insert into public\.restaurants/s);
});
