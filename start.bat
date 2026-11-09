@echo off
chcp 65001 >nul
title ComproNext Web - 1-Click Startup

echo ===================================================
echo     ComproNext Web - ระบบจัดโต๊ะคอมและห้อง 3D AI
echo ===================================================
echo.

:: 1. ตรวจสอบ Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] ไม่พบ Node.js ในเครื่องของคุณ!
    echo กรุณาดาวน์โหลดและติดตั้ง Node.js LTS จาก https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: 2. สร้างไฟล์ .env.local จาก .env.example อัตโนมัติ (หากยังไม่มี)
if not exist ".env.local" (
    if exist ".env.example" (
        echo [INFO] สร้างไฟล์ .env.local จาก .env.example ให้อัตโนมัติ...
        copy ".env.example" ".env.local" >nul
    )
)

:: 3. เลือกระหว่าง pnpm หรือ npm
set PKG_MGR=npm
where pnpm >nul 2>nul
if %errorlevel% equ 0 (
    set PKG_MGR=pnpm
)

echo [INFO] ตรวจพบตัวจัดการแพ็กเกจ: %PKG_MGR%

:: 4. ติดตั้ง dependencies หากยังไม่มี node_modules
if not exist "node_modules\" (
    echo [INFO] ไม่พบโฟลเดอร์ node_modules กำลังติดตั้งแพ็กเกจ (ขั้นตอนนี้ใช้เวลาประมาณ 1-2 นาที)...
    if "%PKG_MGR%"=="pnpm" (
        call pnpm install
    ) else (
        call npm install
    )
    if %errorlevel% neq 0 (
        echo [ERROR] ติดตั้ง dependencies ไม่สำเร็จ!
        pause
        exit /b 1
    )
)

:: 5. เปิดเว็บบราวเซอร์อัตโนมัติ
echo.
echo [SUCCESS] กำลังเปิดเว็บ ComproNext ที่ http://localhost:3000 ...
start "" http://localhost:3000

:: 6. รัน Dev Server
if "%PKG_MGR%"=="pnpm" (
    call pnpm dev
) else (
    call npm run dev
)

pause
