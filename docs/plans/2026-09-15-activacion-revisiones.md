# Activación pendiente: revisiones por versión

Implementado en la rama `feat/bandeja-revisiones`, creada sobre el commit `3d51d2f` de la rama del límite de medios (PR 299). Antes de fusionar hay que conciliar esta base con `main` y confirmar que el número 0079 sigue disponible en el repositorio y en la base real.

## Resultado esperado

En el panel del coach aparece «Revisar audios y vídeos», ruta `/coach/revisiones`. Cada tarjeta permite reproducir el medio, leer su guion, confirmar la revisión completa y aprobar. El servidor compara la versión y comprueba el rol. Una solicitud de corrección se conserva sin alterar el guion de un medio existente. El render corregido debe volver a publicarse.

La pantalla conectada es `RevisionesPage`: no utiliza la regla experimental de apertura automática tras cuatro semanas del componente antiguo. No existe un historial real que justifique activar esa regla.

## Orden de activación

1. Respaldar esquema y metadatos; pausar publicaciones y firmas mientras se aplica el cambio.
2. Aplicar `0079_firma_revision_por_version.sql` y verificar señales de migración. La migración no aprueba ni modifica el contenido de revisiones existentes.
3. Actualizar todos los publicadores a `publicar-una-revision.mjs` de esta rama: cada subida usa una ruta nueva; cualquier reemplazo retira la firma. Retirar versiones viejas capaces de sobrescribir objetos con ruta fija.
4. Desplegar la app y comprobar con cuentas de prueba que un asesorado no ve borradores ni ejecuta la RPC; que el coach reproduce, solicita corrección y firma; y que una pestaña con versión vieja recibe conflicto.
5. Reactivar publicaciones. Las revisiones históricas con ruta fija siguen visibles si ya estaban firmadas. Para firmar una histórica pendiente desde la bandeja hay que republicarla como versión nueva, tras revisar el archivo.

No se ha aplicado esta migración ni desplegado la app durante la implementación. La base temporal de pruebas no demuestra el estado de producción.

## Comprobaciones locales

Resultado medido el 15 de septiembre: `npm run verify` correcto, 380 archivos y 4.502 pruebas. ESLint conserva los seis avisos preexistentes, sin errores ni avisos nuevos. Prueba SQL aislada correcta. Se añadió la señal ausente de la migración anterior 0078 después de que la primera suite detectara ese fallo.

- `npm run verify`: tipos, ESLint y suite completa de la app.
- `npm ci --prefix pruebas-sql --ignore-scripts` y `npm test --prefix pruebas-sql`: ejecutan la migración en PostgreSQL en memoria mediante PGlite; no requieren credenciales. Herramienta documentada en https://pglite.dev/docs/.
- Pruebas de página: confirmación explícita, conflicto, corrección y error de carga.
- Pruebas de publicador: objetos diferentes en cada subida, firma retirada y ninguna fila escrita si falla la subida.

Límite: la prueba SQL recrea el esquema mínimo necesario; falta la comprobación de RLS con sesiones y Storage reales y la revisión visual en móvil. Si falla la escritura de la fila después de subir un archivo, queda un objeto huérfano: no se publica ni sustituye el anterior; requiere limpieza posterior.
