@echo off
setlocal enabledelayedexpansion
chcp 65001 > nul
title Batería de Pruebas Automatizadas PQRS

echo ========================================================
echo   PRUEBAS DE INTEGRACION PQRS - n8n Y POSTGRESQL
echo ========================================================
echo.

cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
    color 0C
    echo ERROR: Se requiere Node.js 18 o superior para ejecutar las pruebas.
    pause
    exit /b 1
)

:: Credenciales por defecto basadas en la semilla oficial de PostgreSQL
if not defined PQRS_ADMIN_USER set "PQRS_ADMIN_USER=andrea.silva"
if not defined PQRS_ADMIN_PASSWORD set "PQRS_ADMIN_PASSWORD=SupervisorSoporte2026*"
if not defined PQRS_BASE_URL set "PQRS_BASE_URL=http://localhost:5678"
if not defined PQRS_EMAIL_PRUEBA set "PQRS_EMAIL_PRUEBA=pruebas.pqrs.academico@gmail.com"

echo [Configuracion de ejecucion]
echo  * Endpoint:   %PQRS_BASE_URL%
echo  * Usuario:    %PQRS_ADMIN_USER%
echo  * Correo:     %PQRS_EMAIL_PRUEBA%
echo.

:: Verificar si el servidor esta activo
powershell -Command "try { $res = Invoke-WebRequest -Uri '%PQRS_BASE_URL%/webhook/consultar-ticket?id=PQRS-2000-000000&token=00000000-0000-4000-8000-000000000000' -UseBasicParsing -TimeoutSec 2; exit 0 } catch { exit 1 }" >nul 2>&1
if "%ERRORLEVEL%" neq "0" (
    color 0E
    echo [AVISO] El servidor n8n en %PQRS_BASE_URL% no esta respondiendo.
    echo.
    echo Elija una opcion para iniciar el entorno antes de correr el test:
    echo  [1] Iniciar Simulador Rapido en segundo plano (Recomendado, 0.5 seg)
    echo  [2] Iniciar Contenedores Docker (Requiere Docker Desktop)
    echo  [3] Continuar de todos modos
    echo.
    set /p "opcion=Seleccione una opcion [1, 2 o 3, Enter para 1]: "
    if "!opcion!"=="" set "opcion=1"

    if "!opcion!"=="1" (
        echo Iniciando servidor simulador en puerto 5678...
        start "Simulador n8n PQRS" /min cmd /c "node tests\servidor_simulador.js"
        timeout /t 2 /nobreak >nul
    )
    if "!opcion!"=="2" (
        echo Levantando Docker Compose...
        docker compose up -d
        timeout /t 4 /nobreak >nul
    )
)

color 0B
echo.
echo Ejecutando bateria de pruebas de integracion...
echo --------------------------------------------------------
node "%~dp0tests\probar_solicitudes.js"
set "PQRS_TEST_RESULT=%ERRORLEVEL%"
echo --------------------------------------------------------
echo.

if "%PQRS_TEST_RESULT%"=="0" (
    color 0A
    echo [EXITO] Todas las pruebas de integracion pasaron satisfactoriamente.
) else (
    color 0C
    echo [ERROR] La bateria detecto fallos. Revise los mensajes anteriores.
)

echo.
pause
exit /b %PQRS_TEST_RESULT%
