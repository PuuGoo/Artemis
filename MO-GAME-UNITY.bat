@echo off
setlocal
set "REPO=%~dp0"
set "BUILD=%REPO%unity-client/Builds/WebGL"

if not exist "%BUILD%/index.html" goto NOBUILD
if not exist "%BUILD%/Build/WebGL.wasm.unityweb" goto NOWASM

echo.
echo  Dang bat server: http://127.0.0.1:8080/
echo  Giu cua so nay mo trong luc choi.
echo.
start "" cmd /c "timeout /t 3 >nul && start "" http://127.0.0.1:8080/"
node "%REPO%tools/serve-webgl.mjs" 8080
echo.
echo  Server da dung.
pause
exit /b 0

:NOBUILD
echo.
echo  CHUA CO BUILD trong:
echo    %BUILD%
echo.
echo  Xem docs/unity-migration/INSTALL-UNITY.md de biet lenh build.
pause
exit /b 1

:NOWASM
echo.
echo  LOI: thieu Build/WebGL.wasm.unityweb - build bi thieu file.
pause
exit /b 1
