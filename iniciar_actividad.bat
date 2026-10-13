@echo off
setlocal enabledelayedexpansion
title Actividad 2 - PQRS y n8n (Local)
color 0B

echo ========================================================
echo     INICIANDO ACTIVIDAD 2: PQRS, n8n Y POSTGRESQL
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/4] Verificando estado del motor Docker...
docker info >nul 2>&1
if "%ERRORLEVEL%"=="0" (
    echo [OK] Docker Engine ya esta listo.
) else (
    echo [INFO] Docker no responde. Abriendo Docker Desktop...
    start "" "C:\Users\juanf\AppData\Local\Programs\DockerDesktop\Docker Desktop.exe"
    echo Esperando a que el motor Docker este operativo...
    set /a intentos=0
    :esperar_docker
    timeout /t 3 /nobreak >nul
    set /a intentos+=1
    docker info >nul 2>&1
    if "%ERRORLEVEL%"=="0" (
        echo [OK] Docker Engine ha arrancado correctamente.
    ) else (
        if !intentos! geq 25 (
            color 0E
            echo [AVISO] Abre Docker Desktop desde tu menu Inicio de Windows.
            echo Presiona cualquier tecla una vez que Docker Desktop termine de cargar...
            pause >nul
            goto esperar_docker
        )
        echo   ... esperando motor Docker (!intentos!/25)
        goto esperar_docker
    )
)

echo.
echo [2/4] Verificando puertos y levantando contenedores locales (PostgreSQL + n8n)...
powershell -Command "Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*servidor_simulador*' } | Stop-Process -Force" >nul 2>&1
docker stop postgres n8n_local >nul 2>&1
docker compose up -d
if "%ERRORLEVEL%" neq "0" (
    color 0C
    echo [ERROR] No se pudieron levantar los contenedores.
    pause
    exit /b 1
)

echo.
echo [3/4] Esperando inicializacion de PostgreSQL...
timeout /t 3 /nobreak >nul

echo.
echo [4/4] Abriendo panel de n8n y Portal PQRS en tu navegador...
start http://localhost:5678
start "" "%~dp0formulario_pqrs.html"

echo.
echo ========================================================
echo  TODO LISTO LOCALMENTE:
echo   - n8n: http://localhost:5678
echo   - PostgreSQL: localhost:5432 (pqrs_db / pqrs_user)
echo   - Portal Web PQRS: abierto en tu navegador
echo.
echo  Para apagar y liberar tu memoria RAM al terminar:
echo  ejecuta detener_actividad.bat
echo ========================================================
echo.
pause
