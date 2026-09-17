# ============================================================
# FRAGMENTLY — Windows'da avtomatik o'rnatish (PowerShell)
# Barcha bog'liqliklarni backend, admin_backend va frontend uchun o'rnatadi.
#
# Ishlatish:  powershell -ExecutionPolicy Bypass -File .\install_deps.ps1
# ============================================================

$ErrorActionPreference = "Stop"
$ROOT = $PSScriptRoot

Write-Host "======================================" -ForegroundColor Cyan
Write-Host " 1/4 Python & Node tekshiruvi" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
python --version
node --version
npm --version

# ------------------------------------------------------------
Write-Host "======================================" -ForegroundColor Cyan
Write-Host " 2/4 BACKEND venv + dependencies" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
$backendVenv = Join-Path $ROOT "backend\venv"
if (-not (Test-Path $backendVenv)) {
    python -m venv $backendVenv
}
& "$backendVenv\Scripts\python.exe" -m pip install --upgrade pip
& "$backendVenv\Scripts\pip.exe" install -r "$ROOT\backend\requirements.txt"
Write-Host "[OK] Backend o'rnatildi" -ForegroundColor Green

# ------------------------------------------------------------
Write-Host "======================================" -ForegroundColor Cyan
Write-Host " 3/4 ADMIN_BACKEND venv + dependencies" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
$adminVenv = Join-Path $ROOT "admin_backend\venv"
if (-not (Test-Path $adminVenv)) {
    python -m venv $adminVenv
}
& "$adminVenv\Scripts\python.exe" -m pip install --upgrade pip
& "$adminVenv\Scripts\pip.exe" install -r "$ROOT\admin_backend\requirements.txt"
Write-Host "[OK] Admin Backend o'rnatildi" -ForegroundColor Green

# ------------------------------------------------------------
Write-Host "======================================" -ForegroundColor Cyan
Write-Host " 4/4 FRONTEND npm dependencies" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Set-Location "$ROOT\frontend"
npm install
npm run build
Write-Host "[OK] Frontend build tayyor" -ForegroundColor Green

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host " BARCHASI O'RNATILDI ✔" -ForegroundColor Green
Write-Host " Backend:       backend\venv\Scripts\uvicorn app.main:app --port 8000"
Write-Host " Admin Backend: admin_backend\venv\Scripts\uvicorn app.main:app --port 8001"
Write-Host "======================================" -ForegroundColor Cyan
