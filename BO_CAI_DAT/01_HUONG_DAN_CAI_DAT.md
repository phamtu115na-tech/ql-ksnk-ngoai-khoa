# HƯỚNG DẪN CHI TIẾT CÀI MỚI GITHUB + SUPABASE + VERCEL

## 0. Chuẩn bị
Tài khoản GitHub, Supabase, Vercel; máy Windows 10/11 hoặc macOS/Linux có Internet; Node.js 24.x, npm, trình duyệt. Có thể dùng GitHub Desktop để đẩy mã không cần dòng lệnh. Với dữ liệu bệnh viện: yêu cầu phân quyền, sao lưu và chấp thuận lưu trữ phù hợp trước khi đưa vào hoạt động thực.

## 1. Tạo Supabase mới
1. Vào https://supabase.com/dashboard → New project. Tạo dự án riêng biệt; KHÔNG sử dụng ngay database bệnh viện đang vận hành.
2. Đặt mật khẩu database mạnh và lưu ở trình quản lý mật khẩu; không gửi lên ChatGPT, GitHub hoặc nhóm chat.
3. Vào SQL Editor → New query.
4. Mở 01_BAN_ON_DINH_PRODUCTION/supabase/CAI_DAT.sql bằng Notepad hoặc VS Code. Dán TOÀN BỘ vào SQL Editor, bấm Run. Chỉ chạy trên CSDL mới/trống; đọc kết quả báo lỗi để xử lý, KHÔNG chạy chồng nhiều file SQL.
5. Vào Table Editor và kiểm tra các bảng cx_people, cx_sessions, cx_threads, cx_messages, ksnk_legacy_rows. Vào Storage xem bucket riêng tư connect-files và documents theo BAT_DAU.html gốc. Nếu thiếu hãy kiểm tra SQL và quyền, không tự tạo bucket public để chữa lỗi.
6. Lấy Project URL dạng https://PROJECT_REF.supabase.co và API Secret key (thường có tiền tố sb_secret_) từ Connect hoặc Project Settings → API Keys. Hai giá trị phải thuộc CÙNG dự án.

## 2. Đưa toàn bộ mã lên GitHub
1. Tạo New Repository tại https://github.com/new. Nên dùng Private nếu kho chứa logic nghiệp vụ nội bộ.
2. Dùng GitHub Desktop: clone kho mới, chép NỘI DUNG của 01_BAN_ON_DINH_PRODUCTION vào root kho. Khi mở trang repo phải thấy package.json ở trang đầu (KHÔNG phải nằm trong một thư mục con).
3. Giữ các thư mục app, lib, public, supabase, docs, legacy-apps-script, tests và package-lock.json. Dùng .gitignore hiện có.
4. KHÔNG commit .env.local, khóa Supabase, file JSON service account Google, database backup hoặc danh sách nhân viên.
5. Commit và Push origin. Nếu muốn đóng gói phiên bản mở rộng, hãy tạo branch/repository riêng, không dùng database Production để thử migration.

## 3. Cài biến môi trường tại Vercel
1. Vào https://vercel.com/dashboard → Add New → Project → Import Git Repository.
2. Chọn kho GitHub vừa tạo. Framework Preset: Next.js. Root Directory: ./ (nơi có package.json). Node.js: 24.x (theo engines trong package.json).
3. Environment Variables → thêm:
   SUPABASE_URL = https://PROJECT_REF.supabase.co
   SUPABASE_SECRET_KEY = khóa server sb_secret_... của Supabase MỚI
   BOOTSTRAP_ADMIN_CODE = mã riêng do bạn tạo (ít nhất 12 ký tự, không quá 72 byte)
4. Với Supabase cũ dùng service_role, có thể chọn SUPABASE_SERVICE_ROLE_KEY thay cho SUPABASE_SECRET_KEY, tuyệt đối không chọn anon key. Xem 02_BIEN_MOI_TRUONG.md.
5. Chọn Production cho key thật của Production; Preview/Development nếu sử dụng phải có Supabase TEST độc lập. Lưu rồi Deploy. Khi đổi biến cần Redeploy bản mới.
6. Cấu hình vercel.json trong source gốc đã thiết lập npm ci, npm run build và sin1. Không phải nhập API token hay mật khẩu DB trong mã nguồn.
7. Khi phát hành có tên miền mới, mở https://TEN-MIEN/api/health; kỳ vọng HTTP 200 với ok:true, supabaseDatabaseReachable:true. Nếu 503, kiểm tra URL/key/SQL.

## 4. Đăng nhập lần đầu
1. Mở URL trang chính, chọn đơn vị Bệnh viện Ngoại khoa.
2. Tên đăng nhập: admin. Mã đăng nhập: giá trị BOOTSTRAP_ADMIN_CODE mà CHÍNH bạn vừa tạo.
3. Mã nguồn app/api/auth/route.ts tạo tài khoản admin đầu tiên khi chưa tồn tại. Đăng nhập thành công rồi đổi mật khẩu, kiểm tra phân quyền và tạo tài khoản khác.
4. Sau khi khởi tạo xong, cân nhắc xóa BOOTSTRAP_ADMIN_CODE khỏi biến môi trường rồi Redeploy. Không ghi mã khởi tạo vào hướng dẫn hoặc repo.

## 5. Cài ở máy cá nhân (tùy chọn)
1. Cài Node.js 24.x. Mở PowerShell tại thư mục 01_BAN_ON_DINH_PRODUCTION.
2. Chạy npm ci. Sao chép 00_HUONG_DAN/MAU_BIEN/.env.local.example thành .env.local trong gốc chứa package.json, tự điền khóa thật.
3. Chạy python 00_HUONG_DAN/CONG_CU/kiem_tra_env.py đường-dẫn-tệp-env để kiểm tra tên biến nhưng KHÔNG hiển thị giá trị.
4. Chạy npm run dev rồi mở http://localhost:3000. Để phát hành, kiểm tra npm run typecheck; npm run lint; npm test; npm run build.
5. Windows có script 00_HUONG_DAN/CONG_CU/01_CAI_DAT_WINDOWS.ps1 hỗ trợ cài npm ci và tạo .env.local mẫu.

## 6. Nghiệm thu trước khi sử dụng thực
- API /api/health trả ok:true.
- Tài khoản nhân viên/tổ trưởng/trưởng khoa đúng quyền, không xem/sửa nội dung ngoài phạm vi.
- Giao việc, nhắc việc, trò chuyện, hình ảnh, bảng kiểm, báo cáo Excel/PPTX chạy trên dữ liệu thử.
- Thu/mở menu tại Trang chủ, Giao việc, Nhắc việc trên máy tính và máy tính bảng.
- Đã sao lưu, có người chịu trách nhiệm quản trị, biết cách rollback và theo dõi chi phí CPU Vercel.

**Quan trọng:** Vercel Hobby có giới hạn Active CPU và điều khoản sử dụng; với phần mềm phục vụ hoạt động bệnh viện phải đánh giá gói/nhà cung cấp phù hợp. Không coi READY là đủ nếu URL vẫn trả HTTP 402.

Nguồn chính thức: https://supabase.com/docs/guides/getting-started/api-keys ; https://vercel.com/docs/environment-variables/managing-environment-variables ; https://vercel.com/docs/plans/hobby .