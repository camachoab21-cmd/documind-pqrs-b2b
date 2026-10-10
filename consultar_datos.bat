@echo off
setlocal
chcp 65001 > nul
if not defined PQRS_PG_CONTAINER set "PQRS_PG_CONTAINER=pqrs-postgres"
if not defined PQRS_PG_USER set "PQRS_PG_USER=pqrs_user"
if not defined PQRS_PG_DATABASE set "PQRS_PG_DATABASE=pqrs_db"
where docker >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker no esta disponible en esta consola.
    pause
    exit /b 1
)
echo CONSULTA DE PERSISTENCIA PQRS
 echo Contenedor: %PQRS_PG_CONTAINER% - Base: %PQRS_PG_DATABASE%
docker exec "%PQRS_PG_CONTAINER%" psql -X -v ON_ERROR_STOP=1 -U "%PQRS_PG_USER%" -d "%PQRS_PG_DATABASE%" -c "SELECT ticket_id, cliente_nombre, tipo, prioridad, estado, es_urgente, sla_horas, version, fecha_radicacion, fecha_resolucion, confirmacion_estado, alerta_estado FROM pqrs_solicitudes ORDER BY fecha_radicacion DESC, id DESC LIMIT 15;"
set "PQRS_QUERY_RESULT=%ERRORLEVEL%"
if not "%PQRS_QUERY_RESULT%"=="0" echo ERROR: No se pudo consultar PostgreSQL. Revise Docker, los nombres configurados y el esquema.
echo.
pause
exit /b %PQRS_QUERY_RESULT%
