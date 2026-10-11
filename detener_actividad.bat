@echo off
title Actividad 2 - Detener Servicios
color 0E

cd /d "%~dp0"
echo ========================================================
echo   DETENIENDO SERVICIOS DE ACTIVIDAD 2 (LOCAL)
echo ========================================================
echo.
echo Deteniendo contenedores n8n y PostgreSQL...
docker compose down
echo.
echo [OK] Servicios detenidos exitosamente. Memoria RAM liberada.
echo.
pause
