import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readProjectFile = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("order Realtime is scoped by customer and seller ownership", async () => {
  const repository = await readProjectFile("app/services/marketplaceRepository.ts");
  assert.match(repository, /customer_id=eq\.\$\{input\.profileId\}/);
  assert.match(repository, /restaurant_id=eq\.\$\{input\.restaurantId\}/);
  assert.match(repository, /table: "orders"/);
  assert.match(repository, /status === "SUBSCRIBED"/);
});

test("marketplace refreshes and shows Thai Realtime notifications", async () => {
  const source = await readProjectFile("app/components/MarketplaceApp.tsx");
  assert.match(source, /subscribeToOrders/);
  assert.match(source, /มีออเดอร์ใหม่ กรุณาตรวจสอบและกดรับออเดอร์/);
  assert.match(source, /สถานะออเดอร์ของคุณอัปเดตแล้ว/);
  assert.match(source, /Supabase Realtime/);
});

test("RLS migration blocks direct order writes and enables publication", async () => {
  const sql = await readProjectFile("supabase/migrations/20260717010000_realtime_rls_hardening.sql");
  assert.match(sql, /revoke insert, update, delete on public\.orders from anon, authenticated/);
  assert.match(sql, /customer_id = public\.current_profile_id\(\)/);
  assert.match(sql, /r\.owner_id = public\.current_profile_id\(\)/);
  assert.match(sql, /or public\.is_admin\(\)/);
  assert.match(sql, /alter publication supabase_realtime add table public\.orders/);
  assert.doesNotMatch(sql, /create policy[^;]+orders for update/is);
});
