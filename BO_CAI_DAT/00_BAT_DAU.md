# BỘ CÀI ĐẶT QUẢN LÝ KSNK NGOẠI KHOA — ĐỌC TRƯỚC

Gói dành cho người bắt đầu từ số 0 với GitHub (mã nguồn) + Supabase (cơ sở dữ liệu) + Vercel (website và API). Ngày đóng gói: 25/11/2026.

## Các thư mục trong gói ZIP
- 00_HUONG_DAN: Hướng dẫn tiếng Việt, biến môi trường, công cụ kiểm tra và PowerShell cho Windows.
- 01_BAN_ON_DINH_PRODUCTION: NGUYÊN BỘ mã nguồn tại commit 512dbcd3fe419e9a74a5eaabfc7bc895bda13849, bản đã triển khai vào Production trước đó. Dùng bản này để cài mới.
- 02_BAN_MO_RONG_PR13_THU_NGHIEM: NGUYÊN BỘ mã nguồn tại commit 1af195ab7190a1487786835af801f696cba92b4e của PR #13. Có thêm ma trận phân quyền, SQL nâng cấp; CHƯA được nghiệm thu trên Production, chỉ dùng môi trường thử nghiệm riêng.
- SHA256SUMS.txt: danh sách hàm băm kiểm tra toàn vẹn các tệp.
- THONG_TIN_NGUON.txt: phiên bản GitHub và SHA từng bản.

Gói KHÔNG có cơ sở dữ liệu, tài khoản nhân viên, hồ sơ bệnh nhân, API keys, khóa bí mật, mật khẩu hoặc dữ liệu Supabase thật. Muốn sao chép dữ liệu phải có backup/restore riêng theo quy định và quyền của đơn vị.

## Lộ trình khuyến nghị
1. Đọc 01_HUONG_DAN_CAI_DAT.md.
2. Tạo Supabase MỚI, chạy file supabase/CAI_DAT.sql của bản mã nguồn đã chọn trên database trống.
3. Tạo GitHub repository MỚI, đẩy nội dung thư mục 01_BAN_ON_DINH_PRODUCTION vào gốc kho (tại đó có package.json).
4. Tạo Vercel project từ GitHub repository MỚI, thêm SUPABASE_URL, SUPABASE_SECRET_KEY, BOOTSTRAP_ADMIN_CODE.
5. Deploy, mở /api/health để kiểm tra Supabase, đăng nhập admin, tạo nhân viên, kiểm tra mọi phân hệ.
6. Chỉ dùng PR #13 trên TEST theo 03_NANG_CAP_AN_TOAN.md.

Lưu ý: mã Production đã build READY nhưng tài khoản Vercel phamtu115na-tech hiện bị tạm dừng do vượt Active CPU gói Hobby, trả lỗi HTTP 402 DEPLOYMENT_DISABLED; không đồng nghĩa mã nguồn hỏng. Không lập tài khoản khác nhằm né hạn mức; chọn gói dịch vụ phù hợp cho ứng dụng bệnh viện.

Bên trong mỗi mã nguồn đã có thêm tài liệu gốc: BAT_DAU.html, README.md, NANG_CAP_TAI_CHO.md, docs/, supabase/*.sql, legacy-apps-script/. Để xem hướng dẫn đồ họa, mở BAT_DAU.html trong trình duyệt.