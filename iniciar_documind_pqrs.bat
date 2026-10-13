@echo off
setlocal enabledelayedexpansion
title DocuMind + PQRS Enterprise (Sistema Unificado)
color 0B

echo ========================================================
echo   INICIANDO PLATAFORMA UNIFICADA: DOCUMIND + PQRS + IA
echo ========================================================
echo.

cd /d "%~dp0"

:: 1. Comprobar Docker
echo [1/5] Verificando estado del motor Docker...
docker info >nul 2>&1
if "%ERRORLEVEL%"=="0" (
    echo [OK] Docker Engine esta activo.
) else (
    echo [INFO] Iniciando Docker Desktop...
    start "" "C:\Users\juanf\AppData\Local\Programs\DockerDesktop\Docker Desktop.exe"
    set /a intentos=0
    :esperar_docker
    timeout /t 3 /nobreak >nul
    set /a intentos+=1
    docker info >nul 2>&1
    if "%ERRORLEVEL%"=="0" (
        echo [OK] Docker Engine operativo.
    ) else (
        if !intentos! geq 25 (
            echo [AVISO] Abre Docker Desktop manualmente si tarda en responder.
            pause
            goto esperar_docker
        )
        echo   ... esperando motor Docker (!intentos!/25)
        goto esperar_docker
    )
)

:: 2. Levantar servicios de base de datos y n8n
echo.
echo [2/5] Levantando contenedores (PostgreSQL Unificado + n8n)...
powershell -Command "Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*servidor_simulador*' } | Stop-Process -Force" >nul 2>&1
docker stop postgres n8n_local >nul 2>&1
docker compose up -d
if "%ERRORLEVEL%" neq "0" (
    color 0C
    echo [ERROR] No se pudieron levantar los contenedores.
    pause
    exit /b 1
)

:: 3. Iniciar Backend Node.js
echo.
echo [3/5] Levantando Backend API (Node.js / Express en puerto 5000)...
start "DocuMind Backend API" /min cmd /c "cd /d \"%~dp0backend\" && npm run dev"
timeout /t 2 /nobreak >nul

:: 4. Iniciar Frontend Vite
echo.
echo [4/5] Levantando Frontend (React + Vite en puerto 5173)...
start "DocuMind Frontend Vite" /min cmd /c "cd /d \"%~dp0frontend\" && npm run dev"
timeout /t 3 /nobreak >nul

:: 5. Abrir en Navegador
echo.
echo [5/5] Abriendo Plataforma en tu navegador...
start http://localhost:5173
start http://localhost:5678

echo.
echo ========================================================
echo   TODO LISTO Y OPERATIVO:
echo   - Portal Unificado DocuMind + PQRS: http://localhost:5173
echo   - Backend API REST (Node.js):        http://localhost:5000/api/health
echo   - Motor n8n:                         http://localhost:5678
echo   - PostgreSQL (Tablas y RAG):         localhost:5432 (pqrs_db)
echo.
echo   Para apagar todos los servicios y liberar memoria:
echo   ejecuta detener_documind_pqrs.bat
echo ========================================================
echo.
pause
