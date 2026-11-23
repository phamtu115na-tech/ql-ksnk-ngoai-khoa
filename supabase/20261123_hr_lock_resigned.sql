-- Khóa tài khoản đã liên kết khi Nhân sự được xác nhận Đã nghỉ việc.
-- Không tự mở lại / nâng quyền khi thay đổi chức vụ hoặc trở lại làm việc.
create or replace function public.nk_hr_lock_resigned_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare staff_code text;
begin
  if new.sheet_name <> 'DM_NHANVIEN' then return new; end if;
  if lower(trim(coalesce(new.data->>'Trạng thái',''))) <> lower('Đã nghỉ việc') then return new; end if;
  staff_code := nullif(trim(coalesce(new.data->>'Mã NV','')), '');
  if staff_code is null then return new; end if;
  update public.cx_people
     set active=false,version=gen_random_uuid()
   where unit='surgery' and staff_code is not null
     and lower(trim(cx_people.staff_code))=lower(staff_code) and active=true;
  return new;
end;
$$;
drop trigger if exists nk_hr_resignation_lock on public.ksnk_legacy_rows;
create trigger nk_hr_resignation_lock
after insert or update of data on public.ksnk_legacy_rows
for each row when (new.sheet_name='DM_NHANVIEN')
execute function public.nk_hr_lock_resigned_account();
