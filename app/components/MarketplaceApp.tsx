"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, BarChart3, Bell, Check, ChevronRight, CircleDollarSign, Clock3, CookingPot,
  Home, LayoutDashboard, MapPin, Menu as MenuIcon, Minus, PackageCheck, Plus, Search,
  Settings, ShieldCheck, ShoppingBag, ShoppingCart, Star, Store, ToggleLeft, ToggleRight,
  Truck, UserRound, Users, UtensilsCrossed, WalletCards, X,
} from "lucide-react";
import { categories, initialMenu, initialOrders, money, restaurants, Role, OrderStatus } from "../data/mockData";

type Screen = "home" | "restaurant" | "cart" | "tracking" | "seller" | "seller-menu" | "seller-orders" | "seller-report" | "seller-shop" | "admin" | "admin-shops" | "admin-users" | "admin-orders" | "admin-gp" | "admin-report";
type CartItem = (typeof initialMenu)[number] & { quantity: number; note: string };

const IconLogo = () => <div className="logo-mark"><UtensilsCrossed size={20} strokeWidth={2.6} /></div>;

export default function MarketplaceApp() {
  const [role, setRole] = useState<Role>("customer");
  const [screen, setScreen] = useState<Screen>("home");
  const [activeCategory, setActiveCategory] = useState("ทั้งหมด");
  const [query, setQuery] = useState("");
  const [selectedRestaurant, setSelectedRestaurant] = useState(restaurants[0]);
  const [menu, setMenu] = useState(initialMenu);
  const [orders, setOrders] = useState(initialOrders);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [toast, setToast] = useState("");
  const [showMenuForm, setShowMenuForm] = useState(false);
  const [gp, setGp] = useState<Record<string, number>>(Object.fromEntries(restaurants.map((r) => [r.id, r.gpPercent])));

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  const go = (next: Screen) => { setScreen(next); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const flash = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2200); };
  const switchRole = (next: Role) => { setRole(next); go(next === "customer" ? "home" : next === "seller" ? "seller" : "admin"); };
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const foodTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = cart.length ? selectedRestaurant.delivery : 0;

  const addToCart = (item: (typeof initialMenu)[number]) => {
    if (item.restaurantId !== selectedRestaurant.id && cart.length) setCart([]);
    setCart((current) => {
      const found = current.find((x) => x.id === item.id);
      return found ? current.map((x) => x.id === item.id ? { ...x, quantity: x.quantity + 1 } : x) : [...current, { ...item, quantity: 1, note: "" }];
    });
    flash(`เพิ่ม “${item.name}” ลงตะกร้าแล้ว`);
  };

  const updateQuantity = (id: string, amount: number) => setCart((current) => current.map((x) => x.id === id ? { ...x, quantity: x.quantity + amount } : x).filter((x) => x.quantity > 0));
  const updateOrder = (id: string, status: OrderStatus) => { setOrders((current) => current.map((o) => o.id === id ? { ...o, status } : o)); flash(`อัปเดต ${id} เป็น “${status}” แล้ว`); };

  const visibleRestaurants = restaurants.filter((r) => `${r.name} ${r.description}`.toLowerCase().includes(query.toLowerCase()));
  const currentMenu = menu.filter((m) => m.restaurantId === selectedRestaurant.id && (activeCategory === "ทั้งหมด" || m.category === activeCategory) && `${m.name} ${m.description}`.includes(query));

  const customerHeader = (
    <header className="topbar customer-topbar">
      <button className="brand" onClick={() => go("home")}><IconLogo /><span>อิ่มดี</span></button>
      <div className="location-pill"><MapPin size={17} /><span><small>จัดส่งที่</small><b>บ้าน · สุขุมวิท 49</b></span></div>
      <div className="header-actions">
        <button className="icon-btn" aria-label="การแจ้งเตือน"><Bell size={21} /><i /></button>
        <button className="cart-button" onClick={() => go("cart")}><ShoppingCart size={20} /><span>ตะกร้า</span>{cartCount > 0 && <b>{cartCount}</b>}</button>
        <RolePicker role={role} onChange={switchRole} />
      </div>
    </header>
  );

  const sellerNav = [
    ["seller", "ภาพรวม", LayoutDashboard], ["seller-orders", "ออเดอร์", ShoppingBag], ["seller-menu", "เมนูอาหาร", CookingPot],
    ["seller-report", "รายงานยอดขาย", BarChart3], ["seller-shop", "ข้อมูลร้าน", Store],
  ] as const;
  const adminNav = [
    ["admin", "ภาพรวมระบบ", LayoutDashboard], ["admin-shops", "ร้านค้า", Store], ["admin-users", "ผู้ใช้งาน", Users],
    ["admin-orders", "ออเดอร์ทั้งหมด", ShoppingBag], ["admin-gp", "ตั้งค่า GP", CircleDollarSign], ["admin-report", "รายงานระบบ", BarChart3],
  ] as const;

  const sidebar = role !== "customer" ? (
    <aside className="sidebar">
      <button className="brand brand-light" onClick={() => go(role === "seller" ? "seller" : "admin")}><IconLogo /><span>อิ่มดี</span></button>
      <div className="workspace-label">{role === "seller" ? "ศูนย์จัดการร้านค้า" : "ผู้ดูแลระบบ"}</div>
      <nav>{(role === "seller" ? sellerNav : adminNav).map(([id, label, Icon]) => <button key={id} className={screen === id ? "active" : ""} onClick={() => go(id)}><Icon size={20} /><span>{label}</span>{id === "seller-orders" && <em>3</em>}</button>)}</nav>
      <div className="sidebar-bottom"><RolePicker role={role} onChange={switchRole} dark /><div className="user-card"><div className="avatar">{role === "seller" ? "อ" : "แ"}</div><span><b>{role === "seller" ? "คุณอรทัย" : "แอดมินหลัก"}</b><small>{role === "seller" ? "ครัวแม่อร" : "ผู้ดูแลระบบ"}</small></span></div></div>
    </aside>
  ) : null;

  const mobileNav = role === "customer" ? (
    <nav className="mobile-nav">
      <button className={screen === "home" || screen === "restaurant" ? "active" : ""} onClick={() => go("home")}><Home size={21} /><span>หน้าหลัก</span></button>
      <button><Search size={21} /><span>ค้นหา</span></button>
      <button className={screen === "tracking" ? "active" : ""} onClick={() => go("tracking")}><ShoppingBag size={21} /><span>ออเดอร์</span></button>
      <button onClick={() => switchRole("seller")}><Store size={21} /><span>ร้านค้า</span></button>
    </nav>
  ) : null;

  return (
    <div className={role === "customer" ? "app customer-app" : "app dashboard-app"}>
      {role === "customer" ? customerHeader : sidebar}
      <main className={role === "customer" ? "main" : "dashboard-main"}>
        {screen === "home" && <CustomerHome restaurants={visibleRestaurants} query={query} setQuery={setQuery} activeCategory={activeCategory} setActiveCategory={setActiveCategory} openRestaurant={(r) => { setSelectedRestaurant(r); setQuery(""); setActiveCategory("ทั้งหมด"); go("restaurant"); }} />}
        {screen === "restaurant" && <RestaurantPage restaurant={selectedRestaurant} menu={currentMenu} activeCategory={activeCategory} setActiveCategory={setActiveCategory} query={query} setQuery={setQuery} addToCart={addToCart} back={() => go("home")} cartCount={cartCount} openCart={() => go("cart")} />}
        {screen === "cart" && <CartPage items={cart} foodTotal={foodTotal} deliveryFee={deliveryFee} updateQuantity={updateQuantity} updateNote={(id, note) => setCart((c) => c.map((x) => x.id === id ? { ...x, note } : x))} back={() => go("restaurant")} checkout={() => { setCart([]); go("tracking"); flash("สั่งอาหารสำเร็จ ร้านได้รับออเดอร์แล้ว"); }} />}
        {screen === "tracking" && <TrackingPage back={() => go("home")} />}

        {screen === "seller" && <SellerDashboard go={go} orders={orders} updateOrder={updateOrder} />}
        {screen === "seller-orders" && <SellerOrders orders={orders} updateOrder={updateOrder} />}
        {screen === "seller-menu" && <SellerMenu menu={menu.filter((m) => m.restaurantId === "r1")} toggle={(id) => setMenu((m) => m.map((x) => x.id === id ? { ...x, isAvailable: !x.isAvailable } : x))} showForm={showMenuForm} setShowForm={setShowMenuForm} addMenu={(name, price) => { setMenu((m) => [...m, { id: `m${Date.now()}`, restaurantId: "r1", name, price, description: "เมนูใหม่ของร้าน", category: "ข้าว", image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80", isAvailable: true, popular: false }]); setShowMenuForm(false); flash("เพิ่มเมนูใหม่แล้ว"); }} />}
        {screen === "seller-report" && <SellerReport />}
        {screen === "seller-shop" && <ShopSettings flash={flash} />}

        {screen === "admin" && <AdminDashboard go={go} />}
        {screen === "admin-shops" && <AdminShops gp={gp} setGp={setGp} flash={flash} />}
        {screen === "admin-users" && <AdminUsers />}
        {screen === "admin-orders" && <SellerOrders orders={orders} updateOrder={updateOrder} admin />}
        {screen === "admin-gp" && <GpSettings gp={gp} setGp={setGp} flash={flash} />}
        {screen === "admin-report" && <AdminReport />}
      </main>
      {mobileNav}
      {toast && <div className="toast"><Check size={18} />{toast}</div>}
    </div>
  );
}

function RolePicker({ role, onChange, dark = false }: { role: Role; onChange: (r: Role) => void; dark?: boolean }) {
  return <select className={`role-picker ${dark ? "dark" : ""}`} aria-label="เปลี่ยนบทบาท" value={role} onChange={(e) => onChange(e.target.value as Role)}><option value="customer">ลูกค้า</option><option value="seller">ผู้ขาย</option><option value="admin">Admin</option></select>;
}

function CustomerHome({ restaurants: shops, query, setQuery, activeCategory, setActiveCategory, openRestaurant }: any) {
  return <>
    <section className="hero">
      <div><span className="eyebrow">ส่งฟรีเมื่อสั่งครบ ฿199</span><h1>มื้อนี้กินอะไรดี?</h1><p>อร่อยกับร้านเด็ดใกล้บ้าน ส่งถึงมือคุณ</p><SearchBox value={query} onChange={setQuery} placeholder="ค้นหาร้าน หรือเมนูที่อยากกิน" /></div>
      <div className="hero-art" aria-hidden="true"><div className="plate">🍜</div><span className="leaf leaf-a">🌿</span><span className="leaf leaf-b">🌶️</span></div>
    </section>
    <section className="section"><div className="section-head"><div><span className="kicker">เลือกตามใจ</span><h2>หมวดหมู่ยอดนิยม</h2></div></div><div className="category-row">{categories.slice(1).map((cat, i) => <button key={cat} className={activeCategory === cat ? "active" : ""} onClick={() => setActiveCategory(activeCategory === cat ? "ทั้งหมด" : cat)}><span>{["🍚", "🍜", "🧋", "🍧", "🍗"][i]}</span><b>{cat}</b></button>)}</div></section>
    <section className="section"><div className="section-head"><div><span className="kicker">ร้านอร่อยใกล้คุณ</span><h2>ร้านแนะนำ</h2></div><button className="text-button">ดูทั้งหมด <ChevronRight size={18} /></button></div><div className="restaurant-grid">{shops.map((r: any) => <article className="restaurant-card" key={r.id} onClick={() => openRestaurant(r)}><div className="card-image"><img src={r.image} alt={r.name} /><span className={r.isOpen ? "open" : "closed"}>{r.isOpen ? "เปิดอยู่" : "ปิดแล้ว"}</span>{r.id === "r1" && <b className="deal">ลด 15%</b>}</div><div className="card-content"><h3>{r.name}</h3><p>{r.description}</p><div className="meta"><span><Star size={16} fill="currentColor" /> {r.rating}</span><span><Clock3 size={16} /> {r.time}</span><span><Truck size={16} /> ฿{r.delivery}</span></div></div></article>)}</div></section>
    <section className="promo"><div><span>สิทธิพิเศษวันนี้</span><h2>อิ่มคุ้มทุกมื้อ</h2><p>รับส่วนลด ฿50 สำหรับออเดอร์แรกของคุณ</p></div><button>เก็บคูปอง</button></section>
  </>;
}

function SearchBox({ value, onChange, placeholder }: any) { return <label className="search-box"><Search size={21} /><input aria-label="ค้นหา" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} /></label>; }

function RestaurantPage({ restaurant, menu, activeCategory, setActiveCategory, query, setQuery, addToCart, back, cartCount, openCart }: any) {
  return <div className="restaurant-page"><button className="back-button" onClick={back}><ArrowLeft size={19} /> กลับไปหน้าร้านทั้งหมด</button><section className="restaurant-hero"><img src={restaurant.image} alt={restaurant.name} /><div className="restaurant-overlay"><span className="open-dot">● เปิดอยู่</span><h1>{restaurant.name}</h1><p>{restaurant.description}</p><div className="meta"><span><Star size={17} fill="currentColor" /> {restaurant.rating} (380+ รีวิว)</span><span><Clock3 size={17} /> {restaurant.time}</span><span><Truck size={17} /> ค่าส่ง ฿{restaurant.delivery}</span></div></div></section><div className="menu-toolbar"><div className="pills">{categories.map((cat) => <button key={cat} className={activeCategory === cat ? "active" : ""} onClick={() => setActiveCategory(cat)}>{cat}</button>)}</div><SearchBox value={query} onChange={setQuery} placeholder="ค้นหาเมนู" /></div><div className="section-head"><div><span className="kicker">เลือกเมนู</span><h2>{activeCategory === "ทั้งหมด" ? "เมนูทั้งหมด" : activeCategory}</h2></div></div><div className="menu-grid">{menu.map((item: any) => <article className="menu-card" key={item.id}><img src={item.image} alt={item.name} /><div><div>{item.popular && <span className="popular">ขายดี</span>}<h3>{item.name}</h3><p>{item.description}</p></div><footer><b>{money(item.price)}</b><button onClick={() => addToCart(item)} aria-label={`เพิ่ม ${item.name}`}><Plus size={20} /></button></footer></div></article>)}</div>{cartCount > 0 && <button className="floating-cart" onClick={openCart}><span><ShoppingCart size={20} /><b>{cartCount} รายการ</b></span><strong>ดูตะกร้า <ChevronRight size={18} /></strong></button>}</div>;
}

function CartPage({ items, foodTotal, deliveryFee, updateQuantity, updateNote, back, checkout }: any) {
  return <div className="narrow-page"><button className="back-button" onClick={back}><ArrowLeft size={19} /> เลือกเมนูเพิ่ม</button><div className="page-title"><div><span className="kicker">ตรวจสอบก่อนสั่ง</span><h1>ตะกร้าของฉัน</h1></div><span>{items.length} เมนู</span></div>{items.length === 0 ? <EmptyCart back={back} /> : <div className="checkout-layout"><section className="cart-list"><div className="order-shop"><Store size={20} /><b>ครัวแม่อร</b><span>รับอาหารใน 20-30 นาที</span></div>{items.map((item: any) => <article className="cart-item" key={item.id}><img src={item.image} alt="" /><div className="cart-info"><h3>{item.name}</h3><b>{money(item.price)}</b><input aria-label={`หมายเหตุ ${item.name}`} value={item.note} onChange={(e) => updateNote(item.id, e.target.value)} placeholder="เพิ่มหมายเหตุ เช่น ไม่เผ็ด ไม่ใส่ผัก" /></div><div className="stepper"><button onClick={() => updateQuantity(item.id, -1)}><Minus size={16} /></button><b>{item.quantity}</b><button onClick={() => updateQuantity(item.id, 1)}><Plus size={16} /></button></div></article>)}</section><aside className="summary-card"><h2>สรุปคำสั่งซื้อ</h2><label className="address-card"><MapPin size={21} /><span><small>จัดส่งที่</small><b>บ้าน · สุขุมวิท 49</b><em>แก้ไข</em></span></label><div className="summary-lines"><span>ค่าอาหาร <b>{money(foodTotal)}</b></span><span>ค่าจัดส่ง <b>{money(deliveryFee)}</b></span><span className="discount">ส่วนลด <b>-฿20</b></span></div><div className="grand-total"><span>ยอดชำระทั้งหมด<small>รวมภาษีแล้ว</small></span><b>{money(foodTotal + deliveryFee - 20)}</b></div><button className="primary-button" onClick={checkout}>ยืนยันคำสั่งซื้อ <ChevronRight size={20} /></button><p className="tiny-note">ค่า GP {selectedRestaurantGp()}% คำนวณจากยอดอาหารและหักจากรายรับร้านค้า ไม่เพิ่มในยอดชำระของคุณ</p></aside></div>}</div>;
}
const selectedRestaurantGp = () => 15;
function EmptyCart({ back }: any) { return <div className="empty-state"><div>🛒</div><h2>ตะกร้ายังว่างอยู่</h2><p>เลือกเมนูอร่อย ๆ แล้วกลับมาที่นี่นะ</p><button className="primary-button" onClick={back}>เลือกเมนูอาหาร</button></div>; }

function TrackingPage({ back }: any) {
  const steps = [["ร้านรับออเดอร์แล้ว", "10:43", Check], ["กำลังทำอาหาร", "โดยประมาณ 15 นาที", CookingPot], ["พร้อมส่ง", "", PackageCheck], ["กำลังจัดส่ง", "", Truck]] as const;
  return <div className="narrow-page tracking"><button className="back-button" onClick={back}><ArrowLeft size={19} /> กลับหน้าหลัก</button><div className="tracking-head"><span className="live-dot">● อัปเดตล่าสุด</span><h1>ร้านกำลังทำอาหารของคุณ</h1><p>คาดว่าจะได้รับประมาณ 11:10 น.</p><div className="time-badge">อีกประมาณ <b>22 นาที</b></div></div><section className="tracking-card"><div className="track-steps">{steps.map(([label, time, Icon], i) => <div className={i < 2 ? "done" : ""} key={label}><span><Icon size={19} /></span><p><b>{label}</b><small>{time}</small></p></div>)}</div><div className="driver-card"><div className="avatar">ส</div><span><small>ผู้จัดส่งของคุณ</small><b>คุณสมชาย · Honda Wave</b><em>กข 1234 กรุงเทพฯ</em></span><button>โทร</button></div></section><section className="order-mini"><div><span>ออเดอร์ #OD-1049</span><b>ครัวแม่อร</b></div><span>3 รายการ <b>฿190</b></span></section></div>;
}

function DashboardTop({ title, subtitle }: { title: string; subtitle: string }) { return <div className="dashboard-top"><div><p>{subtitle}</p><h1>{title}</h1></div><div><button className="icon-btn"><Bell size={21} /><i /></button><span className="date-pill"><Clock3 size={17} /> วันนี้ 13 ก.ค. 2569</span></div></div>; }
function StatCard({ label, value, change, icon: Icon, tone = "orange" }: any) { return <article className={`stat-card ${tone}`}><div className="stat-icon"><Icon size={22} /></div><p>{label}</p><h2>{value}</h2><span>{change}</span></article>; }

function SellerDashboard({ go, orders, updateOrder }: any) {
  const newOrder = orders.find((o: any) => o.status === "รอรับออเดอร์");
  return <><DashboardTop title="สวัสดี คุณอรทัย 👋" subtitle="ภาพรวมร้านครัวแม่อร" /><div className="shop-status"><div><span className="pulse" /><p><b>ร้านเปิดอยู่</b><small>เปิดรับออเดอร์ตามปกติ · ปิด 20:30 น.</small></p></div><button><ToggleRight size={30} /> เปิดรับออเดอร์</button></div><div className="stats-grid seller-stats"><StatCard label="ยอดขายวันนี้" value="฿8,450" change="↑ 12.5% จากเมื่อวาน" icon={WalletCards} /><StatCard label="ออเดอร์วันนี้" value="42" change="3 ออเดอร์ใหม่" icon={ShoppingBag} tone="blue" /><StatCard label="ค่า GP (15%)" value="฿1,267.50" change="จากยอดอาหารทั้งหมด" icon={CircleDollarSign} tone="purple" /><StatCard label="รายได้สุทธิ" value="฿7,182.50" change="หลังหักค่า GP" icon={BarChart3} tone="green" /></div>{newOrder && <section className="urgent-order"><div className="urgent-head"><span><i /> ออเดอร์ใหม่</span><b>เข้ามาเมื่อ 1 นาทีที่แล้ว</b></div><div className="urgent-body"><div className="order-number"><small>หมายเลขออเดอร์</small><h2>#{newOrder.id}</h2><span><Clock3 size={17} /> รับอาหาร 11:10 น.</span></div><div className="order-detail"><h3>{newOrder.customer}</h3><p>{newOrder.items}</p><span>หมายเหตุ: {newOrder.note}</span></div><div className="order-total"><small>ยอดรวม</small><h2>{money(newOrder.total)}</h2></div></div><div className="order-actions"><button className="reject" onClick={() => updateOrder(newOrder.id, "ยกเลิก")}><X size={19} /> ปฏิเสธ</button><button className="accept" onClick={() => updateOrder(newOrder.id, "กำลังทำอาหาร")}><Check size={20} /> รับออเดอร์</button></div></section>}<div className="dashboard-grid"><section className="panel"><div className="panel-head"><div><h2>ออเดอร์ล่าสุด</h2><p>ติดตามและจัดการออเดอร์วันนี้</p></div><button className="text-button" onClick={() => go("seller-orders")}>ดูทั้งหมด <ChevronRight size={18} /></button></div><OrderTable orders={orders.slice(0, 3)} /></section><section className="panel quick-panel"><div className="panel-head"><div><h2>จัดการด่วน</h2><p>เมนูที่ใช้บ่อย</p></div></div><button onClick={() => go("seller-menu")}><span><CookingPot size={22} /></span><p><b>จัดการเมนู</b><small>เพิ่ม แก้ไข เปิด-ปิดเมนู</small></p><ChevronRight /></button><button onClick={() => go("seller-report")}><span><BarChart3 size={22} /></span><p><b>ดูรายงานยอดขาย</b><small>ยอดขาย GP และรายได้สุทธิ</small></p><ChevronRight /></button><button onClick={() => go("seller-shop")}><span><Settings size={22} /></span><p><b>ตั้งค่าร้านค้า</b><small>เวลาเปิด-ปิด และข้อมูลร้าน</small></p><ChevronRight /></button></section></div></>;
}

function OrderTable({ orders }: any) { return <div className="table-wrap"><table><thead><tr><th>ออเดอร์</th><th>ลูกค้า</th><th>รายการ</th><th>ยอดรวม</th><th>สถานะ</th></tr></thead><tbody>{orders.map((o: any) => <tr key={o.id}><td><b>#{o.id}</b><small>{o.time} น.</small></td><td>{o.customer}</td><td className="truncate-cell">{o.items}</td><td><b>{money(o.total)}</b></td><td><Status status={o.status} /></td></tr>)}</tbody></table></div>; }
function Status({ status }: { status: string }) { const key = status === "รอรับออเดอร์" ? "wait" : status === "กำลังทำอาหาร" ? "cook" : status === "พร้อมส่ง" ? "ready" : status === "สำเร็จ" ? "success" : status === "ยกเลิก" ? "cancel" : "delivery"; return <span className={`status ${key}`}>{status}</span>; }

function SellerOrders({ orders, updateOrder, admin = false }: any) { return <><DashboardTop title={admin ? "ออเดอร์ทั้งหมด" : "จัดการออเดอร์"} subtitle={admin ? "ติดตามคำสั่งซื้อทั้งระบบ" : "วันนี้มี 3 ออเดอร์ที่ต้องดูแล"} /><div className="filter-tabs"><button className="active">ทั้งหมด <b>{orders.length}</b></button><button>ออเดอร์ใหม่ <b>1</b></button><button>กำลังทำ <b>1</b></button><button>พร้อมส่ง <b>1</b></button></div><div className="order-board">{orders.map((o: any) => <article className="order-card-large" key={o.id}><header><div><Status status={o.status} /><h2>#{o.id}</h2><span>{o.time} น.</span></div><b>{money(o.total)}</b></header><div className="order-customer"><UserRound size={19} /><span><b>{o.customer}</b><small>{admin ? o.restaurant : "ลูกค้าประจำ · 8 ออเดอร์"}</small></span></div><div className="order-items"><p>{o.items}</p><span>หมายเหตุ: {o.note}</span></div><footer>{o.status === "รอรับออเดอร์" && <><button className="reject" onClick={() => updateOrder(o.id, "ยกเลิก")}>ปฏิเสธ</button><button className="accept" onClick={() => updateOrder(o.id, "กำลังทำอาหาร")}>รับออเดอร์</button></>}{o.status === "กำลังทำอาหาร" && <button className="accept full" onClick={() => updateOrder(o.id, "พร้อมส่ง")}>อาหารพร้อมแล้ว</button>}{o.status === "พร้อมส่ง" && <button className="accept full" onClick={() => updateOrder(o.id, "กำลังจัดส่ง")}>ส่งให้ไรเดอร์แล้ว</button>}</footer></article>)}</div></>;
}

function SellerMenu({ menu, toggle, showForm, setShowForm, addMenu }: any) { const [name, setName] = useState(""); const [price, setPrice] = useState("75"); return <><DashboardTop title="เมนูอาหาร" subtitle={`${menu.length} เมนู · เปิดขาย ${menu.filter((m: any) => m.isAvailable).length} เมนู`} /><div className="page-actions"><SearchBox value="" onChange={() => null} placeholder="ค้นหาเมนู" /><button className="primary-button fit" onClick={() => setShowForm(true)}><Plus size={19} /> เพิ่มเมนูใหม่</button></div><div className="manage-menu-grid">{menu.map((item: any) => <article key={item.id}><img src={item.image} alt={item.name} /><div><span className="menu-category">{item.category}</span><h3>{item.name}</h3><b>{money(item.price)}</b></div><footer><button className={item.isAvailable ? "available" : "unavailable"} onClick={() => toggle(item.id)}>{item.isAvailable ? <ToggleRight size={27} /> : <ToggleLeft size={27} />}{item.isAvailable ? "เปิดขาย" : "ปิดขาย"}</button><button className="ghost-button">แก้ไข</button></footer></article>)}</div>{showForm && <div className="modal-backdrop"><form className="modal" onSubmit={(e) => { e.preventDefault(); addMenu(name, Number(price)); }}><button type="button" className="close" onClick={() => setShowForm(false)}><X /></button><span className="kicker">เพิ่มรายการอาหาร</span><h2>เมนูใหม่</h2><label>ชื่อเมนู<input required value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น ข้าวกะเพราไก่" /></label><label>ราคา (บาท)<input required type="number" value={price} onChange={(e) => setPrice(e.target.value)} /></label><label>หมวดหมู่<select><option>ข้าว</option><option>เส้น</option><option>เครื่องดื่ม</option></select></label><label className="upload-box"><Plus /> แตะเพื่อเพิ่มรูปอาหาร<input type="file" accept="image/*" /></label><button className="primary-button" type="submit">บันทึกเมนู</button></form></div>}</>;
}

function MiniChart() { return <div className="chart"><div className="chart-grid" /><div className="chart-bars">{[38, 52, 45, 68, 62, 80, 91].map((h, i) => <span key={i} style={{ height: `${h}%` }}><i /></span>)}</div><div className="chart-labels">{["จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."].map((d) => <span key={d}>{d}</span>)}</div></div>; }
function SellerReport() { return <><DashboardTop title="รายงานยอดขาย" subtitle="สรุปผลงานร้านครัวแม่อร" /><div className="filter-tabs"><button>วันนี้</button><button className="active">7 วัน</button><button>เดือนนี้</button><button>กำหนดเอง</button></div><div className="stats-grid"><StatCard label="ยอดขายรวม" value="฿52,640" change="↑ 8.2% จากสัปดาห์ก่อน" icon={WalletCards} /><StatCard label="ค่า GP" value="฿7,896" change="อัตรา GP 15%" icon={CircleDollarSign} tone="purple" /><StatCard label="รายได้สุทธิ" value="฿44,744" change="ก่อนค่าใช้จ่ายร้าน" icon={BarChart3} tone="green" /></div><section className="panel chart-panel"><div className="panel-head"><div><h2>ยอดขาย 7 วันล่าสุด</h2><p>ยอดขายรวมต่อวัน</p></div><b>เฉลี่ย ฿7,520/วัน</b></div><MiniChart /></section></>;
}

function ShopSettings({ flash }: any) { return <><DashboardTop title="ข้อมูลร้านค้า" subtitle="จัดการข้อมูลที่ลูกค้าเห็น" /><form className="settings-form" onSubmit={(e) => { e.preventDefault(); flash("บันทึกข้อมูลร้านแล้ว"); }}><div className="shop-cover"><img src={restaurants[0].image} alt="ครัวแม่อร" /><button type="button">เปลี่ยนรูปร้าน</button></div><div className="form-grid"><label>ชื่อร้าน<input defaultValue="ครัวแม่อร" /></label><label>เบอร์โทร<input defaultValue="081-234-5678" /></label><label className="full">คำอธิบายร้าน<textarea defaultValue="อาหารตามสั่งรสมือแม่ วัตถุดิบสดใหม่ทุกวัน" /></label><label>เวลาเปิด<input type="time" defaultValue="08:00" /></label><label>เวลาปิด<input type="time" defaultValue="20:30" /></label><label className="full">ที่อยู่<textarea defaultValue="49 ถนนสุขุมวิท แขวงคลองตันเหนือ เขตวัฒนา กรุงเทพฯ" /></label></div><button className="primary-button fit">บันทึกข้อมูลร้าน</button></form></>;
}

function AdminDashboard({ go }: any) { return <><DashboardTop title="ภาพรวมระบบ" subtitle="ข้อมูลอิ่มดีแบบเรียลไทม์" /><div className="stats-grid admin-stats"><StatCard label="ยอดขายรวมเดือนนี้" value="฿1.84M" change="↑ 14.2% จากเดือนก่อน" icon={WalletCards} /><StatCard label="GP ที่ระบบได้รับ" value="฿284,620" change="เฉลี่ย 15.5%" icon={CircleDollarSign} tone="purple" /><StatCard label="ร้านค้าทั้งหมด" value="248" change="8 ร้านรออนุมัติ" icon={Store} tone="blue" /><StatCard label="ออเดอร์ทั้งหมด" value="12,842" change="186 ออเดอร์วันนี้" icon={ShoppingBag} tone="green" /></div><div className="dashboard-grid admin-grid"><section className="panel chart-panel"><div className="panel-head"><div><h2>ยอดขายทั้งระบบ</h2><p>7 วันล่าสุด</p></div><b className="success-text">↑ 12.8%</b></div><MiniChart /></section><section className="panel action-list"><div className="panel-head"><div><h2>รายการที่ต้องดำเนินการ</h2><p>ตรวจสอบและจัดการทันที</p></div></div><button onClick={() => go("admin-shops")}><span className="warning-icon"><Store /></span><p><b>ร้านค้ารออนุมัติ</b><small>มี 8 ร้านที่รอการตรวจสอบ</small></p><strong>8</strong><ChevronRight /></button><button onClick={() => go("admin-orders")}><span className="blue-icon"><ShoppingBag /></span><p><b>ออเดอร์มีปัญหา</b><small>ต้องการความช่วยเหลือจากระบบ</small></p><strong>3</strong><ChevronRight /></button><button onClick={() => go("admin-gp")}><span className="purple-icon"><Settings /></span><p><b>ตั้งค่า GP ร้านค้า</b><small>จัดการอัตราค่าบริการ</small></p><ChevronRight /></button></section></div><section className="panel"><div className="panel-head"><div><h2>ร้านค้ายอดขายสูงสุด</h2><p>ประจำเดือนกรกฎาคม</p></div><button className="text-button" onClick={() => go("admin-report")}>ดูรายงาน <ChevronRight /></button></div><div className="ranking">{restaurants.slice(0, 3).map((r, i) => <div key={r.id}><b className="rank">{i + 1}</b><img src={r.image} alt="" /><span><b>{r.name}</b><small>{452 - i * 67} ออเดอร์</small></span><strong>{money(148200 - i * 17350)}</strong></div>)}</div></section></>;
}

function AdminShops({ gp, setGp, flash }: any) { return <><DashboardTop title="จัดการร้านค้า" subtitle="248 ร้าน · รออนุมัติ 8 ร้าน" /><div className="page-actions"><SearchBox value="" onChange={() => null} placeholder="ค้นหาชื่อร้าน หรือเจ้าของร้าน" /><button className="ghost-button"><MenuIcon size={18} /> ตัวกรอง</button></div><section className="panel"><div className="table-wrap"><table><thead><tr><th>ร้านค้า</th><th>สถานะ</th><th>ยอดขายเดือนนี้</th><th>GP</th><th>จัดการ</th></tr></thead><tbody>{restaurants.map((r) => <tr key={r.id}><td><div className="shop-cell"><img src={r.image} alt="" /><span><b>{r.name}</b><small>เจ้าของ: คุณ{r.id === "r1" ? "อรทัย" : "สมใจ"}</small></span></div></td><td><Status status={r.status === "approved" ? "อนุมัติแล้ว" : "รอตรวจสอบ"} /></td><td><b>{money(48200 - Number(r.id.slice(1)) * 4300)}</b></td><td><select value={gp[r.id]} onChange={(e) => setGp({ ...gp, [r.id]: Number(e.target.value) })}>{[10, 15, 20, 25].map((n) => <option key={n} value={n}>{n}%</option>)}</select></td><td>{r.status === "pending" ? <button className="small-primary" onClick={() => flash(`อนุมัติร้าน ${r.name} แล้ว`)}>อนุมัติ</button> : <button className="ghost-button small">ดูข้อมูล</button>}</td></tr>)}</tbody></table></div></section></>;
}

function AdminUsers() { const users = [["ณิชา สายใจ", "ลูกค้า", "12 ออเดอร์", "13 ก.ค. 2569"], ["อรทัย ใจดี", "ผู้ขาย", "ครัวแม่อร", "2 ก.พ. 2569"], ["ศุภชัย มั่นคง", "ลูกค้า", "8 ออเดอร์", "8 ก.ค. 2569"], ["พิมพ์ชนก แสงทอง", "ผู้ขาย", "บ้านหวานละมุน", "15 มี.ค. 2569"]]; return <><DashboardTop title="จัดการผู้ใช้งาน" subtitle="ลูกค้า 18,420 คน · ผู้ขาย 248 คน" /><div className="page-actions"><SearchBox value="" onChange={() => null} placeholder="ค้นหาชื่อ เบอร์โทร หรืออีเมล" /></div><section className="panel"><div className="table-wrap"><table><thead><tr><th>ชื่อผู้ใช้งาน</th><th>บทบาท</th><th>ข้อมูล</th><th>สมัครเมื่อ</th><th>สถานะ</th></tr></thead><tbody>{users.map((u) => <tr key={u[0]}><td><div className="user-row"><div className="avatar">{u[0][0]}</div><b>{u[0]}</b></div></td><td><span className="role-tag">{u[1]}</span></td><td>{u[2]}</td><td>{u[3]}</td><td><span className="status success">ใช้งานปกติ</span></td></tr>)}</tbody></table></div></section></>;
}

function GpSettings({ gp, setGp, flash }: any) { const [defaultGp, setDefaultGp] = useState(15); return <><DashboardTop title="ตั้งค่าค่า GP" subtitle="กำหนดค่าบริการระบบสำหรับร้านค้า" /><section className="gp-banner"><div><CircleDollarSign size={28} /><span><b>GP เริ่มต้นของระบบ</b><small>ใช้กับร้านค้าใหม่ที่ยังไม่ได้กำหนดอัตราเฉพาะ</small></span></div><div className="gp-choice">{[10, 15, 20, 25].map((n) => <button className={defaultGp === n ? "active" : ""} onClick={() => setDefaultGp(n)} key={n}>{n}%</button>)}</div></section><section className="panel"><div className="panel-head"><div><h2>อัตรา GP รายร้าน</h2><p>ร้านค้าแต่ละแห่งสามารถมีอัตราไม่เท่ากันได้</p></div><button className="primary-button fit" onClick={() => flash("บันทึกการตั้งค่า GP แล้ว")}>บันทึกการเปลี่ยนแปลง</button></div><div className="gp-list">{restaurants.map((r) => <div key={r.id}><img src={r.image} alt="" /><span><b>{r.name}</b><small>ยอดขายเดือนนี้ {money(78500 - Number(r.id.slice(1)) * 5400)}</small></span><select value={gp[r.id]} onChange={(e) => setGp({ ...gp, [r.id]: Number(e.target.value) })}>{[10, 15, 20, 25].map((n) => <option key={n} value={n}>{n}%</option>)}</select><strong>GP เดือนนี้<br />{money((78500 - Number(r.id.slice(1)) * 5400) * gp[r.id] / 100)}</strong></div>)}</div></section><div className="formula-card"><ShieldCheck size={25} /><div><b>สูตรการคำนวณที่โปร่งใส</b><p>GP = ยอดอาหารรวม × เปอร์เซ็นต์ GP · รายได้สุทธิร้าน = ยอดอาหารรวม − GP</p></div></div></>;
}

function AdminReport() { return <><DashboardTop title="รายงานระบบ" subtitle="ภาพรวมผลประกอบการและข้อมูลเชิงลึก" /><div className="filter-tabs"><button>7 วัน</button><button className="active">เดือนนี้</button><button>ไตรมาส</button><button>กำหนดเอง</button></div><div className="stats-grid"><StatCard label="ยอดขายรวม" value="฿1,835,420" change="↑ 14.2%" icon={WalletCards} /><StatCard label="GP รวม" value="฿284,620" change="15.5% ของยอดขาย" icon={CircleDollarSign} tone="purple" /><StatCard label="ลูกค้าใหม่" value="1,248" change="↑ 9.8%" icon={Users} tone="blue" /></div><div className="dashboard-grid"><section className="panel chart-panel"><div className="panel-head"><div><h2>ยอดขายรายวัน</h2><p>เทียบกับเดือนก่อน</p></div></div><MiniChart /></section><section className="panel"><div className="panel-head"><div><h2>เมนูขายดีที่สุด</h2><p>ตามจำนวนที่ขาย</p></div></div><div className="best-menu">{initialMenu.slice(0, 4).map((m, i) => <div key={m.id}><b>{i + 1}</b><img src={m.image} alt="" /><span><strong>{m.name}</strong><small>{184 - i * 21} จาน</small></span><em>{money((184 - i * 21) * m.price)}</em></div>)}</div></section></div></>;
}
