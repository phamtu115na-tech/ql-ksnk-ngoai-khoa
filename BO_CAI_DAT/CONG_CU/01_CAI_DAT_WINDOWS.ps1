param([ValidateSet("ON_DINH","MO_RONG")][string]$Ban="ON_DINH")
$ErrorActionPreference="Stop"
$base=(Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$target=if($Ban -eq "MO_RONG"){"02_BAN_MO_RONG_PR13_THU_NGHIEM"}else{"01_BAN_ON_DINH_PRODUCTION"}
$source=Join-Path $base $target
if(!(Test-Path (Join-Path $source "package.json"))){throw "Khong co package.json tai $source"}
Push-Location $source
try{
 node --version
 if($LASTEXITCODE -ne 0){throw "Hay cai Node.js 24.x"}
 npm ci
 if($LASTEXITCODE -ne 0){throw "npm ci that bai"}
 if(!(Test-Path ".env.local")){
  Copy-Item (Join-Path $base "00_HUONG_DAN\MAU_BIEN\.env.local.example") ".env.local"
  Write-Host "Da tao .env.local MAU. BAN PHAI TU DIEN SUPABASE_URL, SUPABASE_SECRET_KEY, BOOTSTRAP_ADMIN_CODE."
 }
 Write-Host "OK. Khi dien env xong: npm run dev. Khong commit .env.local."
}finally{Pop-Location}
