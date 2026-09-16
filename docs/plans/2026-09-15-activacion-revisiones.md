# Activación pendiente: revisiones por versión

Implementado en la rama `feat/bandeja-revisiones`, integrada sobre `origin/main` (`f7e3d83`) el 15 de septiembre. La migración propia se renumeró a 0081. La rama no incluye el aumento del límite de archivos de la PR 299: conserva los 40 MB vigentes en main. Antes de aplicar SQL hay que confirmar que 0081 sigue disponible en la base real.

## Resultado esperado

Actualizacion del preflight real: 42 revisiones, 41 firmadas y una pendiente; todas con rutas historicas. No existen aun la columna de version, el trigger ni la RPC nuevos. Las politicas SELECT de tabla y Storage estan presentes. El CLI accede correctamente al ejecutarse fuera del entorno aislado.

En ASUS hay dos tareas `Alpha - revision semanal (manana)` y `Alpha - revision semanal (noche)`, ambas en estado Ready durante la inspeccion. Ejecutan `C:\Users\ASUS\dev\alpha-viernes\scripts\revision-semanal-viernes.ps1`. Ese script descarga y cambia a `origin/main`; si falla la descarga sigue con el codigo anterior. No basta actualizar una carpeta: antes de reactivar las tareas hay que verificar el commit efectivo del publicador. No se detuvieron ni modificaron las tareas. No se ha inspeccionado MANU.

El firmador de terminal de esta rama queda retirado: sin `--ensayo` termina antes de consultar credenciales y dirige a `/coach/revisiones`. Con `--ensayo` conserva la consulta de pendientes. Ya no contiene la escritura directa de firmas con credencial de servicio. Debe distribuirse junto con la bandeja operativa; las copias antiguas en otros equipos siguen pendientes de retirada.

En el panel del coach aparece «Revisar audios y vídeos», ruta `/coach/revisiones`. Cada tarjeta permite reproducir el medio, leer su guion, confirmar la revisión completa y aprobar. El servidor compara la versión y comprueba el rol. Una solicitud de corrección se conserva sin alterar el guion de un medio existente. El render corregido debe volver a publicarse.

La pantalla conectada es `RevisionesPage`: no utiliza la regla experimental de apertura automática tras cuatro semanas del componente antiguo. No existe un historial real que justifique activar esa regla.

## Orden de activación

1. Respaldar esquema y metadatos; pausar publicaciones y firmas mientras se aplica el cambio.
2. Aplicar `0081_firma_revision_por_version.sql` y verificar señales de migración. La migración no aprueba ni modifica el contenido de revisiones existentes.
3. Actualizar todos los publicadores a `publicar-una-revision.mjs` de esta rama: cada subida usa una ruta nueva; cualquier reemplazo retira la firma. Retirar versiones viejas capaces de sobrescribir objetos con ruta fija.
4. Desplegar la app y comprobar con cuentas de prueba que un asesorado no ve borradores ni ejecuta la RPC; que el coach reproduce, solicita corrección y firma; y que una pestaña con versión vieja recibe conflicto.
5. Reactivar publicaciones. Las revisiones históricas con ruta fija siguen visibles si ya estaban firmadas. Para firmar una histórica pendiente desde la bandeja hay que republicarla como versión nueva, tras revisar el archivo.

No se ha aplicado esta migración ni desplegado la app durante la implementación. La base temporal de pruebas no demuestra el estado de producción.

## Comprobaciones locales

Resultado medido el 15 de septiembre: `npm run verify` correcto, 380 archivos y 4.502 pruebas. ESLint conserva los seis avisos preexistentes, sin errores ni avisos nuevos. Prueba SQL aislada correcta. Se añadió la señal ausente de la migración anterior 0078 después de que la primera suite detectara ese fallo.

Tras integrar `main`, renumerar a 0081 y corregir el desempate de mensajes: **387 archivos y 4.594 pruebas correctas**; `npm run verify` y `npm run build` terminaron con código 0. El build generó la PWA correctamente. La comprobación SQL ampliada con las políticas reales también pasó. La cifra anterior corresponde al punto previo a la integración.

- `npm run verify`: tipos, ESLint y suite completa de la app.
- `npm ci --prefix pruebas-sql --ignore-scripts` y `npm test --prefix pruebas-sql`: ejecutan la migración en PostgreSQL en memoria mediante PGlite; no requieren credenciales. Herramienta documentada en https://pglite.dev/docs/.
- Pruebas de página: confirmación explícita, conflicto, corrección y error de carga.
- Pruebas de publicador: objetos diferentes en cada subida, firma retirada y ninguna fila escrita si falla la subida.

La prueba SQL ejecuta las políticas reales de 0065/0068 y cambia entre roles autenticado y anónimo: el asesorado no lee borradores, no firma y solo abre su archivo después de aprobarlo el coach. Se recrea el esquema auxiliar de Supabase en memoria; falta comprobarlo contra Auth/Storage desplegados. La inspección visual local está en `2026-09-15-prueba-visual-revisiones.md`; falta un teléfono físico. Si falla la escritura de la fila después de subir un archivo, queda un objeto huérfano: no se publica ni sustituye el anterior; requiere limpieza posterior.

## Acceso requerido para el siguiente paso

La consulta de solo lectura al proyecto Alpha (`sbzmbiwrnvegrticatza`) no pudo ejecutarse: el CLI respondió `LegacyPlatformAuthRequiredError`, sin sesión de Supabase. No se buscaron claves en archivos o historiales. Tras `supabase login`, ejecutar:

`supabase --output-format json db query --linked --project-ref sbzmbiwrnvegrticatza --file supabase/preflight-firma-revisiones.sql`

Este preflight no aplica cambios. La migración y el despliegue siguen pendientes de activación coordinada.
