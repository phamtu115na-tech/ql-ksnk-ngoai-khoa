#!/usr/bin/env python3
"""Non-mutating HTTP check for deployment and Supabase DB readiness."""
import sys,urllib.request,urllib.error
base=(sys.argv[1] if len(sys.argv)>1 else "").strip().rstrip("/")
if not base.startswith(("https://","http://")):
    sys.exit("DUNG: python kiem_tra_web.py https://ten-mien.vercel.app")
for path in ("/","/api/health"):
    try:
        req=urllib.request.Request(base+path,headers={"User-Agent":"KSNK-installer-check/1"})
        with urllib.request.urlopen(req,timeout=18) as r:
            body=r.read(300).decode("utf-8","replace") if path=="/api/health" else "[HTML, khong in chi tiet]"
            print(path,"HTTP",r.status,body)
    except urllib.error.HTTPError as e:
        print(path,"HTTP",e.code,"Vercel:",e.headers.get("x-vercel-error","-"))
    except Exception as e:
        print(path,"LOI KET NOI:",str(e)[:190])
print("Kiem tra HTTP khong thay the nghiem thu dang nhap, phan quyen va bao cao.")
