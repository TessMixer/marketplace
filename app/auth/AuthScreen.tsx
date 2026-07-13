"use client";

import { FormEvent, useState } from "react";
import { ArrowLeft, Check, Clock3, Eye, EyeOff, LockKeyhole, Mail, MapPin, Phone, Store, UserRound, UtensilsCrossed } from "lucide-react";
import { RegisterInput, useAuth } from "./AuthProvider";

export default function AuthScreen(){
  const {signIn,register}=useAuth();
  const [mode,setMode]=useState<"login"|"register">("login");
  const [showPassword,setShowPassword]=useState(false);
  const [busy,setBusy]=useState(false); const [error,setError]=useState(""); const [success,setSuccess]=useState("");
  const [form,setForm]=useState<RegisterInput>({name:"",phone:"",email:"",password:"",role:"customer",restaurantName:"",restaurantDescription:"",restaurantPhone:"",restaurantAddress:"",openTime:"08:00",closeTime:"20:00"});
  const update=(key:keyof RegisterInput,value:string)=>setForm(current=>({...current,[key]:value}));

  const submit=async(event:FormEvent)=>{
    event.preventDefault(); setBusy(true); setError(""); setSuccess("");
    try{
      if(mode==="login") await signIn(form.email,form.password);
      else { const result=await register(form); if(result.needsEmailConfirmation){setSuccess("สมัครสำเร็จ กรุณาเปิดอีเมลเพื่อยืนยันบัญชีก่อนเข้าสู่ระบบ");setMode("login");} }
    }catch(caught:unknown){
      const message=caught instanceof Error?caught.message:"";
      setError(message==="Invalid login credentials"
        ?"อีเมลหรือรหัสผ่านไม่ถูกต้อง"
        :message.toLowerCase().includes("email rate limit")
          ?"ระบบส่งอีเมลยืนยันครบโควตาชั่วคราว กรุณารอสักครู่แล้วลองใหม่"
          :message||"เกิดข้อผิดพลาด กรุณาลองใหม่");
    }
    finally{setBusy(false);}
  };

  return <main className="auth-page">
    <section className="auth-brand-panel"><div className="auth-brand"><span><UtensilsCrossed/></span><b>อิ่มดี</b></div><div><span className="auth-kicker">ตลาดอาหารออนไลน์สำหรับทุกคน</span><h1>สั่งง่าย<br/>ขายคล่อง<br/><em>จัดการครบ</em></h1><p>ระบบเดียวสำหรับลูกค้า ร้านค้า และผู้ดูแล</p></div><ul><li><Check/> ร้านอาหารคุณภาพใกล้บ้าน</li><li><Check/> ร้านค้าจัดการออเดอร์ได้ทันที</li><li><Check/> ปลอดภัยด้วย Supabase Auth</li></ul></section>
    <section className="auth-form-panel"><div className="auth-card">
      {mode==="register"&&<button className="auth-back" type="button" onClick={()=>setMode("login")}><ArrowLeft/> กลับหน้าเข้าสู่ระบบ</button>}
      <span className="auth-kicker">{mode==="login"?"ยินดีต้อนรับกลับมา":"เริ่มต้นใช้งานอิ่มดี"}</span><h2>{mode==="login"?"เข้าสู่ระบบ":"สร้างบัญชีใหม่"}</h2><p>{mode==="login"?"กรอกข้อมูลเพื่อเข้าสู่บัญชีของคุณ":"สมัครได้ฟรี ใช้เวลาไม่เกิน 2 นาที"}</p>
      <form onSubmit={submit}>
        {mode==="register"&&<><div className="auth-role-choice"><button type="button" className={form.role==="customer"?"active":""} onClick={()=>update("role","customer")}><UserRound/><span><b>ลูกค้า</b><small>สั่งอาหารและดูสถานะออเดอร์</small></span></button><button type="button" className={form.role==="seller"?"active":""} onClick={()=>update("role","seller")}><Store/><span><b>ผู้ขาย</b><small>เปิดร้านและจัดการออเดอร์</small></span></button></div><div className="auth-grid"><AuthField icon={<UserRound/>} label="ชื่อ-นามสกุล" value={form.name} onChange={v=>update("name",v)} placeholder="ชื่อของคุณ"/><AuthField icon={<Phone/>} label="เบอร์โทรศัพท์" value={form.phone} onChange={v=>update("phone",v)} placeholder="08x-xxx-xxxx"/></div></>}
        <AuthField icon={<Mail/>} label="อีเมล" type="email" value={form.email} onChange={v=>update("email",v)} placeholder="name@example.com"/>
        <label className="auth-field"><span>รหัสผ่าน</span><div><LockKeyhole/><input required minLength={6} type={showPassword?"text":"password"} value={form.password} onChange={e=>update("password",e.target.value)} placeholder="อย่างน้อย 6 ตัวอักษร"/><button type="button" onClick={()=>setShowPassword(v=>!v)} aria-label="แสดงหรือซ่อนรหัสผ่าน">{showPassword?<EyeOff/>:<Eye/>}</button></div></label>
        {mode==="register"&&form.role==="seller"&&<div className="seller-register"><div className="seller-form-head"><Store/><span><b>ข้อมูลร้านอาหาร</b><small>ร้านใหม่จะรอ Admin ตรวจสอบก่อนเปิดขาย</small></span></div><AuthField icon={<UtensilsCrossed/>} label="ชื่อร้าน" value={form.restaurantName??""} onChange={v=>update("restaurantName",v)} placeholder="เช่น ครัวแม่อร"/><label className="auth-field"><span>คำอธิบายร้าน</span><textarea required value={form.restaurantDescription} onChange={e=>update("restaurantDescription",e.target.value)} placeholder="บอกจุดเด่นของร้านคุณ"/></label><div className="auth-grid"><AuthField icon={<Phone/>} label="เบอร์ร้าน" value={form.restaurantPhone??""} onChange={v=>update("restaurantPhone",v)} placeholder="02-xxx-xxxx"/><AuthField icon={<MapPin/>} label="ที่อยู่ร้าน" value={form.restaurantAddress??""} onChange={v=>update("restaurantAddress",v)} placeholder="ที่อยู่ร้าน"/></div><div className="auth-grid"><AuthField icon={<Clock3/>} label="เวลาเปิด" type="time" value={form.openTime??""} onChange={v=>update("openTime",v)}/><AuthField icon={<Clock3/>} label="เวลาปิด" type="time" value={form.closeTime??""} onChange={v=>update("closeTime",v)}/></div></div>}
        {error&&<div className="auth-message error">{error}</div>}{success&&<div className="auth-message success">{success}</div>}
        <button className="auth-submit" disabled={busy}>{busy?"กำลังดำเนินการ...":mode==="login"?"เข้าสู่ระบบ":"สมัครสมาชิก"}</button>
      </form>
      <div className="auth-switch">{mode==="login"?"ยังไม่มีบัญชี?":"มีบัญชีอยู่แล้ว?"}<button onClick={()=>{setMode(mode==="login"?"register":"login");setError("");setSuccess("");}}>{mode==="login"?"สมัครสมาชิก":"เข้าสู่ระบบ"}</button></div>
    </div><div className="auth-connected"><i/> Supabase Connected · ข้อมูลถูกเข้ารหัสอย่างปลอดภัย</div></section>
  </main>;
}

function AuthField({icon,label,value,onChange,placeholder="",type="text"}:{icon:React.ReactNode;label:string;value:string;onChange:(value:string)=>void;placeholder?:string;type?:string}){return <label className="auth-field"><span>{label}</span><div>{icon}<input required type={type} value={value} onChange={event=>onChange(event.target.value)} placeholder={placeholder}/></div></label>}
