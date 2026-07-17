"use client";

import type { Session, User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import type { Role } from "../data/mockData";

export type Profile = { id:string; auth_user_id:string; name:string; phone:string|null; email:string|null; role:Role; created_at:string };
export type RegisterInput = { name:string; phone:string; email:string; password:string; role:"customer"|"seller"; restaurantName?:string; restaurantDescription?:string; restaurantPhone?:string; restaurantAddress?:string; openTime?:string; closeTime?:string };

type AuthContextValue = {
  session:Session|null; user:User|null; profile:Profile|null; profileError:string|null; loading:boolean; configured:boolean; passwordRecovery:boolean;
  signIn:(email:string,password:string)=>Promise<void>;
  register:(input:RegisterInput)=>Promise<{needsEmailConfirmation:boolean}>;
  sendPasswordReset:(email:string)=>Promise<void>;
  updatePassword:(password:string)=>Promise<void>;
  updateAccount:(input:{name:string;phone:string;email:string})=>Promise<{emailConfirmationRequired:boolean}>;
  signOut:()=>Promise<void>; refreshProfile:()=>Promise<void>;
};

const AuthContext = createContext<AuthContextValue|null>(null);

async function loadProfile(userId:string) {
  if(!supabase) return null;
  const {data,error}=await supabase.from("profiles").select("id,auth_user_id,name,phone,email,role,created_at").eq("auth_user_id",userId).single();
  if(error) throw error;
  return data as Profile;
}

export function AuthProvider({children}:{children:React.ReactNode}) {
  const [session,setSession]=useState<Session|null>(null);
  const [profile,setProfile]=useState<Profile|null>(null);
  const [profileError,setProfileError]=useState<string|null>(null);
  const [loading,setLoading]=useState(isSupabaseConfigured);
  const [passwordRecovery,setPasswordRecovery]=useState(false);

  const refreshProfile=async()=>{
    if(!session?.user) return;
    setLoading(true); setProfileError(null);
    try { setProfile(await loadProfile(session.user.id)); }
    catch(caught) { setProfile(null); setProfileError(caught instanceof Error?caught.message:"ไม่สามารถโหลดสิทธิ์ผู้ใช้ได้"); }
    finally { setLoading(false); }
  };

  useEffect(()=>{
    if(!supabase) return;
    supabase.auth.getSession().then(async({data})=>{
      setSession(data.session);
      if(data.session?.user) {
        try { setProfile(await loadProfile(data.session.user.id)); setProfileError(null); }
        catch(caught) { setProfile(null); setProfileError(caught instanceof Error?caught.message:"ไม่สามารถโหลดสิทธิ์ผู้ใช้ได้"); }
      }
      setLoading(false);
    });
    const {data:{subscription}}=supabase.auth.onAuthStateChange((event,nextSession)=>{
      if(event==="PASSWORD_RECOVERY") setPasswordRecovery(true);
      setSession(nextSession);
      if(nextSession?.user) window.setTimeout(()=>loadProfile(nextSession.user.id).then(nextProfile=>{setProfile(nextProfile);setProfileError(null);}).catch(caught=>{setProfile(null);setProfileError(caught instanceof Error?caught.message:"ไม่สามารถโหลดสิทธิ์ผู้ใช้ได้");}).finally(()=>setLoading(false)),0);
      else { setProfile(null); setProfileError(null); setLoading(false); }
    });
    return()=>subscription.unsubscribe();
  },[]);

  const signIn=async(email:string,password:string)=>{
    if(!supabase) throw new Error("ยังไม่ได้เชื่อมต่อ Supabase");
    const {data,error}=await supabase.auth.signInWithPassword({email,password});
    if(error) throw error;
    setSession(data.session);
    try { setProfile(await loadProfile(data.user.id)); setProfileError(null); }
    catch(caught) { setProfile(null); setProfileError(caught instanceof Error?caught.message:"ไม่สามารถโหลดสิทธิ์ผู้ใช้ได้"); throw caught; }
  };

  const register=async(input:RegisterInput)=>{
    if(!supabase) throw new Error("ยังไม่ได้เชื่อมต่อ Supabase");
    const {data,error}=await supabase.auth.signUp({email:input.email,password:input.password,options:{data:{
      name:input.name,phone:input.phone,role:input.role,
      restaurant_name:input.restaurantName,restaurant_description:input.restaurantDescription,
      restaurant_phone:input.restaurantPhone,restaurant_address:input.restaurantAddress,
      open_time:input.openTime,close_time:input.closeTime,
    }}});
    if(error) throw error;
    if(data.session && data.user){ setSession(data.session); setProfile(await loadProfile(data.user.id)); }
    return {needsEmailConfirmation:!data.session};
  };

  const sendPasswordReset=async(email:string)=>{
    if(!supabase) throw new Error("ยังไม่ได้เชื่อมต่อ Supabase");
    const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin});
    if(error) throw error;
  };

  const updatePassword=async(password:string)=>{
    if(!supabase) throw new Error("ยังไม่ได้เชื่อมต่อ Supabase");
    const {error}=await supabase.auth.updateUser({password});
    if(error) throw error;
    setPasswordRecovery(false);
    await supabase.auth.signOut();
    setSession(null); setProfile(null);
  };

  const updateAccount=async(input:{name:string;phone:string;email:string})=>{
    if(!supabase||!session?.user||!profile) throw new Error("กรุณาเข้าสู่ระบบใหม่");
    const nextEmail=input.email.trim().toLowerCase();
    const currentEmail=(session.user.email??profile.email??"").toLowerCase();
    let emailConfirmationRequired=false;
    if(nextEmail&&nextEmail!==currentEmail){
      const {error}=await supabase.auth.updateUser({email:nextEmail});
      if(error) throw error;
      emailConfirmationRequired=true;
    }
    const {error}=await supabase.from("profiles").update({name:input.name.trim(),phone:input.phone.trim(),email:nextEmail||currentEmail}).eq("id",profile.id);
    if(error) throw error;
    setProfile(await loadProfile(session.user.id));
    return {emailConfirmationRequired};
  };

  const signOut=async()=>{ if(supabase) await supabase.auth.signOut(); setSession(null); setProfile(null); setProfileError(null); };

  return <AuthContext.Provider value={{session,user:session?.user??null,profile,profileError,loading,configured:isSupabaseConfigured,passwordRecovery,signIn,register,sendPasswordReset,updatePassword,updateAccount,signOut,refreshProfile}}>{children}</AuthContext.Provider>;
}

export function useAuth(){ const context=useContext(AuthContext); if(!context) throw new Error("useAuth must be used within AuthProvider"); return context; }
