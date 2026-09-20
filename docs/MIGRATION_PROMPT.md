# Prompt triển khai KSNK: Apps Script -> GitHub -> Vercel -> Supabase

Bạn là kỹ sư senior Next.js, Supabase, Vercel và Google Apps Script. Hãy hoàn thiện repository
`phamtu115na-tech/ql-ksnk-ngoai-khoa` theo các nguyên tắc bắt buộc sau:

1. Giữ nguyên tên sheet, tên cột, mã nghiệp vụ, thứ tự hiển thị, màu sắc và bố cục của bộ Apps Script KSNK. Không chép nguyên `.gs` vào runtime Node.js; các API Google như SpreadsheetApp, DriveApp, HtmlService và google.script.run phải được thay bằng API server/React tương ứng.
2. Dữ liệu nguồn được nhập không phá hủy. Dùng bảng `public.ksnk_legacy_rows`, khóa duy nhất `sheet_name + row_no`, upsert theo khóa này, không truncate và không delete. Chạy lại migration phải an toàn.
3. Tất cả 25 sheet phải giữ nguyên tên và header, gồm các nhóm: nhân sự, lỗi/vi phạm, giao việc, bảng kiểm, kế hoạch, báo cáo, KPI, cảnh báo và các sheet cấu hình.
4. Khóa server Supabase chỉ ở server. Không đưa `SUPABASE_SERVICE_ROLE_KEY` hoặc `SUPABASE_SECRET_KEY` vào `NEXT_PUBLIC_*`, GitHub hoặc client bundle.
5. Kiểm tra trước khi deploy: `npm run typecheck`, `npm run build`, endpoint `/api/health`, đăng nhập bằng mật khẩu quản trị, đọc dữ liệu, thêm, sửa, tải lại và kiểm tra dữ liệu vẫn còn.
6. Không coi build xanh là đủ. Chỉ báo hoàn tất khi:
   - `supabaseDatabaseReachable=true`
   - `settingsRowFound=true`
   - dữ liệu legacy lớn hơn 0 sau migration
   - đăng nhập trả `ok=true`
   - thêm/sửa một dòng rồi tải lại vẫn thấy đúng dữ liệu
   - không có lỗi 5xx trong runtime log.
7. Nếu thiếu quyền Vercel hoặc thiếu quyền project Supabase, dừng và báo đúng điểm chặn; không đoán khóa, không xóa project, không xóa dữ liệu.
8. Sau mỗi thay đổi, tạo commit rõ ràng và để GitHub Integration tự tạo Deployment. Kiểm tra đúng Production project, không nhầm preview project.

Mục tiêu nghiệm thu: mở URL Production, đăng nhập, thấy dữ liệu cũ, các mô-đun giữ đúng logic và màu sắc, thêm/sửa/lưu được, không mất dữ liệu sau Redeploy.
