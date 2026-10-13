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
powershell -Command "Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*servidor_simulador*' -or $_.CommandLine -like '*server.js*' -or $_.CommandLine -like '*vite*' } | Stop-Process -Force" >nul 2>&1
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
start "DocuMind Backend API" /d "%~dp0backend" cmd /k "npm run dev"
echo   ... esperando que Backend inicialice en puerto 5000
powershell -Command "for ($i=0; $i -lt 20; $i++) { if (Test-NetConnection -ComputerName localhost -Port 5000 -InformationLevel Quiet) { exit 0 }; Start-Sleep -Seconds 1 }; exit 1" >nul 2>&1

:: 4. Iniciar Frontend Vite
echo.
echo [4/5] Levantando Frontend (React + Vite en puerto 5173)...
start "DocuMind Frontend Vite" /d "%~dp0frontend" cmd /k "npm run dev"
echo   ... esperando que Frontend Vite compile y abra puerto 5173
powershell -Command "for ($i=0; $i -lt 30; $i++) { if (Test-NetConnection -ComputerName localhost -Port 5173 -InformationLevel Quiet) { exit 0 }; Start-Sleep -Seconds 1 }; exit 1" >nul 2>&1

:: 5. Verificar n8n y Abrir en Navegador
echo.
echo [5/5] Verificando n8n y abriendo plataforma en tu navegador...
powershell -Command "for ($i=0; $i -lt 15; $i++) { if (Test-NetConnection -ComputerName localhost -Port 5678 -InformationLevel Quiet) { exit 0 }; Start-Sleep -Seconds 1 }; exit 0" >nul 2>&1

start http://localhost:5173
start http://localhost:5678

echo.
echo ========================================================
echo   TODO LISTO Y OPERATIVO:
echo   - Portal Unificado DocuMind + PQRS: http://localhost:5173
echo   - Portal Publico de Radicacion:      http://localhost:5173/radicar
echo   - Backend API REST (Node.js):        http://localhost:5000/api/health
echo   - Motor n8n (Tu cuenta previa):      http://localhost:5678
echo   - PostgreSQL Unificado:              localhost:5432 (pqrs_db)
echo.
echo   Para apagar todos los servicios y liberar memoria:
echo   ejecuta detener_documind_pqrs.bat
echo ========================================================
echo.
pause
