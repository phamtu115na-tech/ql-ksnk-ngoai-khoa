#!/usr/bin/env python3
"""Package full pinned source snapshots into one ZIP; never embed real secrets."""
import hashlib,shutil,sys,re,zipfile
from pathlib import Path
base=Path.cwd()
src={"01_BAN_ON_DINH_PRODUCTION":base/"repo-prod","02_BAN_MO_RONG_PR13_THU_NGHIEM":base/"repo-pr13"}
guide=base/"repo-pack"/"BO_CAI_DAT"
if not guide.is_dir() or any(not (folder/"package.json").exists() for folder in src.values()):
    sys.exit("ERROR: checkout required sources and instructions first")
out=base/"bundle-ready"
if out.exists():shutil.rmtree(out)
out.mkdir()
def ignore(dir,names):
    return {n for n in names if n in {".git","node_modules",".next",".vercel","coverage",".turbo"}
            or (n.startswith(".env") and n!=".env.example")
            or n.lower() in {"service-account.json","credentials.json","token.json"}
            or n.lower().endswith((".pem",".p12",".pfx",".sqlite",".db",".bak"))}
for name,folder in src.items():shutil.copytree(folder,out/name,ignore=ignore)
shutil.copytree(guide,out/"00_HUONG_DAN",ignore=ignore)
(out/"THONG_TIN_NGUON.txt").write_text(
    "GitHub: phamtu115na-tech/ql-ksnk-ngoai-khoa\nStable commit: 512dbcd3fe419e9a74a5eaabfc7bc895bda13849\nPR13 commit: 1af195ab7190a1487786835af801f696cba92b4e\nKhong co du lieu Supabase/benh nhan/bi mat.\n",encoding="utf-8")
checks=[]
allfiles=sorted(p for p in out.rglob("*") if p.is_file())
for f in allfiles:
    payload=f.read_bytes()
    if f.name.startswith(".env") and f.name!=".env.example":
        sys.exit("Private env file detected: "+str(f))
    if re.search(rb"sb_secret_[A-Za-z0-9]{24,}",payload):
        sys.exit("Possible secret key in source: "+str(f))
    if b"-----BEGIN PRIVATE KEY-----" in payload:
        sys.exit("Private key in source: "+str(f))
    checks.append(hashlib.sha256(payload).hexdigest()+"  "+str(f.relative_to(out)).replace("\\","/"))
(out/"SHA256SUMS.txt").write_text("\n".join(checks)+"\n",encoding="utf-8")
dist=base/"dist";dist.mkdir(exist_ok=True)
zpath=dist/"BO_CAI_KSNK_NGOAI_KHOA_115_HOAN_CHINH_20261125.zip"
with zipfile.ZipFile(zpath,"w",zipfile.ZIP_DEFLATED,compresslevel=8) as z:
    for f in sorted(out.rglob("*")):
        if f.is_file():z.write(f,"BO_CAI_KSNK_115/"+str(f.relative_to(out)).replace("\\","/"))
with zipfile.ZipFile(zpath) as z:
    if z.testzip() is not None:sys.exit("ZIP CRC validation failed")
    members=set(z.namelist())
    for name in src:
        for mandatory in ("package.json","package-lock.json","BAT_DAU.html","supabase/CAI_DAT.sql"):
            if "BO_CAI_KSNK_115/"+name+"/"+mandatory not in members:sys.exit("ZIP missing "+name+"/"+mandatory)
print("PACKAGED",zpath,"FILES",len(allfiles),"BYTES",zpath.stat().st_size)
