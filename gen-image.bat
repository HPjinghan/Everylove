@echo off
chcp 65001 >nul
rem 生图调 prompt：双击起本地网页（http://127.0.0.1:3939，自动开浏览器）。关掉这个窗口即停。
cd /d "%~dp0"
where node >nul 2>nul || (echo 没找到 node，先装 Node.js ^(https://nodejs.org^) & pause & exit /b 1)
node scripts\gen-image-server.mjs %*
echo.
echo 服务已退出。
pause
