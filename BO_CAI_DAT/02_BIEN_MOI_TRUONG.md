# DANH SÁCH BIẾN MÔI TRƯỜNG VÀ CÁCH ĐIỀN

Đường đi: Vercel → Project → Settings → Environment Variables → Add. Local: dùng .env.local ở thư mục chứa package.json (KHÔNG commit).

## Ba biến cơ bản (xem app/api/auth/route.ts và lib/supabase.ts)
| Key | Giá trị cần điền | Mức bảo mật |
|---|---|---|
| SUPABASE_URL | https://MA_DU_AN.supabase.co của Supabase mới | Cấu hình URL máy chủ |
| SUPABASE_SECRET_KEY | Khóa sb_secret_... lấy tại Supabase Project Settings → API Keys | BÍ MẬT, chỉ server |
| BOOTSTRAP_ADMIN_CODE | Mã bạn tự tạo từ 12 ký tự, tối đa 72 byte cho admin lần đầu | BÍ MẬT, chỉ server |

Có thể sử dụng SUPABASE_SERVICE_ROLE_KEY thay cho SUPABASE_SECRET_KEY nếu buộc dùng loại service_role cũ; không đưa cả nhiều khóa từ các dự án khác nhau. Mã lib/supabase.ts cũng hỗ trợ alias SUPABASE_SERVICE_KEY, SUPABASE_ADMIN_KEY nhưng không cần cấu hình khi đã có secret key.

## Tùy chọn (không thêm nếu không sử dụng)
- SUPABASE_PROJECT_REF: mã dự án dùng so sánh cấu hình, không phải khóa.
- NEXT_PUBLIC_SUPABASE_URL: URL công khai nếu frontend cần client Supabase; không chứa mật khẩu.
- NEXT_PUBLIC_SUPABASE_ANON_KEY: chỉ điền publishable/anon nếu frontend cần. TUYỆT ĐỐI không điền secret/service_role vào biến NEXT_PUBLIC_.
- SUPABASE_STORAGE_BUCKET: ghi đè bucket minh chứng mặc định documents (app/api/evidence/route.ts).
- GOOGLE_SHEETS_CLIENT_EMAIL: email service account khi cần đọc Google Sheets riêng tư (lib/google-sheet.ts).
- GOOGLE_SHEETS_PRIVATE_KEY: khóa riêng service account Google, chỉ ở môi trường server; xử lý xuống dòng phù hợp. Phải chia sẻ Sheet cho tài khoản dịch vụ ở quyền Reader.
- NODE_ENV: Next.js/Vercel thường tự xác định; không bắt buộc nhập.

## Ví dụ thao tác
Tại Vercel, chọn Production rồi thêm từng cặp Key/Value. Đảm bảo SUPABASE_URL và SUPABASE_SECRET_KEY của CÙNG một dự án. Sau khi lưu, Redeploy mới có hiệu lực. Preview nên có database TEST độc lập.

Không bao giờ lưu key thật trong .env.example, file HTML, GitHub repository, file nén chia sẻ hoặc hình ảnh. Nếu lộ, hãy rotate tại Supabase và cập nhật server.

Dùng 00_HUONG_DAN/CONG_CU/kiem_tra_env.py để kiểm tra thiết lập cục bộ mà không in bí mật.
