@echo off
title Actividad 2 - Detener Servicios
color 0E

cd /d "%~dp0"
echo ========================================================
echo   DETENIENDO SERVICIOS DE ACTIVIDAD 2 (LOCAL)
echo ========================================================
echo.

echo [1/2] Cerrando simuladores Node.js si estaban activos...
powershell -Command "Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*servidor_simulador*' } | Stop-Process -Force" >nul 2>&1

echo [2/2] Deteniendo contenedores Docker si estaban activos...
docker info >nul 2>&1
if "%ERRORLEVEL%"=="0" (
    docker compose down
) else (
    echo [INFO] Docker no estaba en ejecucion.
)

echo.
echo [OK] Todos los servicios detenidos exitosamente. Memoria RAM liberada.
echo.
pause
