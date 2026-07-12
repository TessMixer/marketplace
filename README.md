# อิ่มดี — Food Marketplace MVP

เว็บแอป marketplace อาหารภาษาไทยสำหรับลูกค้า ร้านค้า และผู้ดูแลระบบ พัฒนาด้วย React 19, Next.js/Vinext, TypeScript และ Tailwind CSS ออกแบบแบบ Mobile First และรองรับ PWA

## เริ่มใช้งาน

ต้องมี Node.js `22.13.0` ขึ้นไป

```bash
npm install
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
- Mock data แยกไว้ที่ `app/data/mockData.ts` เพื่อเปลี่ยนเป็น Firebase หรือ Supabase repository ในระยะถัดไป

## โครงสร้างหลัก

- `app/components/MarketplaceApp.tsx` — หน้าจอและ interaction ของ MVP
- `app/data/mockData.ts` — type และข้อมูลจำลอง
- `app/globals.css` — design system และ responsive layout
- `app/manifest.ts`, `public/sw.js` — PWA

ข้อมูลยังเป็น mock state ในหน่วยความจำ เมื่อรีเฟรชหน้าจะกลับเป็นค่าเริ่มต้น เหมาะสำหรับทดสอบ UX ก่อนเชื่อมฐานข้อมูลและระบบยืนยันตัวตนจริง
