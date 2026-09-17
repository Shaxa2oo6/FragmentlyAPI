#!/usr/bin/env bash
# ============================================================
# FRAGMENTLY — VPS/VDS avtomatik o'rnatish skripti (Linux/Ubuntu)
# Barcha bog'liqliklarni backend, admin_backend va frontend uchun o'rnatadi.
#
# Ishlatish:  bash install_deps.sh
# ============================================================
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "======================================"
echo " 1/4 Python & Node versiyalari tekshiruvi"
echo "======================================"
command -v python3 >/dev/null || { echo "XATO: python3 topilmadi"; exit 1; }
command -v node >/dev/null || { echo "XATO: node topilmadi"; exit 1; }
command -v npm >/dev/null || { echo "XATO: npm topilmadi"; exit 1; }

echo "python3: $(python3 --version)"
echo "node:    $(node --version)"
echo "npm:     $(npm --version)"

# ------------------------------------------------------------
echo "======================================"
echo " 2/4 BACKEND python venv + dependencies"
echo "======================================"
if [ -d "$ROOT/backend/venv" ]; then
  echo "backend/venv allaqachon mavjud — ishlatiladi"
else
  python3 -m venv "$ROOT/backend/venv"
fi
source "$ROOT/backend/venv/bin/activate"
python -m pip install --upgrade pip
pip install -r "$ROOT/backend/requirements.txt"
deactivate
echo "[OK] Backend dependencies o'rnatildi"

# ------------------------------------------------------------
echo "======================================"
echo " 3/4 ADMIN_BACKEND python venv + dependencies"
echo "======================================"
if [ -d "$ROOT/admin_backend/venv" ]; then
  echo "admin_backend/venv allaqachon mavjud — ishlatiladi"
else
  python3 -m venv "$ROOT/admin_backend/venv"
fi
source "$ROOT/admin_backend/venv/bin/activate"
python -m pip install --upgrade pip
pip install -r "$ROOT/admin_backend/requirements.txt"
deactivate
echo "[OK] Admin Backend dependencies o'rnatildi"

# ------------------------------------------------------------
echo "======================================"
echo " 4/4 FRONTEND npm dependencies"
echo "======================================"
cd "$ROOT/frontend"
if [ ! -d node_modules ]; then
  npm install
else
  npm install
fi
npm run build
echo "[OK] Frontend build tayyor"

echo ""
echo "======================================"
echo " BARSA O'RNATISH TUGADI ✔"
echo " Backend:      $ROOT/backend/venv/bin/uvicorn app.main:app --port 8000"
echo " Admin Backend:$ROOT/admin_backend/venv/bin/uvicorn app.main:app --port 8001"
echo "======================================"
