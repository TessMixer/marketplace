import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readProjectFile = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("customer UI uses pickup flow without delivery controls", async () => {
  const source = await readProjectFile("app/components/MarketplaceApp.tsx");
  assert.match(source, /พร้อมรับอาหารที่ร้าน/);
  assert.match(source, /รับเองที่ร้าน/);
  assert.match(source, /ให้ร้านติดต่อกลับ/);
  assert.match(source, /customer-orders/);
  assert.doesNotMatch(source, /ค่าจัดส่ง|กำลังจัดส่ง|พร้อมส่ง|ที่อยู่จัดส่ง|navigator\.geolocation|getDeliveryQuote/);
});

test("repository sends pickup checkout fields to Supabase", async () => {
  const source = await readProjectFile("app/services/marketplaceRepository.ts");
  assert.match(source, /p_customer_name: input\.customerName/);
  assert.match(source, /p_customer_phone: input\.customerPhone/);
  assert.match(source, /p_fulfillment_method: input\.fulfillmentMethod/);
  assert.doesNotMatch(source, /calculate_delivery_quote|getDeliveryQuote/);
});

test("migration defines the seven-state order flow and zero delivery fee", async () => {
  const sql = await readProjectFile("supabase/migrations/20260714010000_pickup_order_flow.sql");
  assert.match(sql, /'pending',[\s\S]*'accepted',[\s\S]*'preparing',[\s\S]*'ready',[\s\S]*'completed',[\s\S]*'rejected',[\s\S]*'cancelled'/);
  assert.match(sql, /p_fulfillment_method text/);
  assert.match(sql, /v_food_total, 0, v_gp_percent/);
  assert.match(sql, /v_food_total, 'pending'/);
});
