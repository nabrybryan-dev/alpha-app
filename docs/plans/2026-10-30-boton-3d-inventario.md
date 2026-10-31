# Boton3D en toda la app: inventario (2026-10-30)

Fuente: `maqueta-v7.html`, botones con `btn3d`. Estado: CAMBIA (ya es Boton3D), YA ESTABA, DEJA (se queda y por qué).

| Maqueta | Equivalente en el código | Estado |
|---|---|---|
| Empezar sesión (hoja del salón, `slEmpezar`) | `PanelInferior.tsx` | YA ESTABA |
| Anotar serie (`slAnotar`) | Guardar serie en `RegistroSerieSalon.tsx` | CAMBIA |
| Abrir su ficha (alerta, equipo) | `equipo/AvisosDeSeguridad.tsx` | CAMBIA |
| Empezar sesión (Tu semana) | `TarjetaSesionDeHoy.tsx` | YA ESTABA |
| Escuchar la revisión (redondo) | Revisión semanal (semana) | DEJA: ya la une otra rama; sin botón con ese rótulo en el código |
| Pulsar y mantener (`hb`) | no existe en el código | DEJA |
| Hecho tal cual (`serie`) | `HechoTalCual.tsx` (contorno) | DEJA: convive con Guardar serie; la principal es Guardar serie |
| Siguiente ejercicio | `EjercicioCompletado.tsx` | CAMBIA |
| Abrir la sesión | `ruta/BloqueEnCurso.tsx`, `MiEntrenoPage.tsx` (Entrar al salón) | CAMBIA |
| Enviar respuestas | `ResponderCuestionario.tsx` | CAMBIA |
| Guardar y terminar | `TestPostSesion.tsx` (Finalizar sesión) | CAMBIA |
| Guardar (comentario) | `ValoracionCompetencias.tsx` | DEJA: un Guardar por cada competencia en la misma tarjeta |
| Registrar contacto | no existe aún en `AvisosDeSeguridad` | DEJA |
| Abrir su ficha (cartera) | `coach/` cartera | DEJA: no se halló un botón equivalente en el código |
| Guardar check-in | `bienestar/CheckinForm.tsx` | CAMBIA |
| rsHoy (ruta simple, hoy) | `RutaSimple.tsx` es una etiqueta, no botón | DEJA |
| Anotar lo que comí | `MiNutricionDeHoy.tsx` (Registrar, `tecla-2`) | DEJA: Hoy ya tiene su principal (Empezar sesión) |
| Guardar vetados | `nutri/SheetVetados.tsx` | DEJA: no se tocó, sin prueba en pantalla |
| La cociné | `RecetaSheet.tsx` | YA ESTABA |
| Listo (encuesta) | `nutricion/EncuestaNutricion.tsx` | CAMBIA |
| Guardar la prueba | `nutricion/PanelCalibracion.tsx` | CAMBIA |
| Listo (hoja) / Guardar el cardio | sin equivalente localizado | DEJA |
| Llamar al 123 | Praxis (riesgo), `<a href=tel>` | DEJA: es seguridad; no se toca el freno por dolor |

## Fuera de la maqueta, también cambiados
Agregar a la comida (`SheetCantidad`), Añadir lo que compré (`SheetDespensa`), Enviar (`CribadoForm`), Guardar mapa de vida (`EncuestaMapa`), Responder (`TarjetaPregunta`), Abrir el chat (`SemanaPage`), Sí, avísame (`PedirPermiso`), Empezar la semana (`PortadaMicrociclo`), Mirar este día (`TamborDeLaSemana`), Volver a Hoy (`SesionCerrada`), Guardar como propuesta (`GenerarMicrocicloSheet`), Reintentar (`ConsultasPage`), Presentar a (`PresentacionAsesorado`), Guardar respuesta / Confirmar y enviar (`ResponderComoStaff`), Guardar nota (`NotasDeLlamada`).

## Se quedan como están (y por qué)
- Principal ya cubierta en la pantalla: Responder de `PreguntaDelCoach` (Hoy), Guardar ✓ de `MedidasCard`/`TarjetaVidaCard` (varias en Bienestar), Ir a Yo (`BienestarPage`), `DescansoTimer` (barra del cronómetro).
- Firmas y decisiones del equipo: Sale tal cual (`BandejaAprobacion`), Aprobar (`RevisionesPage`), Aceptar (`ObservacionesDelAgente`), confirmar de `AccionesRevision` (a veces rechaza), «Esto no es lo que yo habría dicho» (`ConsultasPage`).
- Destructivos o de error (rojo, no pasan a 3D): botones de `ErrorBoundary`, `SessionProvider` y `MarcaPage`.
- Encoder (cámara): `EncoderPage`, `Visor`, `HojaMedicion`, `ResultadoSerie`, `Encuadre`: no se tocaron (superposiciones sobre la cámara, sin prueba en pantalla).
- Cabecera de `AsesoradoDetallePage` (Generar microciclo): comparte fila con el semáforo; riesgo de desborde a 390 px.
- Enviar del chat (`Conversacion`): redondo de 44 px; `.btn-3d-redondo` mide 56 px y cambiaría la barra de escritura.
- Progreso (`logros`): sin acción principal.
- Auth (`LoginPage`, `NuevaClavePage`): `btn-cristal-rojo`, flujo propio.

## Cambio en CSS
`.btn-3d:disabled` ya no es rojo gris translúcido: superficie neutra con rótulo `--tenue` (H-06).
