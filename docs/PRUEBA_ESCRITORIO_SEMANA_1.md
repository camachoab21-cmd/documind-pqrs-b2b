# Prueba de escritorio — Semana 1

**Fecha:** 29/10/2026 (America/Bogota). **Resultado:** 24/24 comprobaciones de navegador aprobadas. Compilación de producción correcta. Alcance: todos los controles de la nueva vista `/semana-1`, acceso desde `/login`, campos y control de contraseña del login. No equivale a certificar todas las operaciones de negocio heredadas.

## Correspondencia con la guía

| Requisito de semana 1 | Entrega verificable |
|---|---|
| Inventariar flujos: disparador, pasos, servicios y resultado | Tabla F01–F05 en la app y en `SEMANA_1_DISENO.md/pdf`; cinco webhooks de `workflow/n8n_workflow.json`. |
| Elegir Ruta A o B | Ruta A y justificación visibles en la app y el documento. |
| Definir caso de visión | Lectura de formularios PQRS impresos; campos, revisión humana y umbral provisional documentados. |
| Proponer arquitectura y entregar 1–2 páginas con diagrama | PDF de dos páginas descargable; comparación interactiva de arquitectura actual/propuesta en React. |

La semana 1 exige diseño e inventario. La app refleja ese entregable y distingue las decisiones pendientes: no anuncia migración, OCR ni modelo local como operativos.

## Ejecución y evidencia

Se automatizó un navegador real mediante CUA/Playwright: clics, Enter, Espacio, ArrowRight, escritura de datos ficticios y descarga real. Se probaron Vite en `127.0.0.1:5173` y el paquete compilado mediante `vite preview` en `127.0.0.1:4173`. Las dimensiones se confirmaron leyendo el ancho efectivo de la página después de cada cambio. Las pruebas móviles simulan tamaños de pantalla, no un teléfono físico.

- [Resultados de las 24 comprobaciones](evidencias/semana1-resultados.json).
- [Captura completa de la versión compilada](evidencias/semana1-escritorio.jpg).
- `npm run build`: Vite 5.4.21, 1581 módulos transformados; JavaScript, CSS y PDF incluidos en `frontend/dist`.
- `git diff --check`: sin errores de espacios.
- PDF descargado en desarrollo y en producción: contenido idéntico al PDF del repositorio, verificado por SHA-256. Dos páginas, previamente renderizadas e inspeccionadas.

## Casos ejecutados

| ID | Acción / entrada | Resultado observado | Estado |
|---|---|---|---|
| S1-01 | Abrir `/semana-1` sin iniciar sesión | Encabezado y contenido visibles | PASS |
| S1-02 | Leer inventario | Cinco filas de flujos | PASS |
| S1-03 | Abrir vista por primera vez | Arquitectura actual seleccionada | PASS |
| S1-04 | Pulsar Propuesta | Diagrama propuesto visible | PASS |
| S1-05 | Activar Actual con Enter | Diagrama actual visible | PASS |
| S1-06 | Activar Propuesta con Espacio | Diagrama propuesto visible | PASS |
| S1-07 | Descargar PDF en desarrollo | Archivo descargado | PASS |
| S1-08a | Pantalla de 1440 px | Sin desbordamiento horizontal de página | PASS |
| S1-08b | Pantalla de 768 px | Sin desbordamiento horizontal de página | PASS |
| S1-08c | Pantalla de 390 px | Sin desbordamiento horizontal de página | PASS |
| S1-08d | Pantalla de 320 px | Sin desbordamiento horizontal de página | PASS |
| S1-09 | Volver a DocuMind sin sesión | Redirección a login | PASS |
| S1-10 | Enviar login vacío | Validación nativa de campo obligatorio | PASS |
| S1-11 | Enviar `correo-invalido` | Rechazo nativo del formato de correo | PASS |
| S1-12 | Buscar entradas por su etiqueta | Correo y contraseña tienen etiqueta asociada | PASS |
| S1-13 | Mostrar contraseña ficticia | Campo cambia a texto | PASS |
| S1-14 | Ocultar contraseña con Enter | Campo vuelve a password | PASS |
| S1-15 | Enviar `prueba@example.invalid` sin API disponible | Se muestra error de conexión y se rehabilita el botón; no se crea sesión | PASS |
| S1-16 | Activar enlace de semana 1 desde login | Se abre la entrega | PASS |
| S1-17 | Recargar ruta pública | Sigue accesible; estado inicial actual | PASS |
| S1-18 | Abrir paquete compilado | Vista visible y PDF con URL `/assets/…` | PASS |
| S1-19 | Descargar PDF del paquete | Archivo descargado correctamente | PASS |
| S1-20 | Cambiar selección | `aria-pressed` verdadero/falso coherente en ambos botones | PASS |
| S1-21 | Enfocar tabla en 320 px y pulsar ArrowRight | Desplazamiento de 40 px y contorno visible | PASS |

## Detalles corregidos y animaciones

El login tenía dos etiquetas sin asociación y un botón de contraseña sin nombre accesible. Se añadieron `htmlFor`, autocompletado, nombre dinámico y estado pulsado del botón. El error se anuncia con `role="alert"`.

La tabla puede recibir foco y desplazarse con el teclado; el selector de arquitectura tiene grupo accesible. Los botones secundarios muestran anillo de foco. La captura confirma texto legible, diagramas, distribución y estados seleccionados.

Se comprobó en estilos del navegador la animación decorativa `pulse-ring` de 2 segundos y las transiciones de botones de 0,2 segundos. Se añadió una regla global `prefers-reduced-motion: reduce` que reduce animaciones y transiciones; esa regla se verificó en el CSS compilado. **No se cambió ni emuló la preferencia de movimiento del sistema**, por lo que no se presenta como una prueba visual de ese modo. La vista de semana 1 no depende de una animación para mostrar contenido.

## Límites concretos

No se validaron inicio de sesión exitoso, menú dentro de una sesión real, tickets persistidos, CSAT, adjuntos, correo ni chat con proveedores: PostgreSQL, API Express, n8n y SMTP no estaban configurados y activos para esta prueba. El enlace del menú se integró y compiló, pero no se navegó autenticado. El intento de login comprobó la ruta de error, no autenticación exitosa.

Los defectos heredados descritos en `STATUS_AUDIT.md` continúan pendientes. No se añadieron credenciales, llamadas de IA de pago ni simulaciones que se presenten como conexiones reales. Para probar esas integraciones se necesita una base de pruebas y configuración de API, n8n/SMTP y proveedores. Esto no bloquea los cuatro entregables de diseño de semana 1.

## Repetición

Desde `frontend`: ejecutar `npm ci`, `npm run build` y `npm run preview -- --host 127.0.0.1 --port 4173`; abrir `/semana-1`. Repetir las acciones de la tabla. Los resultados JSON son evidencia de esta ejecución, no un sustituto de una suite de integración ni un comando de pruebas futuras. Los servicios se deben configurar antes de ampliar las pruebas al negocio.
