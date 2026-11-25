#!/usr/bin/env python3
"""Validate local env key names/shape; never print secret values."""
import re,sys
from pathlib import Path
path=Path(sys.argv[1]) if len(sys.argv)>1 else Path('.env.local')
if not path.is_file():
    sys.exit("LOI: khong tim thay .env.local. Tao tu MAU_BIEN/.env.local.example")
d={}
for line in path.read_text(encoding="utf-8-sig").splitlines():
    line=line.strip()
    if line and not line.startswith("#") and "=" in line:
        k,v=line.split("=",1);d[k.strip()]=v.strip().strip("'").strip('"')
needs=["SUPABASE_URL","BOOTSTRAP_ADMIN_CODE"]
if not any(d.get(k) for k in ("SUPABASE_SECRET_KEY","SUPABASE_SERVICE_ROLE_KEY","SUPABASE_SERVICE_KEY","SUPABASE_ADMIN_KEY")):
    needs.append("SUPABASE_SECRET_KEY hoac SUPABASE_SERVICE_ROLE_KEY")
err=False
for k in needs:
    if not d.get(k):
        err=True;print("THIEU:",k)
url=d.get("SUPABASE_URL","")
if url and not re.fullmatch(r"https://[a-zA-Z0-9-]+\.supabase\.co/?",url):
    err=True;print("SAI DINH DANG SUPABASE_URL")
for k,v in d.items():
    if "YOUR_" in v or "PASTE_" in v or "CHANGE_THIS" in v:
        err=True;print("CHUA DIEN GIA TRI THAT:",k)
    if k.startswith("NEXT_PUBLIC_") and any(t in k for t in ("SECRET","SERVICE_ROLE","PRIVATE_KEY","ADMIN_KEY")):
        err=True;print("NGUY HIEM: BI MAT NAM TRONG NEXT_PUBLIC_:",k)
code=d.get("BOOTSTRAP_ADMIN_CODE","")
if code and not 12<=len(code.encode("utf-8"))<=72:
    err=True;print("BOOTSTRAP_ADMIN_CODE phai tu 12 den 72 byte")
print("DA KIEM TRA CAC TEN BIEN, KHONG HIEN THI KHOA BI MAT")
raise SystemExit(1 if err else 0)
