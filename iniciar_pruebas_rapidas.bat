@echo off
setlocal
title Modo de Pruebas Rápidas - Plataforma PQRS y n8n
color 0A

echo ========================================================
echo   MODO DE PRUEBAS INMEDIATAS (SIMULADOR LOCAL)
echo ========================================================
echo.
echo Este modo levanta el motor de simulacion de webhooks
echo en http://localhost:5678 en 0.5 segundos (sin esperar Docker).
echo.

cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
    color 0C
    echo [ERROR] Se requiere Node.js para ejecutar el simulador.
    pause
    exit /b 1
)

echo [1/2] Iniciando servidor de webhooks en segundo plano...
start "Simulador n8n PQRS" /min cmd /c "node tests\servidor_simulador.js"

echo Esperando inicializacion del puerto 5678...
timeout /t 2 /nobreak >nul

echo [2/2] Abriendo el Portal Web en tu navegador...
start "" "%~dp0formulario_pqrs.html"

echo.
echo ========================================================
echo   LISTO PARA EXPERIMENTAR Y PROBAR:
echo   - Endpoint: http://localhost:5678
echo   - Portal Web: abierto en tu navegador
echo.
echo   Credenciales de Funcionarios para probar:
echo   * Supervisor: andrea.silva / SupervisorSoporte2026*
echo   * Sistemas:   carlos.morales / AgenteSistemas2026*
echo   * Facturacion: laura.mendoza / AgenteFacturacion2026*
echo.
echo   (Para cerrar el simulador cuando termines, cierra
echo    la ventana minimizada de node o ejecuta detener_actividad.bat)
echo ========================================================
echo.
pause
