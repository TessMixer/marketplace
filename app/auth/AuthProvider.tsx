"use client";

import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { AuthContext, type GoogleOnboardingInput, type Profile, type RegisterInput } from "./authContext";

const GOOGLE_ONBOARDING_KEY="imdee-google-onboarding";

type StoredGoogleOnboarding = GoogleOnboardingInput & {createdAt:number};

async function loadProfile(userId:string) {
  if(!supabase) return null;
  const {data,error}=await supabase.from("profiles").select("id,auth_user_id,name,phone,email,role,created_at").eq("auth_user_id",userId).single();
  if(error) throw error;
  return data as Profile;
}

async function completeGoogleOnboarding(userId:string) {
  if(!supabase) return null;
  const stored=sessionStorage.getItem(GOOGLE_ONBOARDING_KEY);
  if(!stored) return loadProfile(userId);
  try {
    const input=JSON.parse(stored) as StoredGoogleOnboarding;
    if(!input.createdAt||Date.now()-input.createdAt>30*60*1000) {
      sessionStorage.removeItem(GOOGLE_ONBOARDING_KEY);
      return loadProfile(userId);
    }
    const {error}=await supabase.rpc("complete_google_onboarding",{
      p_role:input.role,
      p_name:input.name,
      p_phone:input.phone,
      p_restaurant_name:input.restaurantName??null,
      p_restaurant_description:input.restaurantDescription??null,
      p_restaurant_phone:input.restaurantPhone??null,
      p_restaurant_address:input.restaurantAddress??null,
      p_open_time:input.openTime??null,
      p_close_time:input.closeTime??null,
    });
    if(error) throw error;
    sessionStorage.removeItem(GOOGLE_ONBOARDING_KEY);
    return loadProfile(userId);
  } catch(caught) {
    if(caught instanceof SyntaxError) sessionStorage.removeItem(GOOGLE_ONBOARDING_KEY);
    throw caught;
  }
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
    try { setProfile(await completeGoogleOnboarding(session.user.id)); }
    catch(caught) { setProfile(null); setProfileError(caught instanceof Error?caught.message:"ไม่สามารถโหลดสิทธิ์ผู้ใช้ได้"); }
    finally { setLoading(false); }
  };

  useEffect(()=>{
    if(!supabase) return;
    supabase.auth.getSession().then(async({data})=>{
      setSession(data.session);
      if(data.session?.user) {
        try { setProfile(await completeGoogleOnboarding(data.session.user.id)); setProfileError(null); }
        catch(caught) { setProfile(null); setProfileError(caught instanceof Error?caught.message:"ไม่สามารถโหลดสิทธิ์ผู้ใช้ได้"); }
      }
      setLoading(false);
    });
    const {data:{subscription}}=supabase.auth.onAuthStateChange((event,nextSession)=>{
      if(event==="PASSWORD_RECOVERY") setPasswordRecovery(true);
      setSession(nextSession);
      if(nextSession?.user) window.setTimeout(()=>completeGoogleOnboarding(nextSession.user.id).then(nextProfile=>{setProfile(nextProfile);setProfileError(null);}).catch(caught=>{setProfile(null);setProfileError(caught instanceof Error?caught.message:"ไม่สามารถโหลดสิทธิ์ผู้ใช้ได้");}).finally(()=>setLoading(false)),0);
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

  const signInWithGoogle=async(input?:GoogleOnboardingInput)=>{
    if(!supabase) throw new Error("ยังไม่ได้เชื่อมต่อ Supabase");
    if(input) sessionStorage.setItem(GOOGLE_ONBOARDING_KEY,JSON.stringify({...input,createdAt:Date.now()}));
    else sessionStorage.removeItem(GOOGLE_ONBOARDING_KEY);
    const {error}=await supabase.auth.signInWithOAuth({
      provider:"google",
      options:{redirectTo:window.location.origin,queryParams:{prompt:"select_account"}},
    });
    if(error) {
      sessionStorage.removeItem(GOOGLE_ONBOARDING_KEY);
      throw error;
    }
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

  return <AuthContext.Provider value={{session,user:session?.user??null,profile,profileError,loading,configured:isSupabaseConfigured,passwordRecovery,signIn,signInWithGoogle,register,sendPasswordReset,updatePassword,updateAccount,signOut,refreshProfile}}>{children}</AuthContext.Provider>;
}
