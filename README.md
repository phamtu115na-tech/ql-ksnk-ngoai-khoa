# QL KSNK Ngoại Khoa

Next.js + Vercel + Supabase.

## Vercel
Import repo này vào Vercel. Build command: `npm run build`. Framework: Next.js.

Biến môi trường nên cấu hình trên Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`, `APP_DEFAULT_PASSWORD`.

Không commit service-role key hoặc SESSION_SECRET vào GitHub.
