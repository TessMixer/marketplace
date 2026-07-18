import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readProjectFile = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("admin user management records audited account states and protects admins", async () => {
  const sql = await readProjectFile("supabase/migrations/20260719010000_admin_user_management.sql");
  assert.match(sql, /account_status in \('active', 'suspended', 'closed'\)/);
  assert.match(sql, /create table if not exists public\.admin_user_actions/);
  assert.match(sql, /create or replace function public\.admin_set_user_status/);
  assert.match(sql, /if v_target_role = 'admin' then raise exception 'admin accounts are protected'/);
  assert.match(sql, /set status = 'suspended', is_open = false/);
  assert.match(sql, /account_status = 'active'/);
});

test("inactive accounts are blocked by database writes and live UI state", async () => {
  const sql = await readProjectFile("supabase/migrations/20260719010000_admin_user_management.sql");
  const provider = await readProjectFile("app/auth/AuthProvider.tsx");
  const source = await readProjectFile("app/components/MarketplaceApp.tsx");
  assert.match(sql, /enforce_active_account_write/);
  assert.match(sql, /alter publication supabase_realtime add table public\.profiles/);
  assert.match(provider, /profile-status:\$\{userId\}/);
  assert.match(source, /บัญชีนี้ถูกระงับชั่วคราว/);
});

test("seller approval remains restaurant-level and admin UI has working actions", async () => {
  const source = await readProjectFile("app/components/MarketplaceApp.tsx");
  assert.match(source, /ผู้ขายไม่ต้องรออนุมัติบัญชีซ้ำ/);
  assert.match(source, /updateUserAccountStatus/);
  assert.match(source, /เปิดใช้งานบัญชี/);
  assert.match(source, /ปิดบัญชี/);
  assert.match(source, /ประวัติการจัดการ/);
});
