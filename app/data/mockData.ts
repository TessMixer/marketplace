export type Role = "customer" | "seller" | "admin";
export type OrderStatus = "รอร้านรับออเดอร์" | "ร้านรับออเดอร์แล้ว" | "กำลังทำอาหาร" | "พร้อมรับอาหารที่ร้าน" | "สำเร็จ" | "ร้านปฏิเสธ" | "ยกเลิกแล้ว";

export const categories = ["ทั้งหมด", "ข้าว", "เส้น", "เครื่องดื่ม", "ของหวาน", "ของทอด"];

export const restaurants = [
  { id: "r1", name: "ครัวแม่อร", description: "อาหารตามสั่งรสมือแม่ วัตถุดิบสดใหม่ทุกวัน", image: "https://images.unsplash.com/photo-1562565652-a0d8f0c59eb4?auto=format&fit=crop&w=1000&q=80", rating: 4.8, time: "20-30 นาที", isOpen: true, status: "approved", gpPercent: 15 },
  { id: "r2", name: "ก๋วยเตี๋ยวเรืออยุธยา", description: "น้ำซุปเข้มข้น สูตรดั้งเดิม ชามต่อชาม", image: "https://images.unsplash.com/photo-1555126634-323283e090fa?auto=format&fit=crop&w=1000&q=80", rating: 4.7, time: "15-25 นาที", isOpen: true, status: "approved", gpPercent: 20 },
  { id: "r3", name: "บ้านหวานละมุน", description: "ขนมไทยและเครื่องดื่ม หวานน้อย อร่อยพอดี", image: "https://images.unsplash.com/photo-1579954115545-a95591f28bfc?auto=format&fit=crop&w=1000&q=80", rating: 4.9, time: "25-35 นาที", isOpen: true, status: "approved", gpPercent: 15 },
  { id: "r4", name: "ไก่ทอดกรอบกร๊วบ", description: "ทอดใหม่ทุกออเดอร์ กรอบนอกฉ่ำใน", image: "https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=1000&q=80", rating: 4.6, time: "20-30 นาที", isOpen: false, status: "pending", gpPercent: 10 },
];

export const initialMenu = [
  { id: "m1", restaurantId: "r1", name: "ข้าวกะเพราหมูสับไข่ดาว", description: "กะเพราหอม ๆ ผัดพริกแห้ง เลือกระดับความเผ็ดได้", price: 75, category: "ข้าว", image: "https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?auto=format&fit=crop&w=600&q=80", isAvailable: true, popular: true },
  { id: "m2", restaurantId: "r1", name: "ข้าวผัดปู", description: "เนื้อปูแน่น ข้าวร่วนหอมกระทะ", price: 95, category: "ข้าว", image: "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=600&q=80", isAvailable: true, popular: true },
  { id: "m3", restaurantId: "r1", name: "ต้มยำกุ้งน้ำข้น", description: "กุ้งสด รสจัดจ้าน หอมสมุนไพร", price: 145, category: "ข้าว", image: "https://images.unsplash.com/photo-1548943487-a2e4e43b4853?auto=format&fit=crop&w=600&q=80", isAvailable: true, popular: false },
  { id: "m4", restaurantId: "r1", name: "ชาไทยเย็น", description: "ชาเข้ม หอมนม หวานกำลังดี", price: 45, category: "เครื่องดื่ม", image: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=600&q=80", isAvailable: true, popular: false },
  { id: "m5", restaurantId: "r2", name: "ก๋วยเตี๋ยวเรือน้ำตก", description: "เลือกเส้นและเนื้อสัตว์ได้", price: 60, category: "เส้น", image: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=600&q=80", isAvailable: true, popular: true },
  { id: "m6", restaurantId: "r3", name: "บัวลอยไข่หวาน", description: "แป้งนุ่ม กะทิสด หอมควันเทียน", price: 55, category: "ของหวาน", image: "https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=600&q=80", isAvailable: true, popular: true },
];

export const initialOrders = [
  { id: "OD-1048", customer: "ณิชา", restaurant: "ครัวแม่อร", items: "กะเพราหมูสับไข่ดาว × 2, ชาไทยเย็น × 1", foodTotal: 195, gpPercent: 15, gpAmount: 29.25, net: 165.75, status: "รอร้านรับออเดอร์" as OrderStatus, time: "10:42", note: "กะเพราจานแรกไม่เผ็ด ไม่ใส่ถั่วฝักยาว" },
  { id: "OD-1047", customer: "ศุภชัย", restaurant: "ครัวแม่อร", items: "ข้าวผัดปู × 1", foodTotal: 95, gpPercent: 15, gpAmount: 14.25, net: 80.75, status: "กำลังทำอาหาร" as OrderStatus, time: "10:31", note: "ขอพริกน้ำปลาเพิ่ม" },
  { id: "OD-1046", customer: "ปรียา", restaurant: "ก๋วยเตี๋ยวเรืออยุธยา", items: "ก๋วยเตี๋ยวเรือน้ำตก × 3", foodTotal: 180, gpPercent: 20, gpAmount: 36, net: 144, status: "พร้อมรับอาหารที่ร้าน" as OrderStatus, time: "10:18", note: "แยกผักทุกชาม" },
];

export const money = (n: number) => new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);
