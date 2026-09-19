-- Tăng tốc tìm kiếm toàn văn trên dữ liệu Apps Script đã nhập.
alter table public.ksnk_legacy_rows
  add column if not exists data_search tsvector
  generated always as (to_tsvector('simple'::regconfig, coalesce(data::text, ''))) stored;
create index if not exists ksnk_legacy_rows_search_idx
  on public.ksnk_legacy_rows using gin(data_search);
create index if not exists ksnk_evidence_lookup_idx
  on public.ksnk_evidence(module, legacy_id, created_at desc);

-- Bucket riêng tư: tệp chỉ được đọc bằng URL ký ngắn hạn từ API máy chủ.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('documents','documents',false,8388608,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do update set
 public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
