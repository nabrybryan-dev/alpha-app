# Comprobación visual local de la bandeja

El 15 de septiembre se abrió el componente real `RevisionesPage` en Chrome mediante un servidor local de prueba. El repositorio de datos y las llamadas a Supabase se sustituyeron únicamente en la configuración de prueba; ninguna decisión de la pantalla llegó a producción.

Comprobado:

- Contenedor de 390 px: guion legible, campos y botones dentro de la tarjeta.
- Abrir el WAV de dos segundos, reproducirlo con el control nativo y confirmar revisión: se habilita «Aprobar esta versión».
- Aprobar la revisión ficticia: la lista pasa a «No hay revisiones pendientes».
- Contenedor de 768 px: solicitar una corrección contra el escenario de versión obsoleta muestra «La revisión cambió», conservando el borrador.
- Escenario de fallo al cargar: muestra el error y no dice que la bandeja esté vacía.

El reproductor de audio usa `w-full` para ajustarse también a tarjetas más estrechas. Estos contenedores se inspeccionaron en navegador de escritorio; **no equivalen a una prueba en un teléfono físico**. Tampoco validan reproducción de un avatar real ni latencia contra Supabase.

Reproducir: `npm exec -- vite --config pruebas/previa-revisiones.config.mjs` y abrir `http://127.0.0.1:5187/pruebas/previa-revisiones.html`. Variantes: `?escenario=conflicto&ancho=amplio`, `?escenario=error`, `?escenario=archivo`, `?escenario=vacia`.

La configuración se sirve solo en 127.0.0.1. Los ficheros de prueba no son rutas de la aplicación de producción.
