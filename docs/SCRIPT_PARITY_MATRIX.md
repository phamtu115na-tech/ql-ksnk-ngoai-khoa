# Đối chiếu Apps Script và Vercel

Bản sao đầy đủ của mã nguồn Apps Script được lưu tại `legacy-apps-script/`. Ứng dụng Next.js dùng `ksnk_legacy_rows` để giữ nguyên cấu trúc cột của workbook trong JSONB; khi ghi, dữ liệu cũ được merge nên các cột chưa biết không bị bỏ đi.

| Module Script | Sheet/nguồn chính | Phân hệ Vercel | Trạng thái ánh xạ |
|---|---|---|---|
| `00_Config.gs` | `DM_NHANVIEN`, `GIAO VIỆC`, `DM_LOI`, `DM_CAUHINH_PHIEU` | cấu hình API + `lib/supabase.ts` | Đã giữ tên bảng và alias cũ/mới |
| `10_NhanSu.gs` | `DM_NHANVIEN` | `/api/modules?module=staff` | Đọc/thêm/sửa/xóa/tìm kiếm; phép năm, lịch sử nghỉ, tổng hợp phân bổ theo bộ phận và cảnh báo lịch nghỉ |
| `20_GiaoViec.gs` | `GIAO VIỆC`, `NHAC_VIEC_GHI_CHU` | `tasks`, `reminders` | Bộ phận, nhân sự, ưu tiên, trạng thái, quá hạn, đánh giá, ý kiến và minh chứng |
| `30_ViPham.gs` | `THEODOI_VIPHAM`, `DM_LOI`, `tong_hop` | `violations`, `violationError` | Đọc cả `TONG_HOP_VI_PHAM` và `tong_hop`, điểm trừ, báo cáo, minh chứng |
| `40_BangKiem.gs` | `PHIEU_GIAMSAT`, `CT_PHIEU_GIAMSAT`, `DM_BANGKIEM` | `checklists`, `checklistForm`, `checklistCriterion` | Phiếu, tiêu chí, kết quả, ghi chú, tỷ lệ, KPI và minh chứng |
| `50_KeHoach.gs` | `KE_HOACH_TUAN`, `KE_HOACH_THANG`, `TON_TAI_KIEN_NGHI` | `plans`, `issues` | Tuần/tháng, hoàn thành, chuyển tiếp, quá hạn, tồn tại |
| `60_BaoCao.gs` | `BAO_CAO_BO_PHAN`, `Y_KIEN_BAO_CAO` | `reports` | Bộ lọc kỳ/bộ phận/nhân sự, tổng hợp, chi tiết, ý kiến và snapshot cũ |
| `70_KPI.gs` | `KPI_100_DIEM`, `BANG_KE_QUA_GIAO_VIEC`, `DM_QUYDOI_KPI`, `Y_KIEN_KPI` | `kpi`, `feedback`, `rule` | Công thức 100 điểm, bảng quy đổi, dữ liệu KPI đã lưu và góp ý |
| `90_CanhBao.gs` | giao việc/kế hoạch/nhắc việc | `alerts` | Cảnh báo theo hạn và mở bản ghi liên quan |
| `99_KiemTraHeThong.gs` | kiểm tra workbook | `/api/health` | Kiểm tra server key, project ref, bảng cấu hình, `SESSION_SECRET` |

## Quy tắc dữ liệu

- Không dùng `NEXT_PUBLIC_` cho service role/secret key.
- URL mặc định chẩn đoán là project `qmhvdedsztmuplfmsrqz`; URL được khai báo rõ trên Vercel luôn được ưu tiên và được health check đối chiếu.
- Tệp minh chứng được lưu trong bucket Storage `documents`; tài liệu được lưu riêng theo `module/legacy_id/...`.
- Không chạy `truncate`, `delete all` hoặc thay thế bảng cũ. Migration chỉ tạo bảng/index/bucket khi thiếu.
- Mật khẩu đăng nhập hiện tại được giữ nguyên theo cấu hình Production, không ghi mật khẩu thật vào GitHub.
