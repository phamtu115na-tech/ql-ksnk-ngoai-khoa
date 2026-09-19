import { createClient } from '@supabase/supabase-js';
const fallbackUrl='https://swgpwbrtxvezkykablws.supabase.co';
const fallbackAnon='sb_publishable_9r1va6JjYbcbXmnDn7Z6CQ_-VrBW0Yu';
export function supabaseBrowser(){return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL||fallbackUrl,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||fallbackAnon)}
export function supabaseAdmin(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL||fallbackUrl;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!key)return null;return createClient(url,key,{auth:{persistSession:false}})}
