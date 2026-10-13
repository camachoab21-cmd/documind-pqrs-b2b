@echo off
title DocuMind + PQRS - Detener Servicios
color 0E

echo ========================================================
echo   DETENIENDO SERVICIOS DE DOCUMIND + PQRS UNIFICADO
echo ========================================================
echo.

:: 1. Detener procesos de Node.js del backend y frontend
echo [1/2] Deteniendo servidores Node.js (Backend 5000 y Vite 5173)...
powershell -Command "Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*actividad-pqrs-b2b*' -or $_.CommandLine -like '*vite*' -or $_.CommandLine -like '*server.js*' } | Stop-Process -Force" >nul 2>&1

:: 2. Detener contenedores Docker
echo [2/2] Deteniendo contenedores Docker de la Actividad...
cd /d "%~dp0"
docker compose down >nul 2>&1

echo.
echo ========================================================
echo [OK] Todos los servicios detenidos exitosamente.
echo Memoria RAM liberada. Tus datos en PostgreSQL estan seguros.
echo ========================================================
echo.
pause
