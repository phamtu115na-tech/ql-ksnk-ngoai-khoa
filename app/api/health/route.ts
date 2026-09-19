import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase';
export async function GET(){return NextResponse.json({ok:true,app:'QL-KSNK-NGOAIKHOA',supabaseServerConfigured:!!supabaseAdmin()})}
