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
npm run check
```

Production build อยู่ในโฟลเดอร์ `dist`

## ฟีเจอร์หลัก

- ลูกค้า: ค้นหาร้านและเมนู จัดการตะกร้า เลือกรับเองที่ร้านหรือให้ร้านติดต่อกลับ และดูสถานะ/ประวัติออเดอร์
- ผู้ขาย: Dashboard รับและปฏิเสธออเดอร์ เปลี่ยนสถานะ จัดการเมนู เปิด/ปิดร้าน และดูรายงานยอดขาย
- อัปโหลดรูปร้านและรูปเมนูจากมือถือผ่าน Supabase Storage พร้อมบีบอัดเป็น WebP
- แจ้งเตือนออเดอร์ใหม่แบบ Realtime พร้อมเสียงและ Browser Notification
- ตั้งเวลารับอาหาร จำกัดออเดอร์พร้อมกัน และตรวจเวลาเปิด–ปิดร้านจาก RPC
- พิมพ์ใบออเดอร์ ดาวน์โหลดรายงาน CSV ลืมรหัสผ่าน และแก้ไขโปรไฟล์
- เข้าสู่ระบบด้วย Google ผ่าน Supabase OAuth; ร้านที่สมัครด้วย Google ยังคงเป็น `pending` จนกว่า Admin จะอนุมัติ
- Admin: อนุมัติหรือระงับร้าน ตั้งค่า GP ดูออเดอร์ ผู้ใช้ และรายงานระบบ
- Supabase Auth, Row Level Security, Realtime และ RPC คำนวณราคา/GP จากข้อมูลจริงในฐานข้อมูล
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

## Production security checklist

- เปลี่ยนรหัสผ่านบัญชีตัวอย่างก่อนเปิดให้บุคคลทั่วไปใช้งาน และเปิด MFA สำหรับ Admin ใน Supabase
- ตั้ง Custom SMTP ที่ `Authentication → Emails` เพื่อให้ยืนยันอีเมลและรีเซ็ตรหัสผ่านส่งได้เสถียร
- ตั้ง Site URL เป็นโดเมน Production และเพิ่ม `https://your-domain.example/**` ใน Redirect URLs
- เปิด Google Provider ใน Supabase Auth และกำหนด Google OAuth Client ID/Secret โดยไม่บันทึก Secret ลง Git
- เพิ่ม Supabase callback URL ใน Google OAuth Authorized redirect URIs
- หน้าเว็บบังคับรหัสผ่านใหม่อย่างน้อย 10 ตัวอักษรและต้องมีตัวอักษรกับตัวเลข ส่วนบัญชีเก่ายังเข้าสู่ระบบได้เพื่อเปลี่ยนรหัสผ่าน
- `vercel.json` กำหนด CSP, anti-framing, referrer และ permissions headers สำหรับ Production
- GitHub Actions รัน lint, test และ build ทุกครั้งที่ push หรือเปิด Pull Request
- ห้ามเก็บ `.env`, service role key, database password หรือ SMTP password ใน GitHub/Vercel ฝั่ง client

## Supabase

รันไฟล์ใน `supabase/migrations` ตามลำดับก่อนใช้งานระบบจริง ราคาเมนูและค่า GP ถูกคำนวณจาก RPC ฝั่งฐานข้อมูล ไม่เชื่อค่าราคาจาก frontend

ระบบนี้ไม่มีคนขับ การติดตามตำแหน่ง หรือค่าจัดส่ง โดยออเดอร์ใหม่จะบันทึก `delivery_fee` เป็น `0` และ `grand_total` เท่ากับ `food_total` ส่วนคอลัมน์ขนส่งเดิมยังคงไว้เพื่อรองรับข้อมูลเก่าแต่ไม่ถูกใช้ใน UI

Realtime ของตาราง `orders` ถูกกรองด้วย RLS: ลูกค้าเห็นเฉพาะออเดอร์ตัวเอง ผู้ขายเห็นเฉพาะออเดอร์ของร้านตัวเอง และ Admin เห็นออเดอร์ทั้งหมด การสร้างออเดอร์และเปลี่ยนสถานะทำผ่าน RPC เท่านั้น เพื่อป้องกันการแก้ยอดเงินหรือ GP โดยตรงจาก client
