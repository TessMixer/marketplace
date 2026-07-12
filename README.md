# อิ่มดี — Food Marketplace

เว็บแอป marketplace อาหารภาษาไทยสำหรับลูกค้า ร้านค้า และผู้ดูแลระบบ พัฒนาด้วย React 19, Vite, TypeScript และ Supabase รองรับ Mobile First และ PWA

## เริ่มใช้งาน

ต้องมี Node.js 22 ขึ้นไป

```bash
npm install
copy .env.example .env.local
npm run dev
```

เปิด `http://localhost:5173`

ตั้งค่าใน `.env.local`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-or-publishable-key
```

ใช้เฉพาะ Supabase anon/publishable key ใน frontend ห้ามใช้ service role key หรือ database password

## คำสั่ง

```bash
npm run dev
npm run build
npm run preview
npm run lint
npm test
```

Production build อยู่ในโฟลเดอร์ `dist`

## ฟีเจอร์หลัก

- ลูกค้า: ค้นหาร้านและเมนู ตะกร้า GPS ค่าส่ง สั่งอาหาร และติดตามออเดอร์
- ผู้ขาย: Dashboard เมนู ออเดอร์ ข้อมูลร้าน พิกัดร้าน และรายงานยอดขาย
- Admin: ร้านค้า ผู้ใช้ ออเดอร์ GP พิกัดร้าน และรายงานระบบ
- Supabase Auth, Row Level Security, RPC คำนวณ GP/ค่าส่ง และ migrations
- PWA manifest และ service worker

## Deploy บน Vercel

1. Import repository `TessMixer/marketplace`
2. Framework Preset เลือก `Vite`
3. Build Command ใช้ `npm run build`
4. Output Directory ใช้ `dist`
5. เพิ่ม Environment Variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
6. กด Deploy

`vercel.json` รองรับ SPA fallback โดยให้ไฟล์จริงใน `dist` ทำงานตามปกติ และส่ง route อื่นกลับไป `index.html`

## Supabase

รันไฟล์ใน `supabase/migrations` ตามลำดับก่อนใช้งานระบบจริง ค่า GP และค่าส่งถูกคำนวณจาก RPC ฝั่งฐานข้อมูล ไม่เชื่อค่าราคาจาก frontend
