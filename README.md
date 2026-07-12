# อิ่มดี — Food Marketplace MVP

เว็บแอป marketplace อาหารภาษาไทยสำหรับลูกค้า ร้านค้า และผู้ดูแลระบบ พัฒนาด้วย React 19, Next.js/Vinext, TypeScript, Tailwind CSS และ Supabase ออกแบบแบบ Mobile First และรองรับ PWA

## เริ่มใช้งาน

ต้องมี Node.js `22.13.0` ขึ้นไป

```bash
npm install
copy .env.example .env.local
npm run dev
```

จากนั้นเปิด `http://localhost:3000` และเปลี่ยนบทบาทจากตัวเลือก “ลูกค้า / ผู้ขาย / Admin” ด้านบนเพื่อทดลองแต่ละระบบ

ตรวจ production build:

```bash
npm run build
npm run start
```

## ฟีเจอร์ใน MVP

- ลูกค้า: ดูและค้นหาร้าน/เมนู, เพิ่มตะกร้า, ระบุหมายเหตุ, สรุปยอด และติดตามออเดอร์
- ผู้ขาย: Dashboard, รับ/ปฏิเสธ/อัปเดตออเดอร์, เพิ่มและเปิด-ปิดเมนู, รายงานยอดขาย และข้อมูลร้าน
- Admin: Dashboard ระบบ, ร้านค้า, ผู้ใช้, ออเดอร์, GP รายร้าน และรายงาน
- PWA: manifest, theme color และ service worker สำหรับติดตั้งบนหน้าจอมือถือ
- Supabase catalog และ order RPC พร้อม RLS policy; ใช้ mock data เป็น fallback เมื่อฐานข้อมูลไม่พร้อม

## โครงสร้างหลัก

- `app/components/MarketplaceApp.tsx` — หน้าจอและ interaction ของ MVP
- `app/data/mockData.ts` — type และข้อมูลจำลอง
- `app/lib/supabase.ts` — Supabase browser client
- `app/services/marketplaceRepository.ts` — repository สำหรับร้าน เมนู และออเดอร์
- `supabase/migrations/` — schema, RLS, RPC และ seed data
- `app/globals.css` — design system และ responsive layout
- `app/manifest.ts`, `public/sw.js` — PWA

ใส่ `NEXT_PUBLIC_SUPABASE_URL` และ `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` ใน `.env.local` ตาม `.env.example` ร้านและเมนูจะโหลดจาก Supabase โดยอัตโนมัติ ส่วนการแก้ไขข้อมูลผู้ขาย/Admin ต้องเข้าสู่ระบบด้วยบัญชีที่มี role และ ownership ถูกต้องตาม RLS

## Login, Register และสิทธิ์ผู้ใช้

- ลูกค้าสมัครด้วยชื่อ เบอร์โทร อีเมล และรหัสผ่าน ระบบจะสร้าง `profiles` ที่มี role เป็น `customer`
- ผู้ขายกรอกข้อมูลร้านเพิ่ม ระบบจะสร้าง profile role `seller` และร้านสถานะ `pending` โดยอัตโนมัติ
- หลัง Login ระบบอ่าน role จาก `profiles` แล้วเปิดหน้าลูกค้า, Seller Dashboard หรือ Admin Dashboard ตามสิทธิ์
- RLS ของ Supabase ป้องกันลูกค้าเข้าถึงข้อมูลจัดการร้าน และป้องกันผู้ขายเข้าถึงข้อมูล Admin

ก่อนทดสอบให้รัน migration ใน `supabase/migrations/` ตามลำดับ หากเปิด Email confirmation ใน Supabase ผู้ใช้ต้องกดลิงก์ยืนยันอีเมลก่อน Login

การตั้ง Admin คนแรก ให้สมัครบัญชีปกติก่อน แล้วรันใน Supabase SQL Editor ด้วยสิทธิ์ postgres:

```sql
update public.profiles
set role = 'admin'
where email = 'admin@example.com';
```

จากนั้น Logout และ Login ใหม่ บัญชีนี้จะถูกส่งไปหน้า Admin Dashboard ส่วนการสมัครจากหน้าเว็บไม่อนุญาตให้เลือก role `admin`

ไฟล์ migration สำหรับระบบ Auth คือ:

- `20260713023000_auth_roles_and_registration.sql` — profile/auth mapping, trigger สมัครสมาชิก, ร้าน pending และ RLS ตาม role
- `20260713024500_allow_admin_bootstrap.sql` — อนุญาต trusted SQL/service context ตั้ง Admin คนแรก โดยยังป้องกันผู้ใช้เลื่อนสิทธิ์ตัวเอง
