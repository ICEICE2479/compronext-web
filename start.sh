#!/usr/bin/env bash
set -e

echo "==================================================="
echo "    ComproNext Web - ระบบจัดโต๊ะคอมและห้อง 3D AI"
echo "==================================================="
echo ""

# 1. ตรวจสอบ Node.js
if ! command -v node >/dev/null 2>&1; then
    echo "[ERROR] ไม่พบ Node.js ในเครื่องของคุณ!"
    echo "กรุณาติดตั้ง Node.js LTS จาก https://nodejs.org/"
    exit 1
fi

# 2. สร้างไฟล์ .env.local จาก .env.example อัตโนมัติ
if [ ! -f ".env.local" ] && [ -f ".env.example" ]; then
    echo "[INFO] สร้างไฟล์ .env.local จาก .env.example ให้อัตโนมัติ..."
    cp .env.example .env.local
fi

# 3. เลือกระหว่าง pnpm หรือ npm
if command -v pnpm >/dev/null 2>&1; then
    PKG_MGR="pnpm"
else
    PKG_MGR="npm"
fi

echo "[INFO] ตรวจพบตัวจัดการแพ็กเกจ: $PKG_MGR"

# 4. ติดตั้ง dependencies หากยังไม่มี node_modules
if [ ! -d "node_modules" ]; then
    echo "[INFO] กำลังติดตั้งแพ็กเกจ..."
    if [ "$PKG_MGR" = "pnpm" ]; then
        pnpm install
    else
        npm install
    fi
fi

# 5. เปิดบราวเซอร์อัตโนมัติ (macOS หรือ Linux)
echo "[SUCCESS] กำลังเปิดเว็บ ComproNext ที่ http://localhost:3000 ..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    open http://localhost:3000 &
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    xdg-open http://localhost:3000 &>/dev/null || true &
fi

# 6. รัน Dev Server
if [ "$PKG_MGR" = "pnpm" ]; then
    pnpm dev
else
    npm run dev
fi
