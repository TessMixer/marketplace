/* eslint-disable @typescript-eslint/no-explicit-any */

import { supabase } from "../lib/supabase";
import type { Role } from "../data/mockData";

export type RestaurantStatus = "pending" | "approved" | "suspended";
export type OrderStatusDb = "pending" | "accepted" | "preparing" | "ready" | "completed" | "rejected" | "cancelled";

export type Category = {
  id: string;
  name: string;
  icon: string | null;
};

export type Restaurant = {
  id: string;
  ownerId: string | null;
  ownerName?: string;
  name: string;
  description: string;
  image: string;
  address: string;
  phone: string;
  openTime: string;
  closeTime: string;
  isOpen: boolean;
  status: RestaurantStatus;
  gpPercent: number;
  rating: number;
  delivery: number;
  time: string;
  latitude: number | null;
  longitude: number | null;
  locationAddress: string;
  locationUpdatedAt: string | null;
  createdAt: string;
};

export type MenuItem = {
  id: string;
  restaurantId: string;
  categoryId: string | null;
  category: string;
  name: string;
  description: string;
  price: number;
  image: string;
  isAvailable: boolean;
  isDeleted: boolean;
  popular: boolean;
  createdAt: string;
};

export type Order = {
  id: string;
  dbId: string;
  orderNumber: number;
  customer: string;
  restaurant: string;
  restaurantId: string;
  items: string;
  itemDetails: Array<{ name: string; quantity: number; note: string | null; unitPrice: number }>;
  foodTotal: number;
  deliveryFee: number;
  gpPercent: number;
  gpAmount: number;
  net: number;
  total: number;
  status: OrderStatusDb;
  time: string;
  createdAt: string;
  note: string;
  address: string;
  deliveryLatitude: number | null;
  deliveryLongitude: number | null;
  restaurantLatitude: number | null;
  restaurantLongitude: number | null;
  deliveryDistanceKm: number | null;
};

export type DeliveryQuote = {
  distanceKm: number | null;
  deliveryFee: number;
  restaurantHasLocation: boolean;
  usesGps: boolean;
};

export type ProfileRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  role: Role;
  createdAt: string;
};

const fallbackRestaurantImage = "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1000&q=80";
const fallbackMenuImage = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80";

function requireClient() {
  if (!supabase) throw new Error("Supabase is not configured");
  return supabase;
}

function mapRestaurant(row: any): Restaurant {
  return {
    id: row.id,
    ownerId: row.owner_id,
    ownerName: row.profiles?.name ?? undefined,
    name: row.name,
    description: row.description ?? "",
    image: row.image_url || fallbackRestaurantImage,
    address: row.address ?? "",
    phone: row.phone ?? "",
    openTime: String(row.open_time ?? "08:00").slice(0, 5),
    closeTime: String(row.close_time ?? "20:00").slice(0, 5),
    isOpen: Boolean(row.is_open),
    status: row.status,
    gpPercent: Number(row.gp_percent ?? 0),
    rating: Number(row.rating ?? 0),
    delivery: Number(row.delivery_fee ?? 0),
    time: row.delivery_minutes ?? "20-30 นาที",
    latitude: row.latitude === null || row.latitude === undefined ? null : Number(row.latitude),
    longitude: row.longitude === null || row.longitude === undefined ? null : Number(row.longitude),
    locationAddress: row.location_address ?? row.address ?? "",
    locationUpdatedAt: row.location_updated_at ?? null,
    createdAt: row.created_at,
  };
}

function mapMenuItem(row: any): MenuItem {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    categoryId: row.category_id,
    category: row.categories?.name ?? "อื่น ๆ",
    name: row.name,
    description: row.description ?? "",
    price: Number(row.price ?? 0),
    image: row.image_url || fallbackMenuImage,
    isAvailable: Boolean(row.is_available),
    isDeleted: Boolean(row.is_deleted),
    popular: Boolean(row.is_popular),
    createdAt: row.created_at,
  };
}

function mapOrder(row: any): Order {
  const itemDetails = (row.order_items ?? []).map((item: any) => ({
    name: item.item_name,
    quantity: Number(item.quantity ?? 0),
    note: item.note ?? null,
    unitPrice: Number(item.unit_price ?? 0),
  }));

  return {
    id: `OD-${String(row.order_number ?? 0).padStart(4, "0")}`,
    dbId: row.id,
    orderNumber: Number(row.order_number ?? 0),
    customer: row.customer_name ?? "ลูกค้า",
    restaurant: row.restaurants?.name ?? "ร้านอาหาร",
    restaurantId: row.restaurant_id,
    items: itemDetails.map((item: { name: string; quantity: number }) => `${item.name} × ${item.quantity}`).join(", "),
    itemDetails,
    foodTotal: Number(row.food_total ?? 0),
    deliveryFee: Number(row.delivery_fee ?? 0),
    gpPercent: Number(row.gp_percent ?? 0),
    gpAmount: Number(row.gp_amount ?? 0),
    net: Number(row.restaurant_net_income ?? 0),
    total: Number(row.grand_total ?? 0),
    status: row.status,
    time: new Date(row.created_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
    createdAt: row.created_at,
    note: row.customer_note ?? "",
    address: row.delivery_address ?? row.address ?? "",
    deliveryLatitude: row.delivery_latitude === null || row.delivery_latitude === undefined ? null : Number(row.delivery_latitude),
    deliveryLongitude: row.delivery_longitude === null || row.delivery_longitude === undefined ? null : Number(row.delivery_longitude),
    restaurantLatitude: row.restaurant_latitude === null || row.restaurant_latitude === undefined ? null : Number(row.restaurant_latitude),
    restaurantLongitude: row.restaurant_longitude === null || row.restaurant_longitude === undefined ? null : Number(row.restaurant_longitude),
    deliveryDistanceKm: row.delivery_distance_km === null || row.delivery_distance_km === undefined ? null : Number(row.delivery_distance_km),
  };
}

export async function getCategories() {
  const client = requireClient();
  const { data, error } = await client.from("categories").select("id,name,icon").eq("is_active", true).order("sort_order");
  if (error) throw error;
  return (data ?? []) as Category[];
}

export async function getCatalog() {
  const client = requireClient();
  const [{ data: restaurantRows, error: restaurantError }, { data: menuRows, error: menuError }] = await Promise.all([
    client.from("restaurants").select("*").eq("status", "approved").eq("is_open", true).order("created_at"),
    client
      .from("menu_items")
      .select("*, categories(name)")
      .eq("is_available", true)
      .eq("is_deleted", false)
      .order("created_at"),
  ]);
  if (restaurantError) throw restaurantError;
  if (menuError) throw menuError;
  return {
    restaurants: (restaurantRows ?? []).map(mapRestaurant),
    menu: (menuRows ?? []).map(mapMenuItem),
  };
}

export async function getSellerWorkspace(profileId: string) {
  const client = requireClient();
  const { data: restaurant, error } = await client
    .from("restaurants")
    .select("*")
    .eq("owner_id", profileId)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!restaurant) return { restaurant: null, menu: [] as MenuItem[] };

  const { data: menuRows, error: menuError } = await client
    .from("menu_items")
    .select("*, categories(name)")
    .eq("restaurant_id", restaurant.id)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false });
  if (menuError) throw menuError;

  return {
    restaurant: mapRestaurant(restaurant),
    menu: (menuRows ?? []).map(mapMenuItem),
  };
}

export async function listAdminRestaurants() {
  const client = requireClient();
  const { data, error } = await client
    .from("restaurants")
    .select("*, profiles(name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapRestaurant);
}

export async function updateRestaurantAdmin(id: string, input: Partial<{ status: RestaurantStatus; gpPercent: number; latitude: number | null; longitude: number | null; locationAddress: string }>) {
  const client = requireClient();
  const payload: Record<string, unknown> = {};
  if (input.status) payload.status = input.status;
  if (input.gpPercent !== undefined) payload.gp_percent = input.gpPercent;
  if (input.latitude !== undefined) payload.latitude = input.latitude;
  if (input.longitude !== undefined) payload.longitude = input.longitude;
  if (input.locationAddress !== undefined) payload.location_address = input.locationAddress;
  if (input.latitude !== undefined || input.longitude !== undefined) payload.location_updated_at = new Date().toISOString();
  const { error } = await client.from("restaurants").update(payload).eq("id", id);
  if (error) throw error;
}

export async function updateSellerRestaurant(id: string, input: Partial<Pick<Restaurant, "name" | "description" | "phone" | "address" | "openTime" | "closeTime" | "isOpen" | "image" | "latitude" | "longitude" | "locationAddress">>) {
  const client = requireClient();
  const payload: Record<string, unknown> = {};
  if (input.name !== undefined) payload.name = input.name;
  if (input.description !== undefined) payload.description = input.description;
  if (input.phone !== undefined) payload.phone = input.phone;
  if (input.address !== undefined) payload.address = input.address;
  if (input.openTime !== undefined) payload.open_time = input.openTime;
  if (input.closeTime !== undefined) payload.close_time = input.closeTime;
  if (input.isOpen !== undefined) payload.is_open = input.isOpen;
  if (input.image !== undefined) payload.image_url = input.image;
  if (input.latitude !== undefined) payload.latitude = input.latitude;
  if (input.longitude !== undefined) payload.longitude = input.longitude;
  if (input.locationAddress !== undefined) payload.location_address = input.locationAddress;
  if (input.latitude !== undefined || input.longitude !== undefined) payload.location_updated_at = new Date().toISOString();
  const { error } = await client.from("restaurants").update(payload).eq("id", id);
  if (error) throw error;
}

export async function getOrders() {
  const client = requireClient();
  const { data, error } = await client
    .from("orders")
    .select("*, restaurants(name), order_items(item_name,unit_price,quantity,note)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []).map(mapOrder);
}

export async function createOrder(input: {
  restaurantId: string;
  address: string;
  note: string;
  latitude: number | null;
  longitude: number | null;
  items: Array<{ id: string; quantity: number; note: string }>;
}) {
  const client = requireClient();
  const { data, error } = await client.rpc("create_order_with_gp", {
    p_restaurant_id: input.restaurantId,
    p_delivery_address: input.address,
    p_delivery_latitude: input.latitude,
    p_delivery_longitude: input.longitude,
    p_customer_note: input.note,
    p_items: input.items.map((item) => ({ menu_item_id: item.id, quantity: item.quantity, note: item.note })),
  });
  if (error) throw error;
  return data as string;
}

export async function getDeliveryQuote(restaurantId: string, latitude: number | null, longitude: number | null): Promise<DeliveryQuote> {
  const client = requireClient();
  const { data, error } = await client.rpc("calculate_delivery_quote", {
    p_restaurant_id: restaurantId,
    p_delivery_latitude: latitude,
    p_delivery_longitude: longitude,
  });
  if (error) throw error;
  const row = data as Record<string, unknown>;
  return {
    distanceKm: row.distance_km === null || row.distance_km === undefined ? null : Number(row.distance_km),
    deliveryFee: Number(row.delivery_fee ?? 20),
    restaurantHasLocation: Boolean(row.restaurant_has_location),
    usesGps: Boolean(row.uses_gps),
  };
}

export async function updateOrderStatus(dbId: string | undefined, status: OrderStatusDb) {
  if (!dbId) return;
  const client = requireClient();
  const { error } = await client.rpc("update_order_status", { p_order_id: dbId, p_status: status });
  if (error) throw error;
}

export async function createMenu(input: {
  restaurantId: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  categoryId: string | null;
}) {
  const client = requireClient();
  const { data, error } = await client
    .from("menu_items")
    .insert({
      restaurant_id: input.restaurantId,
      name: input.name,
      description: input.description,
      price: input.price,
      image_url: input.imageUrl || null,
      category_id: input.categoryId,
      is_available: true,
      is_deleted: false,
    })
    .select("*, categories(name)")
    .single();
  if (error) throw error;
  return mapMenuItem(data);
}

export async function updateMenu(id: string, input: Partial<{ name: string; description: string; price: number; imageUrl: string; categoryId: string | null; isAvailable: boolean }>) {
  const client = requireClient();
  const payload: Record<string, unknown> = {};
  if (input.name !== undefined) payload.name = input.name;
  if (input.description !== undefined) payload.description = input.description;
  if (input.price !== undefined) payload.price = input.price;
  if (input.imageUrl !== undefined) payload.image_url = input.imageUrl || null;
  if (input.categoryId !== undefined) payload.category_id = input.categoryId;
  if (input.isAvailable !== undefined) payload.is_available = input.isAvailable;
  const { data, error } = await client.from("menu_items").update(payload).eq("id", id).select("*, categories(name)").single();
  if (error) throw error;
  return mapMenuItem(data);
}

export async function deleteMenu(id: string) {
  const client = requireClient();
  const { error } = await client.from("menu_items").update({ is_deleted: true, is_available: false }).eq("id", id);
  if (error) throw error;
}

export async function getProfiles() {
  const client = requireClient();
  const { data, error } = await client.from("profiles").select("id,name,phone,email,role,created_at").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any): ProfileRow => ({
    id: row.id,
    name: row.name || "ไม่มีชื่อ",
    phone: row.phone,
    email: row.email,
    role: row.role,
    createdAt: row.created_at,
  }));
}

export async function getSellerReport(restaurantId?: string) {
  const client = requireClient();
  const { data, error } = await client.rpc("seller_sales_summary", { p_restaurant_id: restaurantId ?? null });
  if (error) throw error;
  return data;
}

export async function getAdminReport() {
  const client = requireClient();
  const { data, error } = await client.rpc("admin_sales_summary");
  if (error) throw error;
  return data;
}
