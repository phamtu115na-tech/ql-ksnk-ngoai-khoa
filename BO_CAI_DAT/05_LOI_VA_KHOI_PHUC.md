# XỬ LÝ LỖI THƯỜNG GẶP
| Lỗi | Kiểm tra |
|---|---|
| npm ci lỗi | Node.js đúng 24.x? package-lock.json còn? Mạng cho npm? |
| Vercel build fail | Vercel Build Logs, Node version, Root Directory, biến môi trường |
| API /api/health 503 | URL/secret cùng một Supabase project? Đã chạy CAI_DAT.sql chưa? Bảng cx_people tồn tại? |
| Đăng nhập lỗi 401 | Đơn vị Ngoại khoa, tên admin, BOOTSTRAP_ADMIN_CODE? Admin đã tồn tại với mã khác? |
| Lỗi 403 | Phân quyền server/API; KHÔNG tắt RLS hoặc mở toàn bộ quyền để chữa |
| 404 ảnh / file | Bucket documents/connect-files, đường dẫn tệp, quyền ký URL |
| Vercel HTTP 402 DEPLOYMENT_DISABLED | Team bị pause do vượt quota/billing. Kiểm tra Usage/Billing; liên hệ https://vercel.com/help. Redeploy không giúp khi tài khoản chưa được mở |
| Biến môi trường không có hiệu lực | Save rồi Redeploy vào đúng Production/Preview |
| Google Sheets lỗi | Service account email/private key và quyền Viewer trên Sheet |
| Nhắc việc / Giao việc không giãn | CSS cache, build đang chạy commit khác; thử hard refresh và kiểm tra SHA |
| Ảnh/PPTX lỗi | Xác minh API file và quyền truy cập; thử dữ liệu giả lập |

Công cụ không sửa dữ liệu: python 00_HUONG_DAN/CONG_CU/kiem_tra_web.py https://TEN-MIEN; python 00_HUONG_DAN/CONG_CU/kiem_tra_env.py PATH_ENV.

Vercel hiện thông báo team phamtu115na-tech đã dùng 109% CPU Hobby và dự kiến có thể bỏ pause ngày 25/12/2026 hoặc nâng cấp, theo email chính thức 25/11/2026. Không nên dựa vào thời điểm này thay cho kiểm tra HTTP thực tế.