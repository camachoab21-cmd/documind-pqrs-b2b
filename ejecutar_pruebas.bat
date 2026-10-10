@echo off
setlocal
chcp 65001 > nul
cd /d "%~dp0"
echo PRUEBAS DE INTEGRACION PQRS - n8n, PostgreSQL y SMTP reales
where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Instale Node.js 18 o superior y abra una consola nueva.
    pause
    exit /b 1
)
if not defined PQRS_ADMIN_USER goto :configuracion
if not defined PQRS_ADMIN_PASSWORD goto :configuracion
if not defined PQRS_EMAIL_PRUEBA goto :configuracion
node "%~dp0tests\probar_solicitudes.js"
set "PQRS_TEST_RESULT=%ERRORLEVEL%"
echo.
if not "%PQRS_TEST_RESULT%"=="0" echo ERROR: La bateria no se completo. Revise el fallo anterior.
pause
exit /b %PQRS_TEST_RESULT%

:configuracion
echo ERROR: Defina PQRS_ADMIN_USER, PQRS_ADMIN_PASSWORD y PQRS_EMAIL_PRUEBA.
echo Use la seccion de pruebas del README para capturar la clave sin mostrarla.
echo PQRS_BASE_URL es opcional; valor por defecto: http://localhost:5678
pause
exit /b 1
