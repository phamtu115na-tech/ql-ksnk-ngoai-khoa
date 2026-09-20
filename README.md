# QL KSNK Ngoại Khoa

Next.js + Vercel + Supabase.

## Vercel

Import repo này vào Vercel. Build command: `npm run build`. Framework: Next.js.

Biến môi trường Production cần cấu hình trên Vercel:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` hoặc `SUPABASE_SECRET_KEY`
- `SESSION_SECRET` tối thiểu 32 ký tự
- `APP_DEFAULT_PASSWORD`

Không commit service-role key, secret key hoặc SESSION_SECRET vào GitHub.

## Nhập dữ liệu workbook cũ không mất dữ liệu

Repository có sẵn API `/api/import/workbook` và helper Apps Script:

`legacy-apps-script/99_ExportWorkbookToVercel.gs`

Quy trình:

1. Deploy Production URL.
2. Trong Apps Script, đặt Script property `MIGRATION_PASSWORD` bằng mật khẩu quản trị hiện tại.
3. Sao chép hàm `migrateWorkbookToVercel()` vào cùng project có `00_Config.gs`.
4. Chạy hàm một lần và cấp quyền `UrlFetchApp` nếu Google yêu cầu.
5. Kiểm tra `/api/status`: `legacyRows` phải lớn hơn 0.

Migration dùng khóa `sheet_name + row_no`, chỉ upsert, không truncate và không xóa dữ liệu nguồn/đích. Chạy lại an toàn khi cần đồng bộ thay đổi.

Prompt nghiệm thu đầy đủ nằm tại `docs/MIGRATION_PROMPT.md`.
