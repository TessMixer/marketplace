import type { Session, User } from "@supabase/supabase-js";
import { createContext, useContext } from "react";
import type { Role } from "../data/mockData";

export type Profile = {
  id:string;
  auth_user_id:string;
  name:string;
  phone:string|null;
  email:string|null;
  role:Role;
  account_status:"active"|"suspended"|"closed";
  suspended_reason:string|null;
  suspended_at:string|null;
  created_at:string;
};
export type RegisterInput = { name:string; phone:string; email:string; password:string; role:"customer"|"seller"; restaurantName?:string; restaurantDescription?:string; restaurantPhone?:string; restaurantAddress?:string; openTime?:string; closeTime?:string };
export type GoogleOnboardingInput = Omit<RegisterInput,"email"|"password">;

export type AuthContextValue = {
  session:Session|null; user:User|null; profile:Profile|null; profileError:string|null; loading:boolean; configured:boolean; passwordRecovery:boolean;
  signIn:(email:string,password:string)=>Promise<void>;
  signInWithGoogle:(input?:GoogleOnboardingInput)=>Promise<void>;
  register:(input:RegisterInput)=>Promise<{needsEmailConfirmation:boolean}>;
  sendPasswordReset:(email:string)=>Promise<void>;
  updatePassword:(password:string)=>Promise<void>;
  updateAccount:(input:{name:string;phone:string;email:string})=>Promise<{emailConfirmationRequired:boolean}>;
  signOut:()=>Promise<void>; refreshProfile:()=>Promise<void>;
};

export const AuthContext = createContext<AuthContextValue|null>(null);

export function useAuth(){
  const context=useContext(AuthContext);
  if(!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
