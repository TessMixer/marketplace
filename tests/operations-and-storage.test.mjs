import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readProjectFile = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("seller images are compressed and uploaded to an owner-scoped bucket", async () => {
  const image = await readProjectFile("app/lib/imageUpload.ts");
  const repository = await readProjectFile("app/services/marketplaceRepository.ts");
  const migration = await readProjectFile("supabase/migrations/20260717020000_storage_and_shop_operations.sql");
  assert.match(image, /canvas\.toBlob/);
  assert.match(image, /image\/webp/);
  assert.match(repository, /storage\.from\("food-images"\)\.upload/);
  assert.match(repository, /\$\{input\.ownerId\}\/\$\{input\.restaurantId\}/);
  assert.match(migration, /exists \(select 1 from public\.profiles where auth_user_id = auth\.uid\(\) and role = 'seller'\)/);
});

test("checkout supports pickup time and database-enforced shop capacity", async () => {
  const source = await readProjectFile("app/components/MarketplaceApp.tsx");
  const repository = await readProjectFile("app/services/marketplaceRepository.ts");
  const migration = await readProjectFile("supabase/migrations/20260717020000_storage_and_shop_operations.sql");
  assert.match(source, /type="datetime-local"/);
  assert.match(repository, /p_requested_pickup_time: input\.requestedPickupTime/);
  assert.match(migration, /for update;/);
  assert.match(migration, /restaurant has reached active order limit/);
  assert.match(migration, /restaurant_accepting_orders/);
  assert.match(migration, /max_active_orders between 1 and 100/);
});

test("account recovery, profile editing and seller notifications are wired", async () => {
  const provider = await readProjectFile("app/auth/AuthProvider.tsx");
  const auth = await readProjectFile("app/auth/AuthScreen.tsx");
  const source = await readProjectFile("app/components/MarketplaceApp.tsx");
  const worker = await readProjectFile("public/sw.js");
  assert.match(provider, /resetPasswordForEmail/);
  assert.match(provider, /updateUser\(\{password\}\)/);
  assert.match(provider, /updateAccount/);
  assert.match(auth, /ลืมรหัสผ่าน/);
  assert.match(source, /Notification\.requestPermission/);
  assert.match(source, /playOrderSound/);
  assert.match(worker, /notificationclick/);
  assert.match(worker, /url\.origin !== self\.location\.origin/);
});

test("seller operations include printable receipts and CSV exports", async () => {
  const source = await readProjectFile("app/components/MarketplaceApp.tsx");
  assert.match(source, /function OrderReceipt/);
  assert.match(source, /window\.print\(\)/);
  assert.match(source, /function downloadOrdersCsv/);
  assert.match(source, /ดาวน์โหลดออเดอร์ CSV/);
});
