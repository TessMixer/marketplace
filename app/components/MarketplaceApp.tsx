"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { FormEvent, useEffect, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  Bell,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  CookingPot,
  Home,
  LayoutDashboard,
  LogOut,
  MapPin,
  Minus,
  PackageCheck,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Star,
  Store,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Truck,
  UserRound,
  Users,
  UtensilsCrossed,
  WalletCards,
  X,
} from "lucide-react";
import AuthScreen from "../auth/AuthScreen";
import { useAuth } from "../auth/AuthProvider";
import { categories as mockCategories, initialMenu, initialOrders, money, restaurants as mockRestaurants, Role } from "../data/mockData";
import { isSupabaseConfigured } from "../lib/supabase";
import {
  Category,
  createMenu,
  createOrder,
  deleteMenu,
  DeliveryQuote,
  getAdminReport,
  getCatalog,
  getCategories,
  getDeliveryQuote,
  getOrders,
  getProfiles,
  getSellerReport,
  getSellerWorkspace,
  listAdminRestaurants,
  MenuItem,
  Order,
  OrderStatusDb,
  ProfileRow,
  Restaurant,
  RestaurantStatus,
  updateMenu,
  updateOrderStatus,
  updateRestaurantAdmin,
  updateSellerRestaurant,
} from "../services/marketplaceRepository";

type Screen =
  | "home"
  | "restaurant"
  | "cart"
  | "tracking"
  | "seller"
  | "seller-menu"
  | "seller-orders"
  | "seller-report"
  | "seller-shop"
  | "admin"
  | "admin-shops"
  | "admin-users"
  | "admin-orders"
  | "admin-gp"
  | "admin-report";

type CartItem = MenuItem & { quantity: number; note: string };

const IconLogo = () => (
  <div className="logo-mark">
    <UtensilsCrossed size={20} strokeWidth={2.6} />
  </div>
);

const statusText: Record<OrderStatusDb, string> = {
  pending: "รอร้านรับออเดอร์",
  accepted: "ร้านรับออเดอร์แล้ว",
  preparing: "กำลังทำอาหาร",
  ready: "พร้อมส่ง",
  completed: "สำเร็จ",
  rejected: "ร้านปฏิเสธ",
  cancelled: "ยกเลิก",
};

const shopStatusText: Record<RestaurantStatus, string> = {
  pending: "รออนุมัติ",
  approved: "อนุมัติแล้ว",
  suspended: "ระงับ",
};

const roleLabel = (role: Role) => (role === "customer" ? "ลูกค้า" : role === "seller" ? "ผู้ขาย" : "ผู้ดูแลระบบ");

function toRestaurant(row: (typeof mockRestaurants)[number]): Restaurant {
  return {
    id: row.id,
    ownerId: null,
    name: row.name,
    description: row.description,
    image: row.image,
    address: "",
    phone: "",
    openTime: "08:00",
    closeTime: "20:00",
    isOpen: row.isOpen,
    status: row.status as RestaurantStatus,
    gpPercent: row.gpPercent,
    rating: row.rating,
    delivery: row.delivery,
    time: row.time,
    latitude: null,
    longitude: null,
    locationAddress: "",
    locationUpdatedAt: null,
    createdAt: new Date().toISOString(),
  };
}

function toMenuItem(row: (typeof initialMenu)[number]): MenuItem {
  return {
    id: row.id,
    restaurantId: row.restaurantId,
    categoryId: null,
    category: row.category,
    name: row.name,
    description: row.description,
    price: row.price,
    image: row.image,
    isAvailable: row.isAvailable,
    isDeleted: false,
    popular: row.popular,
    createdAt: new Date().toISOString(),
  };
}

function toOrder(row: (typeof initialOrders)[number]): Order {
  return {
    id: row.id,
    dbId: "",
    orderNumber: Number(row.id.replace(/\D/g, "")),
    customer: row.customer,
    restaurant: row.restaurant,
    restaurantId: "r1",
    items: row.items,
    itemDetails: [],
    foodTotal: row.foodTotal,
    deliveryFee: row.deliveryFee,
    gpPercent: row.gpPercent,
    gpAmount: row.gpAmount,
    net: row.net,
    total: row.total,
    status: "pending",
    time: row.time,
    createdAt: new Date().toISOString(),
    note: row.note,
    address: "บ้าน · สุขุมวิท 49",
    deliveryLatitude: null,
    deliveryLongitude: null,
    restaurantLatitude: null,
    restaurantLongitude: null,
    deliveryDistanceKm: null,
  };
}

const emptySellerSummary = {
  today: { orders: 0, food_total: 0, gp_amount: 0, net_income: 0 },
  month: { orders: 0, food_total: 0, gp_amount: 0, net_income: 0 },
  last_7_days: [] as Array<{ label: string; food_total: number; gp_amount: number; net_income: number }>,
};

const emptyAdminSummary = {
  today: { orders: 0, food_total: 0, gp_amount: 0, net_income: 0 },
  month: { orders: 0, food_total: 0, gp_amount: 0, net_income: 0 },
  restaurants: { pending: 0, approved: 0, suspended: 0 },
  top_restaurants: [] as Array<{ id: string; name: string; food_total: number; orders: number }>,
  top_menu_items: [] as Array<{ name: string; quantity: number; food_total: number }>,
};

export default function MarketplaceApp() {
  const { session, profile, profileError, loading: authLoading, configured, signOut, refreshProfile } = useAuth();
  const [screen, setScreen] = useState<Screen>("home");
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("ทั้งหมด");
  const [restaurants, setRestaurants] = useState<Restaurant[]>(mockRestaurants.map(toRestaurant).filter((r) => r.status === "approved"));
  const [adminRestaurants, setAdminRestaurants] = useState<Restaurant[]>(mockRestaurants.map(toRestaurant));
  const [categories, setCategories] = useState<Category[]>(mockCategories.slice(1).map((name) => ({ id: name, name, icon: null })));
  const [menu, setMenu] = useState<MenuItem[]>(initialMenu.map(toMenuItem));
  const [orders, setOrders] = useState<Order[]>(initialOrders.map(toOrder));
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [sellerRestaurant, setSellerRestaurant] = useState<Restaurant | null>(null);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(restaurants[0] ?? null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkoutAddress, setCheckoutAddress] = useState("บ้าน · สุขุมวิท 49");
  const [checkoutNote, setCheckoutNote] = useState("");
  const [checkoutLatitude, setCheckoutLatitude] = useState<number | null>(null);
  const [checkoutLongitude, setCheckoutLongitude] = useState<number | null>(null);
  const [deliveryQuote, setDeliveryQuote] = useState<DeliveryQuote>({ distanceKm: null, deliveryFee: 20, restaurantHasLocation: false, usesGps: false });
  const [locationState, setLocationState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [dataSource, setDataSource] = useState<"loading" | "supabase" | "mock">(isSupabaseConfigured ? "loading" : "mock");
  const [sellerSummary, setSellerSummary] = useState(emptySellerSummary);
  const [adminSummary, setAdminSummary] = useState(emptyAdminSummary);

  const role = profile?.role ?? "customer";

  const go = (next: Screen) => {
    const allowed =
      role === "admin"
        ? next.startsWith("admin")
        : role === "seller"
          ? next.startsWith("seller")
          : ["home", "restaurant", "cart", "tracking"].includes(next);
    setScreen(allowed ? next : role === "admin" ? "admin" : role === "seller" ? "seller" : "home");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const flash = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  };

  const loadSharedData = async () => {
    if (!isSupabaseConfigured) return;
    const [categoryRows, catalog, orderRows] = await Promise.all([getCategories(), getCatalog(), getOrders()]);
    setCategories(categoryRows);
    setRestaurants(catalog.restaurants);
    setMenu(catalog.menu);
    setOrders(orderRows);
    setSelectedRestaurant((current) => catalog.restaurants.find((shop) => shop.id === current?.id) ?? catalog.restaurants[0] ?? null);
    setDataSource("supabase");
  };

  const loadSellerData = async () => {
    if (!profile) return;
    const [workspace, orderRows] = await Promise.all([getSellerWorkspace(profile.id), getOrders()]);
    setSellerRestaurant(workspace.restaurant);
    if (workspace.restaurant) {
      setRestaurants([workspace.restaurant]);
      setSelectedRestaurant(workspace.restaurant);
      setMenu(workspace.menu);
      setSellerSummary(await getSellerReport(workspace.restaurant.id));
    }
    setOrders(orderRows);
    setDataSource("supabase");
  };

  const loadAdminData = async () => {
    const [shopRows, orderRows, profileRows, report] = await Promise.all([listAdminRestaurants(), getOrders(), getProfiles(), getAdminReport()]);
    setAdminRestaurants(shopRows);
    setOrders(orderRows);
    setUsers(profileRows);
    setAdminSummary(report);
    setDataSource("supabase");
  };

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!configured || !session || !profile) return;
    const nextScreen = profile.role === "admin" ? "admin" : profile.role === "seller" ? "seller" : "home";
    const redirectTimer = window.setTimeout(() => setScreen(nextScreen), 0);
    const loader = profile.role === "admin" ? loadAdminData : profile.role === "seller" ? loadSellerData : loadSharedData;
    loader().catch(() => setDataSource("mock"));
    return () => window.clearTimeout(redirectTimer);
  }, [configured, session, profile]);

  const refreshRoleData = async () => {
    try {
      if (role === "admin") await loadAdminData();
      else if (role === "seller") await loadSellerData();
      else await loadSharedData();
    } catch {
      setDataSource("mock");
      flash("เชื่อมต่อ Supabase ไม่สำเร็จ ใช้ข้อมูลตัวอย่างชั่วคราว");
    }
  };

  const normalizedQuery = query.trim().toLowerCase();
  const visibleRestaurants = restaurants.filter((shop) => {
    const shopMenu = menu.filter((item) => item.restaurantId === shop.id && item.isAvailable && !item.isDeleted);
    const matchesCategory = activeCategory === "ทั้งหมด" || shopMenu.some((item) => item.category === activeCategory);
    const matchesQuery = !normalizedQuery
      || `${shop.name} ${shop.description}`.toLowerCase().includes(normalizedQuery)
      || shopMenu.some((item) => `${item.name} ${item.description}`.toLowerCase().includes(normalizedQuery));
    return matchesCategory && matchesQuery;
  });
  const currentMenu = menu.filter(
    (item) =>
      item.restaurantId === selectedRestaurant?.id &&
      item.isAvailable &&
      !item.isDeleted &&
      (activeCategory === "ทั้งหมด" || item.category === activeCategory) &&
      `${item.name} ${item.description}`.toLowerCase().includes(query.toLowerCase()),
  );
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const foodTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = cart.length ? deliveryQuote.deliveryFee : 0;
  const customerOrders = lastOrderId
    ? [...orders.filter((order) => order.dbId === lastOrderId), ...orders.filter((order) => order.dbId !== lastOrderId)]
    : orders;

  const addToCart = (item: MenuItem) => {
    if (cart.length && cart[0].restaurantId !== item.restaurantId) setCart([]);
    setCart((current) => {
      const found = current.find((x) => x.id === item.id);
      return found ? current.map((x) => (x.id === item.id ? { ...x, quantity: x.quantity + 1 } : x)) : [...current, { ...item, quantity: 1, note: "" }];
    });
    flash(`เพิ่ม “${item.name}” ลงตะกร้าแล้ว`);
  };

  const refreshDeliveryQuote = async (latitude: number | null, longitude: number | null) => {
    if (!selectedRestaurant) return;
    try {
      const quote = await getDeliveryQuote(selectedRestaurant.id, latitude, longitude);
      setDeliveryQuote(quote);
    } catch {
      setDeliveryQuote({ distanceKm: null, deliveryFee: 20, restaurantHasLocation: Boolean(selectedRestaurant.latitude && selectedRestaurant.longitude), usesGps: false });
      flash("คำนวณค่าส่งจากตำแหน่งไม่ได้ ระบบใช้ค่าส่งเริ่มต้น 20 บาท");
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationState("error");
      flash("อุปกรณ์นี้ไม่รองรับ GPS กรุณากรอกที่อยู่จัดส่งเอง");
      return;
    }
    setLocationState("loading");
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        setCheckoutLatitude(coords.latitude);
        setCheckoutLongitude(coords.longitude);
        setLocationState("success");
        await refreshDeliveryQuote(coords.latitude, coords.longitude);
        flash("ได้ตำแหน่งปัจจุบันแล้ว");
      },
      () => {
        setCheckoutLatitude(null);
        setCheckoutLongitude(null);
        setLocationState("error");
        setDeliveryQuote((current) => ({ ...current, distanceKm: null, deliveryFee: 20, usesGps: false }));
        flash("ไม่สามารถเข้าถึงตำแหน่งได้ กรุณากรอกที่อยู่เอง");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  };

  const submitOrder = async () => {
    if (!selectedRestaurant || !cart.length || busyAction) return;
    if (!checkoutAddress.trim()) {
      flash("กรุณากรอกที่อยู่จัดส่ง");
      return;
    }
    setBusyAction("checkout");
    try {
      const orderId = await createOrder({
        restaurantId: selectedRestaurant.id,
        address: checkoutAddress,
        note: checkoutNote,
        latitude: checkoutLatitude,
        longitude: checkoutLongitude,
        items: cart.map((item) => ({ id: item.id, quantity: item.quantity, note: item.note })),
      });
      setLastOrderId(orderId);
      setCart([]);
      await refreshRoleData();
      go("tracking");
      flash("สั่งอาหารสำเร็จ บันทึกลง Supabase แล้ว");
    } catch (error) {
      flash(error instanceof Error ? error.message : "สร้างออเดอร์ไม่สำเร็จ");
    } finally {
      setBusyAction(null);
    }
  };

  const changeOrderStatus = async (order: Order, status: OrderStatusDb) => {
    if (busyAction) return;
    setBusyAction(`order-${order.dbId}`);
    try {
      await updateOrderStatus(order.dbId, status);
      setOrders((current) => current.map((item) => (item.dbId === order.dbId ? { ...item, status } : item)));
      await refreshRoleData();
      flash(`อัปเดต ${order.id} เป็น “${statusText[status]}” แล้ว`);
    } catch (error) {
      flash(error instanceof Error ? error.message : "อัปเดตสถานะไม่สำเร็จ");
    } finally {
      setBusyAction(null);
    }
  };

  if (authLoading) {
    return (
      <div className="auth-loading">
        <IconLogo />
        <span>กำลังตรวจสอบบัญชี...</span>
      </div>
    );
  }

  if (configured && !session) return <AuthScreen />;

  if (configured && session && !profile) {
    return (
      <div className="auth-loading auth-profile-error">
        <IconLogo />
        <h1>โหลดสิทธิ์ผู้ใช้ไม่สำเร็จ</h1>
        <p>{profileError || "ไม่พบข้อมูล Profile ของบัญชีนี้"}</p>
        <div>
          <button onClick={refreshProfile}>ลองอีกครั้ง</button>
          <button className="secondary" onClick={signOut}>
            ออกจากระบบ
          </button>
        </div>
      </div>
    );
  }

  const customerHeader = (
    <header className="topbar customer-topbar">
      <button className="brand" onClick={() => go("home")}>
        <IconLogo />
        <span>อิ่มดี</span>
      </button>
      <div className="location-pill">
        <MapPin size={17} />
        <span>
          <small>จัดส่งที่</small>
          <b>{checkoutAddress}</b>
        </span>
      </div>
      <div className="header-actions">
        <DataBadge source={dataSource} />
        <button className="icon-btn" aria-label="การแจ้งเตือน" onClick={() => flash("ยังไม่มีการแจ้งเตือนใหม่") }>
          <Bell size={21} />
          <i />
        </button>
        <button className="cart-button" onClick={() => go("cart")}>
          <ShoppingCart size={20} />
          <span>ตะกร้า</span>
          {cartCount > 0 && <b>{cartCount}</b>}
        </button>
        <span className="user-role-chip">
          <UserRound size={16} />
          {profile?.name || "โหมดทดลอง"}
          <small>{roleLabel(role)}</small>
        </span>
        <button className="logout-button compact" onClick={signOut} aria-label="ออกจากระบบ">
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );

  return (
    <div className={role === "customer" ? "app customer-app" : "app dashboard-app"}>
      {role === "customer" ? customerHeader : <DashboardSidebar role={role} screen={screen} go={go} signOut={signOut} profileName={profile?.name ?? ""} />}
      <main className={role === "customer" ? "main" : "dashboard-main"}>
        {role === "customer" && screen === "home" && (
          <CustomerHome
            restaurants={visibleRestaurants}
            categories={categories}
            query={query}
            setQuery={setQuery}
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
            openRestaurant={(shop) => {
              setSelectedRestaurant(shop);
              setQuery("");
              setActiveCategory("ทั้งหมด");
              go("restaurant");
            }}
          />
        )}
        {role === "customer" && screen === "restaurant" && selectedRestaurant && (
          <RestaurantPage
            restaurant={selectedRestaurant}
            categories={categories}
            menu={currentMenu}
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
            query={query}
            setQuery={setQuery}
            addToCart={addToCart}
            back={() => go("home")}
            cartCount={cartCount}
            openCart={() => go("cart")}
          />
        )}
        {role === "customer" && screen === "cart" && (
          <CartPage
            items={cart}
            foodTotal={foodTotal}
            deliveryFee={deliveryFee}
            address={checkoutAddress}
            setAddress={setCheckoutAddress}
            orderNote={checkoutNote}
            setOrderNote={setCheckoutNote}
            latitude={checkoutLatitude}
            longitude={checkoutLongitude}
            locationState={locationState}
            quote={deliveryQuote}
            useCurrentLocation={useCurrentLocation}
            busy={busyAction === "checkout"}
            updateQuantity={(id, amount) => setCart((current) => current.map((item) => (item.id === id ? { ...item, quantity: item.quantity + amount } : item)).filter((item) => item.quantity > 0))}
            updateNote={(id, note) => setCart((current) => current.map((item) => (item.id === id ? { ...item, note } : item)))}
            back={() => go(selectedRestaurant ? "restaurant" : "home")}
            checkout={submitOrder}
          />
        )}
        {role === "customer" && screen === "tracking" && <TrackingPage orders={customerOrders} back={() => go("home")} />}

        {role === "seller" && screen === "seller" && <SellerDashboard restaurant={sellerRestaurant} orders={orders} summary={sellerSummary} go={go} updateOrder={changeOrderStatus} busyAction={busyAction} />}
        {role === "seller" && screen === "seller-menu" && (
          <SellerMenu restaurant={sellerRestaurant} menu={menu.filter((item) => item.restaurantId === sellerRestaurant?.id && !item.isDeleted)} categories={categories} refresh={refreshRoleData} flash={flash} />
        )}
        {role === "seller" && screen === "seller-orders" && <OrdersBoard orders={orders} updateOrder={changeOrderStatus} busyAction={busyAction} />}
        {role === "seller" && screen === "seller-report" && <SellerReport summary={sellerSummary} orders={orders} />}
        {role === "seller" && screen === "seller-shop" && <ShopSettings restaurant={sellerRestaurant} refresh={refreshRoleData} flash={flash} />}

        {role === "admin" && screen === "admin" && <AdminDashboard summary={adminSummary} shops={adminRestaurants} orders={orders} go={go} />}
        {role === "admin" && screen === "admin-shops" && <AdminShops shops={adminRestaurants} refresh={refreshRoleData} flash={flash} />}
        {role === "admin" && screen === "admin-users" && <AdminUsers users={users} />}
        {role === "admin" && screen === "admin-orders" && <OrdersBoard orders={orders} updateOrder={changeOrderStatus} busyAction={busyAction} admin />}
        {role === "admin" && screen === "admin-gp" && <GpSettings shops={adminRestaurants} refresh={refreshRoleData} flash={flash} />}
        {role === "admin" && screen === "admin-report" && <AdminReport summary={adminSummary} />}
      </main>
      {role === "customer" && (
        <nav className="mobile-nav">
          <button className={screen === "home" || screen === "restaurant" ? "active" : ""} onClick={() => go("home")}>
            <Home size={21} />
            <span>หน้าหลัก</span>
          </button>
          <button onClick={() => { go("home"); setQuery(""); window.setTimeout(() => document.querySelector<HTMLInputElement>(".hero .search-box input")?.focus(), 250); }}>
            <Search size={21} />
            <span>ค้นหา</span>
          </button>
          <button className={screen === "tracking" ? "active" : ""} onClick={() => go("tracking")}>
            <ShoppingBag size={21} />
            <span>ออเดอร์</span>
          </button>
          <button className={screen === "cart" ? "active" : ""} onClick={() => go("cart")}>
            <ShoppingCart size={21} />
            <span>ตะกร้า</span>
          </button>
        </nav>
      )}
      {toast && (
        <div className="toast">
          <Check size={18} />
          {toast}
        </div>
      )}
    </div>
  );
}

function DataBadge({ source }: { source: "loading" | "supabase" | "mock" }) {
  return (
    <span className={`data-badge ${source}`}>
      <i />
      {source === "supabase" ? "Supabase Connected" : source === "loading" ? "กำลังเชื่อมต่อ" : "ข้อมูลตัวอย่าง"}
    </span>
  );
}

function DashboardSidebar({ role, screen, go, signOut, profileName }: { role: Role; screen: Screen; go: (screen: Screen) => void; signOut: () => void; profileName: string }) {
  const nav =
    role === "seller"
      ? ([
          ["seller", "ภาพรวม", LayoutDashboard],
          ["seller-orders", "ออเดอร์", ShoppingBag],
          ["seller-menu", "เมนูอาหาร", CookingPot],
          ["seller-report", "รายงานยอดขาย", BarChart3],
          ["seller-shop", "ข้อมูลร้าน", Store],
        ] as const)
      : ([
          ["admin", "ภาพรวมระบบ", LayoutDashboard],
          ["admin-shops", "ร้านค้า", Store],
          ["admin-users", "ผู้ใช้", Users],
          ["admin-orders", "ออเดอร์ทั้งหมด", ShoppingBag],
          ["admin-gp", "ตั้งค่า GP", CircleDollarSign],
          ["admin-report", "รายงานระบบ", BarChart3],
        ] as const);

  return (
    <aside className="sidebar">
      <button className="brand brand-light" onClick={() => go(role === "seller" ? "seller" : "admin")}>
        <IconLogo />
        <span>อิ่มดี</span>
      </button>
      <div className="workspace-label">{role === "seller" ? "ศูนย์จัดการร้านค้า" : "ผู้ดูแลระบบ"}</div>
      <nav>
        {nav.map(([id, label, Icon]) => (
          <button key={id} className={screen === id ? "active" : ""} onClick={() => go(id)}>
            <Icon size={20} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="user-card">
          <div className="avatar">{profileName?.[0] || "อ"}</div>
          <span>
            <b>{profileName || "ผู้ใช้งาน"}</b>
            <small>{roleLabel(role)}</small>
          </span>
          <button className="logout-button" onClick={signOut} aria-label="ออกจากระบบ">
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="search-box">
      <Search size={19} />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}

function CustomerHome({ restaurants, categories, query, setQuery, activeCategory, setActiveCategory, openRestaurant }: any) {
  return (
    <>
      <section className="hero">
        <div>
          <span className="eyebrow">ส่งฟรีเมื่อสั่งครบ ฿199</span>
          <h1>มื้อนี้กินอะไรดี?</h1>
          <p>อร่อยกับร้านเด็ดใกล้บ้าน สั่งถึงมือคุณ</p>
          <SearchBox value={query} onChange={setQuery} placeholder="ค้นหาร้าน หรือเมนูที่อยากกิน" />
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="plate">🍜</div>
          <span className="leaf leaf-a">🌿</span>
          <span className="leaf leaf-b">🌶️</span>
        </div>
      </section>
      <section className="section">
        <div className="section-head">
          <div>
            <span className="kicker">เลือกตามใจ</span>
            <h2>หมวดหมู่ยอดนิยม</h2>
          </div>
        </div>
        <div className="category-row">
          {categories.map((cat: Category, index: number) => (
            <button key={cat.id} className={activeCategory === cat.name ? "active" : ""} onClick={() => setActiveCategory(activeCategory === cat.name ? "ทั้งหมด" : cat.name)}>
              <span>{cat.icon || ["🍚", "🍜", "🧋", "🍧", "🍗"][index % 5]}</span>
              <b>{cat.name}</b>
            </button>
          ))}
        </div>
      </section>
      <section className="section">
        <div className="section-head">
          <div>
            <span className="kicker">ร้านอร่อยใกล้คุณ</span>
            <h2>ร้านที่เปิดขายตอนนี้</h2>
          </div>
          <button className="text-button" onClick={() => { setQuery(""); setActiveCategory("ทั้งหมด"); }}>
            ดูทั้งหมด <ChevronRight size={18} />
          </button>
        </div>
        <div className="restaurant-grid">
          {restaurants.map((shop: Restaurant) => (
            <article className="restaurant-card" key={shop.id} onClick={() => openRestaurant(shop)}>
              <div className="card-image">
                <img src={shop.image} alt={shop.name} />
                <span className="open">เปิดอยู่</span>
              </div>
              <div className="card-content">
                <h3>{shop.name}</h3>
                <p>{shop.description}</p>
                <div className="meta">
                  <span>
                    <Star size={16} fill="currentColor" /> {shop.rating || "ใหม่"}
                  </span>
                  <span>
                    <Clock3 size={16} /> {shop.time}
                  </span>
                  <span>
                    <Truck size={16} /> {money(shop.delivery)}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
        {!restaurants.length && <EmptyState title="ยังไม่มีร้านที่อนุมัติ" text="ร้าน pending หรือ suspended จะไม่แสดงให้ลูกค้าสั่งอาหาร" />}
      </section>
    </>
  );
}

function RestaurantPage({ restaurant, categories, menu, activeCategory, setActiveCategory, query, setQuery, addToCart, back, cartCount, openCart }: any) {
  const [detailItem, setDetailItem] = useState<MenuItem | null>(null);
  return (
    <section className="restaurant-page">
      <button className="back-button" onClick={back}>
        <ArrowLeft size={18} /> กลับหน้าร้านทั้งหมด
      </button>
      <div className="restaurant-hero">
        <img src={restaurant.image} alt={restaurant.name} />
        <div className="restaurant-overlay">
          <span className="open-dot">● เปิดขาย</span>
          <h1>{restaurant.name}</h1>
          <p>{restaurant.description}</p>
          <div className="meta">
            <span>
              <Star size={16} fill="currentColor" /> {restaurant.rating || "ใหม่"}
            </span>
            <span>
              <Clock3 size={16} /> {restaurant.time}
            </span>
            <span>
              <Truck size={16} /> ค่าส่ง {money(restaurant.delivery)}
            </span>
          </div>
        </div>
      </div>
      <div className="menu-toolbar">
        <div className="pills">
          <button className={activeCategory === "ทั้งหมด" ? "active" : ""} onClick={() => setActiveCategory("ทั้งหมด")}>
            ทั้งหมด
          </button>
          {categories.map((cat: Category) => (
            <button key={cat.id} className={activeCategory === cat.name ? "active" : ""} onClick={() => setActiveCategory(cat.name)}>
              {cat.name}
            </button>
          ))}
        </div>
        <SearchBox value={query} onChange={setQuery} placeholder="ค้นหาเมนู" />
      </div>
      <div className="menu-grid">
        {menu.map((item: MenuItem) => (
          <article className="menu-card" key={item.id}>
            <img src={item.image} alt={item.name} />
            <div>
              <header>
                {item.popular && <span className="popular">ขายดี</span>}
                <h3>{item.name}</h3>
                <p>{item.description}</p>
              </header>
              <footer>
                <b>{money(item.price)}</b>
                <button className="menu-detail-button" onClick={() => setDetailItem(item)}>รายละเอียด</button>
                <button onClick={() => addToCart(item)} aria-label={`เพิ่ม ${item.name}`}>
                  <Plus size={20} />
                </button>
              </footer>
            </div>
          </article>
        ))}
      </div>
      {!menu.length && <EmptyState title="ยังไม่มีเมนูที่เปิดขาย" text="แสดงเฉพาะเมนู available และไม่ถูกลบเท่านั้น" />}
      {cartCount > 0 && (
        <button className="floating-cart" onClick={openCart}>
          <span>
            <ShoppingCart /> {cartCount} รายการ
          </span>
          <strong>ดูตะกร้า</strong>
        </button>
      )}
      {detailItem && <div className="modal-backdrop"><div className="modal menu-detail-modal">
        <button type="button" className="close" onClick={() => setDetailItem(null)}><X /></button>
        <img src={detailItem.image} alt={detailItem.name} />
        <span className="kicker">{detailItem.category}</span><h2>{detailItem.name}</h2>
        <p>{detailItem.description}</p><strong>{money(detailItem.price)}</strong>
        <button className="primary-button" onClick={() => { addToCart(detailItem); setDetailItem(null); }}>เพิ่มลงตะกร้า</button>
      </div></div>}
    </section>
  );
}

function CartPage({ items, foodTotal, deliveryFee, address, setAddress, orderNote, setOrderNote, latitude, longitude, locationState, quote, useCurrentLocation, busy, updateQuantity, updateNote, back, checkout }: any) {
  if (!items.length) {
    return (
      <section className="narrow-page">
        <button className="back-button" onClick={back}>
          <ArrowLeft size={18} /> กลับไปเลือกอาหาร
        </button>
        <EmptyState title="ตะกร้ายังว่าง" text="เลือกเมนูจากร้านที่อนุมัติแล้วเพื่อเริ่มสั่งอาหาร" />
      </section>
    );
  }

  return (
    <section className="narrow-page">
      <button className="back-button" onClick={back}>
        <ArrowLeft size={18} /> กลับไปเลือกอาหาร
      </button>
      <div className="page-title">
        <div>
          <span className="kicker">ตรวจสอบรายการ</span>
          <h1>ตะกร้าสินค้า</h1>
        </div>
      </div>
      <div className="checkout-layout">
        <div className="cart-list">
          <div className="order-shop">
            <Store size={18} />
            <b>รายการอาหาร</b>
            <span>{items.length} เมนู</span>
          </div>
          {items.map((item: CartItem) => (
            <article className="cart-item" key={item.id}>
              <img src={item.image} alt={item.name} />
              <div className="cart-info">
                <h3>{item.name}</h3>
                <b>{money(item.price)}</b>
                <input value={item.note} onChange={(event) => updateNote(item.id, event.target.value)} placeholder="หมายเหตุรายเมนู เช่น ไม่เผ็ด ไม่ใส่ผัก" />
              </div>
              <div className="stepper">
                <button onClick={() => updateQuantity(item.id, -1)}>
                  <Minus size={16} />
                </button>
                <b>{item.quantity}</b>
                <button onClick={() => updateQuantity(item.id, 1)}>
                  <Plus size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
        <aside className="summary-card">
          <h2>สรุปคำสั่งซื้อ</h2>
          <label className="form-field">
            ที่อยู่จัดส่ง
            <textarea value={address} onChange={(event) => setAddress(event.target.value)} placeholder="บ้านเลขที่ หมู่บ้าน ชั้น ห้อง และจุดสังเกต" />
          </label>
          <button className="location-button" type="button" onClick={useCurrentLocation} disabled={locationState === "loading" || busy}>
            <MapPin size={18} />
            {locationState === "loading" ? "กำลังขอตำแหน่ง..." : "ใช้ตำแหน่งปัจจุบัน"}
          </button>
          <div className={`location-feedback ${locationState}`}>
            {locationState === "success" && <>ได้ตำแหน่งแล้ว · {Number(latitude).toFixed(5)}, {Number(longitude).toFixed(5)}</>}
            {locationState === "error" && <>ไม่สามารถเข้าถึงตำแหน่งได้ — กรอกที่อยู่เองและใช้ค่าส่งเริ่มต้น 20 บาทได้</>}
            {locationState === "idle" && <>ยังไม่ได้เลือก GPS — ระบบจะใช้ค่าส่งเริ่มต้น 20 บาท</>}
          </div>
          <label className="form-field">
            หมายเหตุรวมของออเดอร์
            <textarea value={orderNote} onChange={(event) => setOrderNote(event.target.value)} placeholder="เช่น โทรก่อนถึงบ้าน" />
          </label>
          <div className="summary-lines">
            <span>
              ยอดอาหาร <b>{money(foodTotal)}</b>
            </span>
            <span>
              ค่าจัดส่ง <b>{money(deliveryFee)}</b>
            </span>
            <span>
              ระยะทางโดยประมาณ <b>{quote.distanceKm === null ? "ไม่มีข้อมูล GPS" : `${quote.distanceKm.toFixed(2)} กม.`}</b>
            </span>
          </div>
          <div className="grand-total">
            <span>
              รวมทั้งหมด
              <small>GP คำนวณฝั่งฐานข้อมูลจากยอดอาหาร</small>
            </span>
            <b>{money(foodTotal + deliveryFee)}</b>
          </div>
          <button className="primary-button" onClick={checkout} disabled={busy || !address.trim()}>
            {busy ? "กำลังสร้างออเดอร์..." : "ยืนยันคำสั่งซื้อ"}
          </button>
        </aside>
      </div>
    </section>
  );
}

function TrackingPage({ orders, back }: { orders: Order[]; back: () => void }) {
  const order = orders[0];
  return (
    <section className="narrow-page tracking">
      <button className="back-button" onClick={back}>
        <ArrowLeft size={18} /> กลับหน้าหลัก
      </button>
      <div className="tracking-head">
        <PackageCheck size={46} />
        <h1>ติดตามสถานะออเดอร์</h1>
        <p>{order ? `${order.id} · ${order.restaurant}` : "ยังไม่มีออเดอร์ล่าสุด"}</p>
      </div>
      {order ? (
        <div className="tracking-card">
          {(["pending", "accepted", "preparing", "ready", "completed"] as OrderStatusDb[]).map((status) => (
            <div className={`track-step ${order.status === status ? "active" : ""}`} key={status}>
              <Check size={18} />
              <span>{statusText[status]}</span>
            </div>
          ))}
          <div className="tracking-summary">
            <span>จัดส่งที่ <b>{order.address || "ไม่ระบุที่อยู่"}</b></span>
            <span>ค่าส่ง <b>{money(order.deliveryFee)}</b></span>
            <span>ระยะทาง <b>{order.deliveryDistanceKm === null ? "ไม่มีข้อมูล GPS" : `${order.deliveryDistanceKm.toFixed(2)} กม.`}</b></span>
            <span>ยอดรวม <b>{money(order.total)}</b></span>
          </div>
        </div>
      ) : (
        <EmptyState title="ยังไม่มีออเดอร์" text="เมื่อสั่งอาหารสำเร็จ ระบบจะพามาหน้านี้ทันที" />
      )}
      {orders.length > 1 && <section className="panel order-history"><div className="panel-head"><div><h2>ประวัติคำสั่งซื้อ</h2><p>ออเดอร์ล่าสุดของคุณ</p></div></div>{orders.slice(1).map((item) => <div key={item.dbId || item.id}><span><b>{item.id}</b><small>{new Date(item.createdAt).toLocaleDateString("th-TH")} · {item.restaurant}</small></span><Status status={statusText[item.status]} /><strong>{money(item.total)}</strong></div>)}</section>}
    </section>
  );
}

function DashboardTop({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="dashboard-top">
      <div>
        <span className="kicker">อิ่มดี</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="date-pill">
        <Clock3 size={17} />
        {new Date().toLocaleDateString("th-TH", { dateStyle: "medium" })}
      </div>
    </div>
  );
}

function StatCard({ label, value, change, icon: Icon, tone = "" }: any) {
  return (
    <article className={`stat-card ${tone}`}>
      <div className="stat-icon">
        <Icon size={22} />
      </div>
      <p>{label}</p>
      <h2>{value}</h2>
      <span>{change}</span>
    </article>
  );
}

function RestaurantNotice({ restaurant }: { restaurant: Restaurant | null }) {
  if (!restaurant) return <div className="status-alert warning">ยังไม่พบร้านของบัญชีนี้ กรุณาสมัครร้านหรือให้ Admin ตรวจสอบ profile</div>;
  if (restaurant.status === "pending") return <div className="status-alert warning">ร้านของคุณยังรออนุมัติจาก Admin ลูกค้าจะยังไม่เห็นร้านนี้</div>;
  if (restaurant.status === "suspended") return <div className="status-alert danger">ร้านของคุณถูกระงับชั่วคราว ระบบจะไม่รับออเดอร์ใหม่</div>;
  return <div className="status-alert success">ร้านอนุมัติแล้ว ลูกค้าสามารถเห็นร้านและสั่งอาหารได้</div>;
}

function SellerDashboard({ restaurant, orders, summary, go, updateOrder, busyAction }: any) {
  const pending = orders.find((order: Order) => order.status === "pending");
  return (
    <>
      <DashboardTop title="ภาพรวมร้านค้า" subtitle={restaurant?.name ?? "ร้านของคุณ"} />
      <RestaurantNotice restaurant={restaurant} />
      {restaurant && (restaurant.latitude === null || restaurant.longitude === null) && (
        <div className="location-warning">
          <MapPin size={24} />
          <span>
            <b>กรุณาตั้งค่าตำแหน่งร้าน เพื่อให้ระบบคำนวณค่าส่งได้แม่นยำ</b>
            <small>หากยังไม่ตั้งค่า ระบบจะใช้ค่าส่งเริ่มต้น 20 บาท</small>
          </span>
          <button onClick={() => go("seller-shop")}>ไปตั้งค่าตำแหน่งร้าน</button>
        </div>
      )}
      <div className="stats-grid seller-stats">
        <StatCard label="ยอดขายวันนี้" value={money(Number(summary.today?.food_total ?? 0))} change="นับเฉพาะออเดอร์สำเร็จ" icon={WalletCards} />
        <StatCard label="ออเดอร์วันนี้" value={`${summary.today?.orders ?? 0}`} change="completed เท่านั้น" icon={ShoppingBag} tone="blue" />
        <StatCard label="ค่า GP วันนี้" value={money(Number(summary.today?.gp_amount ?? 0))} change={`GP ร้าน ${restaurant?.gpPercent ?? 0}%`} icon={CircleDollarSign} tone="purple" />
        <StatCard label="รายได้สุทธิวันนี้" value={money(Number(summary.today?.net_income ?? 0))} change="หลังหัก GP" icon={BarChart3} tone="green" />
      </div>
      {pending && (
        <section className="urgent-order">
          <div className="urgent-head">
            <span>
              <i /> ออเดอร์ใหม่
            </span>
            <b>{pending.time}</b>
          </div>
          <div className="urgent-body">
            <div className="order-number">
              <small>เลขออเดอร์</small>
              <h2>{pending.id}</h2>
              <span>{pending.customer}</span>
            </div>
            <div className="order-detail">
              <h3>{pending.items}</h3>
              <p>{pending.note || "ไม่มีหมายเหตุ"}</p>
              <span>{pending.address || "ไม่ระบุที่อยู่"}</span>
            </div>
            <div className="order-total">
              <small>ยอดรวม</small>
              <h2>{money(pending.total)}</h2>
            </div>
          </div>
          <div className="order-actions">
            <button className="reject" disabled={busyAction === `order-${pending.dbId}`} onClick={() => updateOrder(pending, "rejected")}>
              {busyAction === `order-${pending.dbId}` ? "กำลังบันทึก..." : "ปฏิเสธ"}
            </button>
            <button className="accept" disabled={busyAction === `order-${pending.dbId}`} onClick={() => updateOrder(pending, "accepted")}>
              {busyAction === `order-${pending.dbId}` ? "กำลังบันทึก..." : "รับออเดอร์"}
            </button>
          </div>
        </section>
      )}
      <section className="panel action-list">
        <div className="panel-head">
          <div>
            <h2>ทางลัดจัดการร้าน</h2>
            <p>งานหลักของแม่ค้าอยู่ในเมนูนี้</p>
          </div>
        </div>
        <button onClick={() => go("seller-orders")}>
          <span>
            <ShoppingBag />
          </span>
          <p>
            <b>ดูออเดอร์ทั้งหมด</b>
            <small>รับออเดอร์และเปลี่ยนสถานะ</small>
          </p>
          <ChevronRight />
        </button>
        <button onClick={() => go("seller-menu")}>
          <span>
            <CookingPot />
          </span>
          <p>
            <b>จัดการเมนูอาหาร</b>
            <small>เพิ่ม แก้ไข ปิดขาย หรือลบเมนู</small>
          </p>
          <ChevronRight />
        </button>
      </section>
    </>
  );
}

function SellerMenu({ restaurant, menu, categories, refresh, flash }: { restaurant: Restaurant | null; menu: MenuItem[]; categories: Category[]; refresh: () => Promise<void>; flash: (message: string) => void }) {
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const visibleMenu = menu.filter((item) => `${item.name} ${item.description} ${item.category}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <>
      <DashboardTop title="จัดการเมนู" subtitle="เพิ่ม แก้ไข ลบ และเปิด/ปิดการขายเมนู" />
      <RestaurantNotice restaurant={restaurant} />
      <div className="page-actions">
        <SearchBox value={query} onChange={setQuery} placeholder="ค้นหาเมนู" />
        <button className="primary-button fit" disabled={!restaurant} onClick={() => setOpen(true)}>
          <Plus size={19} /> เพิ่มเมนูใหม่
        </button>
      </div>
      <div className="manage-menu-grid">
        {visibleMenu.map((item) => (
          <article key={item.id}>
            <img src={item.image} alt={item.name} />
            <div>
              <span className="menu-category">{item.category}</span>
              <h3>{item.name}</h3>
              <p>{item.description}</p>
              <b>{money(item.price)}</b>
            </div>
            <footer>
              <button
                className={item.isAvailable ? "available" : "unavailable"}
                disabled={busyId === item.id}
                onClick={async () => {
                  setBusyId(item.id);
                  try {
                    await updateMenu(item.id, { isAvailable: !item.isAvailable });
                    await refresh();
                    flash(item.isAvailable ? "ปิดขายเมนูแล้ว" : "เปิดขายเมนูแล้ว");
                  } catch (error) {
                    flash(error instanceof Error ? error.message : "อัปเดตเมนูไม่สำเร็จ");
                  } finally { setBusyId(null); }
                }}
              >
                {item.isAvailable ? <ToggleRight size={27} /> : <ToggleLeft size={27} />}
                {item.isAvailable ? "เปิดขาย" : "ปิดขาย"}
              </button>
              <button className="ghost-button small" onClick={() => setEditing(item)}>
                แก้ไข
              </button>
              <button
                className="ghost-button small danger"
                disabled={busyId === item.id}
                onClick={async () => {
                  if (!window.confirm(`ลบเมนู “${item.name}” ใช่หรือไม่?`)) return;
                  setBusyId(item.id);
                  try {
                    await deleteMenu(item.id);
                    await refresh();
                    flash("ลบเมนูแล้ว");
                  } catch (error) {
                    flash(error instanceof Error ? error.message : "ลบเมนูไม่สำเร็จ");
                  } finally { setBusyId(null); }
                }}
              >
                <Trash2 size={15} />
              </button>
            </footer>
          </article>
        ))}
      </div>
      {!visibleMenu.length && <EmptyState title={query ? "ไม่พบเมนูที่ค้นหา" : "ยังไม่มีเมนู"} text={query ? "ลองค้นหาด้วยคำอื่น" : "เพิ่มเมนูแรกของร้านเพื่อให้ลูกค้าเริ่มสั่งได้หลังอนุมัติ"} />}
      {(open || editing) && <MenuModal restaurant={restaurant} categories={categories} item={editing} onClose={() => { setOpen(false); setEditing(null); }} refresh={refresh} flash={flash} />}
    </>
  );
}

function MenuModal({ restaurant, categories, item, onClose, refresh, flash }: any) {
  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [price, setPrice] = useState(String(item?.price ?? ""));
  const [imageUrl, setImageUrl] = useState(item?.image ?? "");
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? categories[0]?.id ?? "");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!restaurant || busy) return;
    setBusy(true);
    try {
      if (item) await updateMenu(item.id, { name, description, price: Number(price), imageUrl, categoryId });
      else await createMenu({ restaurantId: restaurant.id, name, description, price: Number(price), imageUrl, categoryId });
      await refresh();
      flash(item ? "แก้ไขเมนูแล้ว" : "เพิ่มเมนูลง Supabase แล้ว");
      onClose();
    } catch (error) {
      flash(error instanceof Error ? error.message : "บันทึกเมนูไม่สำเร็จ");
    } finally { setBusy(false); }
  };

  return (
    <div className="modal-backdrop">
      <form className="modal" onSubmit={submit}>
        <button type="button" className="close" onClick={onClose} disabled={busy}>
          <X />
        </button>
        <span className="kicker">{item ? "แก้ไขรายการอาหาร" : "เพิ่มรายการอาหาร"}</span>
        <h2>{item ? "แก้ไขเมนู" : "เมนูใหม่"}</h2>
        <label>
          ชื่อเมนู
          <input required value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          รายละเอียด
          <textarea required value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>
        <label>
          ราคา
          <input required min="0" type="number" value={price} onChange={(event) => setPrice(event.target.value)} />
        </label>
        <label>
          หมวดหมู่
          <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            {categories.map((cat: Category) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          รูปภาพ URL
          <input value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="https://..." />
        </label>
        <button className="primary-button" type="submit" disabled={busy}>
          {busy ? "กำลังบันทึก..." : "บันทึกเมนู"}
        </button>
      </form>
    </div>
  );
}

function OrdersBoard({ orders, updateOrder, busyAction, admin = false }: { orders: Order[]; updateOrder: (order: Order, status: OrderStatusDb) => Promise<void>; busyAction: string | null; admin?: boolean }) {
  const [filter, setFilter] = useState<OrderStatusDb | "all">("all");
  const nextStatus = (status: OrderStatusDb): OrderStatusDb | null => {
    if (status === "pending") return "accepted";
    if (status === "accepted") return "preparing";
    if (status === "preparing") return "ready";
    if (status === "ready") return "completed";
    return null;
  };

  return (
    <>
      <DashboardTop title={admin ? "ออเดอร์ทั้งหมด" : "จัดการออเดอร์"} subtitle="รับออเดอร์ ปฏิเสธ และเปลี่ยนสถานะตามลำดับ" />
      <div className="filter-tabs">
        <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>ทั้งหมด <b>{orders.length}</b></button>
        {(["pending", "accepted", "preparing", "ready", "completed", "rejected"] as OrderStatusDb[]).map((status) => (
          <button key={status} className={filter === status ? "active" : ""} onClick={() => setFilter(status)}>
            {statusText[status]} <b>{orders.filter((order) => order.status === status).length}</b>
          </button>
        ))}
      </div>
      <div className="order-board">
        {orders.filter((order) => filter === "all" || order.status === filter).map((order) => {
          const next = nextStatus(order.status);
          return (
            <article className={`order-card-large ${order.status === "pending" ? "highlight" : ""}`} key={order.dbId || order.id}>
              <header>
                <div>
                  <ShoppingBag size={20} />
                  <span>
                    <h2>{order.id}</h2>
                    <small>{order.time} · {order.restaurant}</small>
                  </span>
                </div>
                <Status status={statusText[order.status]} />
              </header>
              <div className="order-customer">
                <UserRound size={18} />
                <span>
                  <b>{order.customer}</b>
                  <small>{order.address || "ไม่ระบุที่อยู่"}</small>
                  {order.deliveryDistanceKm !== null && <small>ระยะทาง {order.deliveryDistanceKm.toFixed(2)} กม. · ค่าส่ง {money(order.deliveryFee)}</small>}
                </span>
              </div>
              <div className="order-items">
                <p>{order.items}</p>
                {order.note && <span>{order.note}</span>}
              </div>
              <div className="order-money">
                <span>ยอดอาหาร <b>{money(order.foodTotal)}</b></span>
                <span>ค่า GP <b>{money(order.gpAmount)}</b></span>
                <span>รายได้สุทธิ <b>{money(order.net)}</b></span>
                <span>ลูกค้าจ่าย <b>{money(order.total)}</b></span>
              </div>
              <footer>
                {order.status === "pending" && (
                  <button className="reject" disabled={busyAction === `order-${order.dbId}`} onClick={() => updateOrder(order, "rejected")}>
                    {busyAction === `order-${order.dbId}` ? "กำลังบันทึก..." : "ปฏิเสธ"}
                  </button>
                )}
                {next && (
                  <button className="accept" disabled={busyAction === `order-${order.dbId}`} onClick={() => updateOrder(order, next)}>
                    {busyAction === `order-${order.dbId}` ? "กำลังบันทึก..." : order.status === "pending" ? "รับออเดอร์" : `เปลี่ยนเป็น ${statusText[next]}`}
                  </button>
                )}
              </footer>
            </article>
          );
        })}
      </div>
      {!orders.length && <EmptyState title="ยังไม่มีออเดอร์" text="เมื่อมีลูกค้าสั่งอาหาร ออเดอร์จะแสดงที่นี่" />}
    </>
  );
}

function SellerReport({ summary, orders }: { summary: typeof emptySellerSummary; orders: Order[] }) {
  const completed = orders.filter((order) => order.status === "completed");
  return (
    <>
      <DashboardTop title="รายงานยอดขาย" subtitle="นับเฉพาะออเดอร์สถานะสำเร็จ" />
      <div className="stats-grid">
        <StatCard label="ยอดขายวันนี้" value={money(Number(summary.today?.food_total ?? 0))} change={`${summary.today?.orders ?? 0} ออเดอร์`} icon={WalletCards} />
        <StatCard label="ค่า GP วันนี้" value={money(Number(summary.today?.gp_amount ?? 0))} change="หักจากยอดอาหาร" icon={CircleDollarSign} tone="purple" />
        <StatCard label="รายได้สุทธิวันนี้" value={money(Number(summary.today?.net_income ?? 0))} change="หลังหัก GP" icon={BarChart3} tone="green" />
      </div>
      <section className="panel chart-panel">
        <div className="panel-head">
          <div>
            <h2>ยอดขาย 7 วันล่าสุด</h2>
            <p>คำนวณจาก completed orders</p>
          </div>
          <b>{money(Number(summary.month?.food_total ?? 0))} เดือนนี้</b>
        </div>
        <MiniChart data={summary.last_7_days ?? []} />
      </section>
      <OrdersTable orders={completed} />
    </>
  );
}

function ShopSettings({ restaurant, refresh, flash }: { restaurant: Restaurant | null; refresh: () => Promise<void>; flash: (message: string) => void }) {
  const [form, setForm] = useState(() => ({
    name: restaurant?.name ?? "",
    description: restaurant?.description ?? "",
    phone: restaurant?.phone ?? "",
    address: restaurant?.address ?? "",
    openTime: restaurant?.openTime ?? "08:00",
    closeTime: restaurant?.closeTime ?? "20:00",
    image: restaurant?.image ?? "",
    isOpen: restaurant?.isOpen ?? false,
    latitude: restaurant?.latitude === null || restaurant?.latitude === undefined ? "" : String(restaurant.latitude),
    longitude: restaurant?.longitude === null || restaurant?.longitude === undefined ? "" : String(restaurant.longitude),
    locationAddress: restaurant?.locationAddress ?? restaurant?.address ?? "",
  }));
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    const syncTimer = window.setTimeout(() => {
      setForm({
        name: restaurant?.name ?? "",
        description: restaurant?.description ?? "",
        phone: restaurant?.phone ?? "",
        address: restaurant?.address ?? "",
        openTime: restaurant?.openTime ?? "08:00",
        closeTime: restaurant?.closeTime ?? "20:00",
        image: restaurant?.image ?? "",
        isOpen: restaurant?.isOpen ?? false,
        latitude: restaurant?.latitude === null || restaurant?.latitude === undefined ? "" : String(restaurant.latitude),
        longitude: restaurant?.longitude === null || restaurant?.longitude === undefined ? "" : String(restaurant.longitude),
        locationAddress: restaurant?.locationAddress ?? restaurant?.address ?? "",
      });
    }, 0);
    return () => window.clearTimeout(syncTimer);
  }, [restaurant]);

  const update = (key: keyof typeof form, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));

  const locateShop = () => {
    if (!navigator.geolocation) { flash("อุปกรณ์นี้ไม่รองรับ GPS กรุณากรอกพิกัดเอง"); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setForm((current) => ({ ...current, latitude: String(coords.latitude), longitude: String(coords.longitude) }));
        setLocating(false);
        flash("ได้ตำแหน่งร้านแล้ว กดบันทึกข้อมูลร้านเพื่อยืนยัน");
      },
      () => { setLocating(false); flash("ไม่สามารถเข้าถึงตำแหน่งได้ กรุณาอนุญาต GPS หรือกรอกพิกัดเอง"); },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!restaurant || busy) return;
    const latitude = form.latitude === "" ? null : Number(form.latitude);
    const longitude = form.longitude === "" ? null : Number(form.longitude);
    if ((latitude === null) !== (longitude === null) || (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) || (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))) {
      flash("กรุณากรอก latitude และ longitude ให้ถูกต้องทั้งสองช่อง");
      return;
    }
    setBusy(true);
    try {
      await updateSellerRestaurant(restaurant.id, { ...form, latitude, longitude });
      await refresh();
      flash("บันทึกข้อมูลร้านแล้ว");
    } catch (error) {
      flash(error instanceof Error ? error.message : "บันทึกข้อมูลร้านไม่สำเร็จ");
    } finally { setBusy(false); }
  };

  return (
    <>
      <DashboardTop title="ข้อมูลร้านค้า" subtitle="Seller แก้ข้อมูลร้านได้ แต่แก้ status และ GP เองไม่ได้" />
      <RestaurantNotice restaurant={restaurant} />
      {restaurant && (
        <form className="settings-form" onSubmit={submit}>
          <div className="shop-cover">
            <img src={form.image} alt={form.name} />
          </div>
          <div className="form-grid">
            <label>
              ชื่อร้าน
              <input value={form.name} onChange={(event) => update("name", event.target.value)} />
            </label>
            <label>
              เบอร์โทร
              <input value={form.phone} onChange={(event) => update("phone", event.target.value)} />
            </label>
            <label className="full">
              คำอธิบายร้าน
              <textarea value={form.description} onChange={(event) => update("description", event.target.value)} />
            </label>
            <label>
              เวลาเปิด
              <input type="time" value={form.openTime} onChange={(event) => update("openTime", event.target.value)} />
            </label>
            <label>
              เวลาปิด
              <input type="time" value={form.closeTime} onChange={(event) => update("closeTime", event.target.value)} />
            </label>
            <label className="full">
              ที่อยู่
              <textarea value={form.address} onChange={(event) => update("address", event.target.value)} />
            </label>
            <label className="full">
              รูปร้าน URL
              <input value={form.image} onChange={(event) => update("image", event.target.value)} />
            </label>
            <div className="location-settings full">
              <div>
                <b>ตำแหน่งร้าน</b>
                <small>ใช้สำหรับคำนวณระยะทางและค่าส่ง</small>
              </div>
              <button className="location-button" type="button" onClick={locateShop} disabled={locating || busy}>
                <MapPin size={18} /> {locating ? "กำลังขอตำแหน่ง..." : "ใช้ตำแหน่งร้านปัจจุบัน"}
              </button>
            </div>
            <label>
              Latitude
              <input type="number" step="any" value={form.latitude} onChange={(event) => update("latitude", event.target.value)} placeholder="13.7563" />
            </label>
            <label>
              Longitude
              <input type="number" step="any" value={form.longitude} onChange={(event) => update("longitude", event.target.value)} placeholder="100.5018" />
            </label>
            <label className="full">
              รายละเอียดตำแหน่งร้าน
              <textarea value={form.locationAddress} onChange={(event) => update("locationAddress", event.target.value)} placeholder="ชื่ออาคาร จุดสังเกต หรือรายละเอียดเพิ่มเติม" />
            </label>
          </div>
          <label className="toggle-line">
            <input type="checkbox" checked={form.isOpen} onChange={(event) => update("isOpen", event.target.checked)} />
            เปิดร้านรับออเดอร์
          </label>
          <button className="primary-button fit" disabled={busy || locating}>{busy ? "กำลังบันทึก..." : "บันทึกข้อมูลร้าน"}</button>
        </form>
      )}
    </>
  );
}

function AdminDashboard({ summary, shops, orders, go }: any) {
  return (
    <>
      <DashboardTop title="ภาพรวมระบบ" subtitle="ยอดขายและ GP จากออเดอร์สำเร็จ" />
      <div className="stats-grid admin-stats">
        <StatCard label="ยอดขายวันนี้" value={money(Number(summary.today?.food_total ?? 0))} change={`${summary.today?.orders ?? 0} ออเดอร์`} icon={WalletCards} />
        <StatCard label="GP วันนี้" value={money(Number(summary.today?.gp_amount ?? 0))} change="รายได้ระบบ" icon={CircleDollarSign} tone="purple" />
        <StatCard label="ร้านทั้งหมด" value={`${shops.length}`} change={`${summary.restaurants?.pending ?? 0} ร้านรออนุมัติ`} icon={Store} tone="blue" />
        <StatCard label="ออเดอร์ทั้งหมด" value={`${orders.length}`} change="ตามสิทธิ์ admin" icon={ShoppingBag} tone="green" />
      </div>
      <section className="panel action-list">
        <div className="panel-head">
          <div>
            <h2>รายการที่ต้องดำเนินการ</h2>
            <p>จัดการร้านและ GP ได้จากหน้านี้</p>
          </div>
        </div>
        <button onClick={() => go("admin-shops")}>
          <span className="warning-icon">
            <Store />
          </span>
          <p>
            <b>ร้านค้ารออนุมัติ</b>
            <small>pending จะไม่แสดงบนหน้าลูกค้า</small>
          </p>
          <strong>{summary.restaurants?.pending ?? 0}</strong>
          <ChevronRight />
        </button>
        <button onClick={() => go("admin-gp")}>
          <span className="purple-icon">
            <Settings />
          </span>
          <p>
            <b>ตั้งค่า GP รายร้าน</b>
            <small>มีผลเฉพาะออเดอร์ใหม่</small>
          </p>
          <ChevronRight />
        </button>
      </section>
    </>
  );
}

function AdminShops({ shops, refresh, flash }: { shops: Restaurant[]; refresh: () => Promise<void>; flash: (message: string) => void }) {
  const [filter, setFilter] = useState<RestaurantStatus | "all">("all");
  const [editing, setEditing] = useState<Restaurant | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const visible = filter === "all" ? shops : shops.filter((shop) => shop.status === filter);

  const changeShop = async (shop: Restaurant, input: Partial<{ status: RestaurantStatus; gpPercent: number }>) => {
    if (busyId) return;
    setBusyId(shop.id);
    try {
      await updateRestaurantAdmin(shop.id, input);
      await refresh();
      flash("อัปเดตร้านค้าแล้ว");
    } catch (error) {
      flash(error instanceof Error ? error.message : "อัปเดตร้านค้าไม่สำเร็จ");
    } finally { setBusyId(null); }
  };

  return (
    <>
      <DashboardTop title="จัดการร้านค้า" subtitle="อนุมัติ ระงับ และแก้ค่า GP ของแต่ละร้าน" />
      <div className="filter-tabs">
        {(["all", "pending", "approved", "suspended"] as const).map((status) => (
          <button className={filter === status ? "active" : ""} key={status} onClick={() => setFilter(status)}>
            {status === "all" ? "ทั้งหมด" : shopStatusText[status]} <b>{status === "all" ? shops.length : shops.filter((shop) => shop.status === status).length}</b>
          </button>
        ))}
      </div>
      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ร้านค้า</th>
                <th>เจ้าของ/ติดต่อ</th>
                <th>เวลาเปิด</th>
                <th>สถานะ</th>
                <th>พิกัด</th>
                <th>GP</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((shop) => (
                <tr key={shop.id}>
                  <td>
                    <div className="shop-cell">
                      <img src={shop.image} alt="" />
                      <span>
                        <b>{shop.name}</b>
                        <small>{shop.address || "ไม่ระบุที่อยู่"}</small>
                      </span>
                    </div>
                  </td>
                  <td>
                    <b>{shop.ownerName || "ไม่ระบุ"}</b>
                    <small>{shop.phone || "-"}</small>
                  </td>
                  <td>
                    {shop.openTime} - {shop.closeTime}
                  </td>
                  <td>
                    <ShopStatus status={shop.status} />
                  </td>
                  <td><span className={`location-chip ${shop.latitude !== null && shop.longitude !== null ? "ready" : "missing"}`}>{shop.latitude !== null && shop.longitude !== null ? "มีพิกัด" : "ยังไม่มีพิกัด"}</span></td>
                  <td>
                    <select disabled={busyId === shop.id} value={shop.gpPercent} onChange={(event) => changeShop(shop, { gpPercent: Number(event.target.value) })}>
                      {[10, 15, 20, 25].map((value) => (
                        <option key={value} value={value}>
                          {value}%
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <div className="table-actions">
                      {shop.status !== "approved" && (
                        <button className="small-primary" disabled={busyId === shop.id} onClick={() => changeShop(shop, { status: "approved" })}>
                          {busyId === shop.id ? "กำลังบันทึก..." : "อนุมัติ"}
                        </button>
                      )}
                      {shop.status !== "suspended" && (
                        <button className="ghost-button small danger" disabled={busyId === shop.id} onClick={() => changeShop(shop, { status: "suspended" })}>
                          ระงับ
                        </button>
                      )}
                      <button className="ghost-button small" onClick={() => setEditing(shop)}>ดูรายละเอียด</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {editing && <ShopLocationModal shop={editing} onClose={() => setEditing(null)} refresh={refresh} flash={flash} />}
    </>
  );
}

function ShopLocationModal({ shop, onClose, refresh, flash }: { shop: Restaurant; onClose: () => void; refresh: () => Promise<void>; flash: (message: string) => void }) {
  const [latitude, setLatitude] = useState(shop.latitude === null ? "" : String(shop.latitude));
  const [longitude, setLongitude] = useState(shop.longitude === null ? "" : String(shop.longitude));
  const [locationAddress, setLocationAddress] = useState(shop.locationAddress);
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const lat = latitude === "" ? null : Number(latitude);
    const lng = longitude === "" ? null : Number(longitude);
    if ((lat === null) !== (lng === null) || (lat !== null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) || (lng !== null && (!Number.isFinite(lng) || lng < -180 || lng > 180))) {
      flash("กรุณากรอกพิกัดให้ถูกต้องทั้งสองช่อง"); return;
    }
    setBusy(true);
    try {
      await updateRestaurantAdmin(shop.id, { latitude: lat, longitude: lng, locationAddress });
      await refresh(); flash("บันทึกพิกัดร้านแล้ว"); onClose();
    } catch (error) { flash(error instanceof Error ? error.message : "บันทึกพิกัดไม่สำเร็จ"); }
    finally { setBusy(false); }
  };
  return <div className="modal-backdrop"><form className="modal" onSubmit={submit}>
    <button type="button" className="close" onClick={onClose} disabled={busy}><X /></button>
    <span className="kicker">รายละเอียดร้านค้า</span><h2>{shop.name}</h2>
    <p className="modal-detail">{shop.address || "ไม่ระบุที่อยู่"}<br />{shop.phone || "ไม่ระบุเบอร์โทร"}</p>
    <label>Latitude<input type="number" step="any" value={latitude} onChange={(event) => setLatitude(event.target.value)} placeholder="13.7563" /></label>
    <label>Longitude<input type="number" step="any" value={longitude} onChange={(event) => setLongitude(event.target.value)} placeholder="100.5018" /></label>
    <label>รายละเอียดตำแหน่ง<textarea value={locationAddress} onChange={(event) => setLocationAddress(event.target.value)} /></label>
    <button className="primary-button" type="submit" disabled={busy}>{busy ? "กำลังบันทึก..." : "บันทึกพิกัดร้าน"}</button>
  </form></div>;
}

function AdminUsers({ users }: { users: ProfileRow[] }) {
  return (
    <>
      <DashboardTop title="จัดการผู้ใช้" subtitle="ดูบัญชีลูกค้า ผู้ขาย และ admin" />
      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ชื่อผู้ใช้</th>
                <th>อีเมล</th>
                <th>โทรศัพท์</th>
                <th>บทบาท</th>
                <th>สมัครเมื่อ</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className="user-row">
                      <div className="avatar">{user.name[0]}</div>
                      <b>{user.name}</b>
                    </div>
                  </td>
                  <td>{user.email || "-"}</td>
                  <td>{user.phone || "-"}</td>
                  <td>
                    <span className="role-tag">{roleLabel(user.role)}</span>
                  </td>
                  <td>{new Date(user.createdAt).toLocaleDateString("th-TH")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function GpSettings({ shops, refresh, flash }: { shops: Restaurant[]; refresh: () => Promise<void>; flash: (message: string) => void }) {
  const [drafts, setDrafts] = useState<Record<string, number>>(() => Object.fromEntries(shops.map((shop) => [shop.id, shop.gpPercent])));
  const [busyId, setBusyId] = useState<string | null>(null);
  return (
    <>
      <DashboardTop title="ตั้งค่าค่า GP" subtitle="ค่า GP ถูก snapshot ลงออเดอร์เมื่อ customer สั่งอาหาร" />
      <section className="gp-banner">
        <div>
          <CircleDollarSign size={28} />
          <span>
            <b>สูตร GP</b>
            <small>GP = ยอดอาหารรวม × เปอร์เซ็นต์ GP, ไม่รวมค่าจัดส่ง</small>
          </span>
        </div>
        <ShieldCheck />
      </section>
      <section className="panel">
        <div className="gp-list">
          {shops.map((shop) => (
            <div key={shop.id}>
              <img src={shop.image} alt="" />
              <span>
                <b>{shop.name}</b>
                <small>{shopStatusText[shop.status]}</small>
              </span>
              <select
                value={drafts[shop.id] ?? shop.gpPercent}
                disabled={busyId === shop.id}
                onChange={(event) => setDrafts((current) => ({ ...current, [shop.id]: Number(event.target.value) }))}
              >
                {[10, 15, 20, 25].map((value) => (
                  <option key={value} value={value}>
                    {value}%
                  </option>
                ))}
              </select>
              <button className="small-primary" disabled={busyId === shop.id || (drafts[shop.id] ?? shop.gpPercent) === shop.gpPercent} onClick={async () => {
                setBusyId(shop.id);
                try {
                  await updateRestaurantAdmin(shop.id, { gpPercent: drafts[shop.id] ?? shop.gpPercent });
                  await refresh(); flash("บันทึกค่า GP แล้ว");
                } catch (error) { flash(error instanceof Error ? error.message : "บันทึกค่า GP ไม่สำเร็จ"); }
                finally { setBusyId(null); }
              }}>{busyId === shop.id ? "กำลังบันทึก..." : "บันทึก GP"}</button>
              <strong>
                GP ปัจจุบัน
                <br />
                {shop.gpPercent}%
              </strong>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function AdminReport({ summary }: { summary: typeof emptyAdminSummary }) {
  const [period, setPeriod] = useState<"today" | "month">("today");
  const selected = summary[period] ?? summary.today;
  return (
    <>
      <DashboardTop title="รายงานระบบ" subtitle="ยอดขายรวม GP รวม ร้านขายดี และเมนูขายดี" />
      <div className="filter-tabs">
        <button className={period === "today" ? "active" : ""} onClick={() => setPeriod("today")}>วันนี้</button>
        <button className={period === "month" ? "active" : ""} onClick={() => setPeriod("month")}>เดือนนี้</button>
      </div>
      <div className="stats-grid">
        <StatCard label={period === "today" ? "ยอดขายวันนี้" : "ยอดขายเดือนนี้"} value={money(Number(selected?.food_total ?? 0))} change={`${selected?.orders ?? 0} ออเดอร์`} icon={WalletCards} />
        <StatCard label={period === "today" ? "GP วันนี้" : "GP เดือนนี้"} value={money(Number(selected?.gp_amount ?? 0))} change="รายได้ระบบ" icon={CircleDollarSign} tone="purple" />
        <StatCard label="รายได้สุทธิร้าน" value={money(Number(selected?.net_income ?? 0))} change="หลังหัก GP" icon={BarChart3} tone="green" />
      </div>
      <div className="stats-grid">
        <StatCard label="ร้าน pending" value={`${summary.restaurants?.pending ?? 0}`} change="รอตรวจสอบ" icon={Store} />
        <StatCard label="ร้าน approved" value={`${summary.restaurants?.approved ?? 0}`} change="แสดงให้ลูกค้า" icon={ShieldCheck} tone="green" />
        <StatCard label="ร้าน suspended" value={`${summary.restaurants?.suspended ?? 0}`} change="ไม่รับออเดอร์ใหม่" icon={X} tone="purple" />
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>ร้านขายดีที่สุด</h2>
              <p>นับจาก completed orders</p>
            </div>
          </div>
          <div className="ranking">
            {(summary.top_restaurants ?? []).map((shop, index) => (
              <div key={shop.id}>
                <b className="rank">{index + 1}</b>
                <span>
                  <b>{shop.name}</b>
                  <small>{shop.orders} ออเดอร์</small>
                </span>
                <strong>{money(Number(shop.food_total ?? 0))}</strong>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>เมนูขายดีที่สุด</h2>
              <p>ตามจำนวนที่ขาย</p>
            </div>
          </div>
          <div className="best-menu">
            {(summary.top_menu_items ?? []).map((item, index) => (
              <div key={item.name}>
                <b>{index + 1}</b>
                <span>
                  <strong>{item.name}</strong>
                  <small>{item.quantity} จาน</small>
                </span>
                <em>{money(Number(item.food_total ?? 0))}</em>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

function OrdersTable({ orders }: { orders: Order[] }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>รายการออเดอร์สำเร็จ</h2>
          <p>ใช้เป็นฐานรายงานยอดขาย</p>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ออเดอร์</th>
              <th>ลูกค้า</th>
              <th>ยอดอาหาร</th>
              <th>GP</th>
              <th>รายได้สุทธิ</th>
              <th>วันที่</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.dbId || order.id}>
                <td>{order.id}</td>
                <td>{order.customer}</td>
                <td>{money(order.foodTotal)}</td>
                <td>{money(order.gpAmount)}</td>
                <td>{money(order.net)}</td>
                <td>{new Date(order.createdAt).toLocaleDateString("th-TH")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MiniChart({ data }: { data: Array<{ label: string; food_total: number }> }) {
  const max = Math.max(1, ...data.map((point) => Number(point.food_total ?? 0)));
  const fallback = data.length ? data : Array.from({ length: 7 }, (_, index) => ({ label: `${index + 1}`, food_total: 0 }));
  return (
    <div className="chart">
      <div className="chart-grid" />
      <div className="chart-bars">
        {fallback.map((point) => (
          <span key={point.label} style={{ height: `${Math.max(8, (Number(point.food_total ?? 0) / max) * 100)}%` }}>
            <i />
          </span>
        ))}
      </div>
      <div className="chart-labels">
        {fallback.map((point) => (
          <span key={point.label}>{point.label.slice(5)}</span>
        ))}
      </div>
    </div>
  );
}

function Status({ status }: { status: string }) {
  const klass = status.includes("รอ") ? "wait" : status.includes("ทำ") ? "cook" : status.includes("พร้อม") ? "ready" : status.includes("สำเร็จ") || status.includes("อนุมัติ") ? "success" : status.includes("ปฏิเสธ") || status.includes("ยกเลิก") ? "cancel" : "";
  return <span className={`status ${klass}`}>{status}</span>;
}

function ShopStatus({ status }: { status: RestaurantStatus }) {
  return <span className={`status ${status === "pending" ? "wait" : status === "approved" ? "success" : "cancel"}`}>{shopStatusText[status]}</span>;
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty-state">
      <div>🍽️</div>
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}
