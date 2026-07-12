import { supabase } from "../lib/supabase";

const statusToThai: Record<string,string> = { pending:"รอรับออเดอร์", accepted:"รอรับออเดอร์", preparing:"กำลังทำอาหาร", ready:"พร้อมส่ง", delivering:"กำลังจัดส่ง", completed:"สำเร็จ", cancelled:"ยกเลิก" };
const statusToDb: Record<string,string> = Object.fromEntries(Object.entries(statusToThai).map(([key,value]) => [value,key]));

export async function getCatalog() {
  if (!supabase) throw new Error("Supabase is not configured");
  const [{ data: restaurantRows, error: restaurantError }, { data: menuRows, error: menuError }] = await Promise.all([
    supabase.from("restaurants").select("*").eq("status", "approved").order("created_at"),
    supabase.from("menu_items").select("*, categories(name)").order("created_at"),
  ]);
  if (restaurantError) throw restaurantError;
  if (menuError) throw menuError;
  return {
    restaurants: (restaurantRows ?? []).map((r) => ({ id:r.id,name:r.name,description:r.description,image:r.image_url,rating:Number(r.rating),time:r.delivery_minutes,delivery:Number(r.delivery_fee),isOpen:r.is_open,status:r.status,gpPercent:Number(r.gp_percent) })),
    menu: (menuRows ?? []).map((m:any) => ({ id:m.id,restaurantId:m.restaurant_id,name:m.name,description:m.description,price:Number(m.price),image:m.image_url,category:m.categories?.name ?? "อื่น ๆ",isAvailable:m.is_available,popular:m.is_popular })),
  };
}

export async function getSellerWorkspace(profileId:string) {
  if(!supabase) throw new Error("Supabase is not configured");
  const {data:restaurant,error}=await supabase.from("restaurants").select("*").eq("owner_id",profileId).single();
  if(error) throw error;
  const {data:menuRows,error:menuError}=await supabase.from("menu_items").select("*, categories(name)").eq("restaurant_id",restaurant.id).order("created_at");
  if(menuError) throw menuError;
  return {
    restaurant:{id:restaurant.id,name:restaurant.name,description:restaurant.description,image:restaurant.image_url||"https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1000&q=80",rating:Number(restaurant.rating),time:restaurant.delivery_minutes,delivery:Number(restaurant.delivery_fee),isOpen:restaurant.is_open,status:restaurant.status,gpPercent:Number(restaurant.gp_percent)},
    menu:(menuRows??[]).map((m:any)=>({id:m.id,restaurantId:m.restaurant_id,name:m.name,description:m.description,price:Number(m.price),image:m.image_url||"https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80",category:m.categories?.name??"อื่น ๆ",isAvailable:m.is_available,popular:m.is_popular})),
  };
}

export async function getOrders() {
  if (!supabase) throw new Error("Supabase is not configured");
  const { data, error } = await supabase.from("orders").select("*, restaurants(name), order_items(item_name,quantity,note)").order("created_at", { ascending:false }).limit(50);
  if (error) throw error;
  return (data ?? []).map((o:any) => ({ id:`OD-${String(o.order_number).padStart(4,"0")}`,dbId:o.id,customer:o.customer_name,restaurant:o.restaurants?.name ?? "ร้านอาหาร",items:o.order_items.map((i:any)=>`${i.item_name} × ${i.quantity}`).join(", "),foodTotal:Number(o.food_total),deliveryFee:Number(o.delivery_fee),gpPercent:Number(o.gp_percent),gpAmount:Number(o.gp_amount),net:Number(o.restaurant_net_income),total:Number(o.grand_total),status:statusToThai[o.status] ?? o.status,time:new Date(o.created_at).toLocaleTimeString("th-TH",{hour:"2-digit",minute:"2-digit"}),note:o.customer_note ?? "" }));
}

export async function createOrder(input:{restaurantId:string;customerName:string;address:string;note:string;deliveryFee:number;items:Array<{id:string;name:string;price:number;quantity:number;note:string}>}) {
  if (!supabase) throw new Error("Supabase is not configured");
  const { data, error } = await supabase.rpc("create_marketplace_order", { p_restaurant_id:input.restaurantId,p_customer_name:input.customerName,p_address:input.address,p_note:input.note,p_delivery_fee:input.deliveryFee,p_items:input.items.map(i=>({menu_item_id:i.id,name:i.name,price:i.price,quantity:i.quantity,note:i.note})) });
  if (error) throw error;
  return data as string;
}

export async function updateOrderStatus(dbId:string|undefined,status:string) {
  if (!supabase || !dbId) return;
  const { error } = await supabase.from("orders").update({ status:statusToDb[status] ?? status }).eq("id",dbId);
  if (error) throw error;
}

export async function setMenuAvailability(id:string,isAvailable:boolean) {
  if (!supabase) return;
  const { error } = await supabase.from("menu_items").update({ is_available:isAvailable }).eq("id",id);
  if (error) throw error;
}

export async function createMenu(input:{restaurantId:string;name:string;price:number}) {
  if (!supabase) return null;
  const { data,error } = await supabase.from("menu_items").insert({ restaurant_id:input.restaurantId,name:input.name,price:input.price,description:"เมนูใหม่ของร้าน",is_available:true }).select().single();
  if(error) throw error;
  return data;
}
