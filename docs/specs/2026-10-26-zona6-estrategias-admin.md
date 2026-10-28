# Zona 6 · Estrategias y Administración (fase 3, 26-oct-2026)

## Qué

Pasar al lenguaje visual de las zonas 1-4 las dos pantallas que Empresa agrupa en su sombrero
de Administración: `/coach/estrategias` (`administracion/EstrategiasPage`) y
`/coach/administracion` (`administracion/AdministracionPage`, con finanzas, plataforma, plan,
jornada laboral, riesgos, desvíos, propuestas y decisiones compartidas). No se mueve ninguna
ruta: las dos direcciones siguen siendo las mismas.

## Lo que hace hoy (y no se pierde)

Cada fila cita la prueba que ya lo protege en `main` y debe seguir verde con el código viejo.

### Estrategias

| Qué hace | Prueba que lo protege |
|---|---|
| Orden de Bryan: mercadeo → investigación → influencers/creadores → bola de nieve | `EstrategiasPage.test.tsx` · «mercadeo, investigación, influencers…» |
| El buzón de mercadeo se monta al abrir la tarjeta, no antes | `EstrategiasPage.test.tsx` · «Investigación reutiliza el buzón» |
| Sin `responder_mercadeo` no se monta el buzón y se dice qué permiso falta | `EstrategiasPage.test.tsx` · «sin responder_mercadeo…» |
| Creadores y bola de nieve solo enlazan con `revisar_creadores` | `EstrategiasPage.test.tsx` · «creadores y bola de nieve enlazan…» / «sin revisar_creadores…» |
| Objetivos: meta con fuente, lo real en FALTA y nunca un cero | `EstrategiasPage.test.tsx` · «Objetivos de la bola de nieve» |
| Sin `ver_administracion` no se lee el tablero: «Sin permiso» | `EstrategiasPage.test.tsx` · «sin ver_administracion…» |
| Con permiso y sin tabla: «Pendiente de activar (0102)» | `EstrategiasPage.test.tsx` · «con permiso y sin tabla…» |
| Con tabla y sin corte: FALTA, nunca 0 | `EstrategiasPage.test.tsx` · «con permiso y sin corte…» |
| Decisiones compartidas solo para el coach, al final | `EstrategiasPage.test.tsx` (orden de regiones) |
| Investigación del agente: agrupa por tipo, comenta y relee, conserva lo escrito si falla | `InvestigacionInteractiva.test.tsx` |
| Tarjetas de investigación: sin dato, sin permiso, sin tabla y datos inválidos se distinguen | `InvestigacionMercadeo.test.tsx` |

### Administración

| Qué hace | Prueba que lo protege |
|---|---|
| Orden: plan, jornada, finanzas, plataforma, riesgos, desvíos, propuestas, decisiones | `AdministracionPage.test.tsx` · «va de arriba abajo» |
| Todo plegado: una frase por tarjeta y el detalle al tocar | `AdministracionPage.test.tsx` · «todo viene plegado» |
| Capa 2 (tarjeta) y capa 3 (fila): fuente, qué hacer y dueño | `AdministracionPage.test.tsx` · «capa 2… capa 3» |
| Semáforo con palabra y color; cifra vacía = FALTA, nunca 0 | `AdministracionPage.test.tsx` · «las secciones sin corte…» |
| Sin `ver_administracion` no se consulta y todo dice «Sin permiso» | `AdministracionPage.test.tsx` · «sin ver_administracion NO lee…» |
| Sin tabla (0102) = «Pendiente»; error real = fallo con Reintentar | `AdministracionPage.test.tsx` · dos pruebas del tablero |
| Filtro «Todo / Requiere acción» y su vacío | `AdministracionPage.test.tsx` · «el filtro…» / «Ninguna sección…» |
| Teléfono: una sola sección abierta; escritorio: varias; se recuerda | `AdministracionPage.test.tsx` · «en teléfono…» / «recuerda la sección…» |
| Riesgos = filas rojas de finanzas, desvíos y plan; sin corte = FALTA | `AdministracionPage.test.tsx` · «Riesgos sale de las filas rojas…» |
| Puertas por capacidad (`organizar_plan`, `decisiones_compartidas`) | `AdministracionPage.test.tsx` · «con solo organizar_plan…» |
| Jornada: tachar solo el dueño, FALTA lo que el plan no trae, Manuela en solo lectura | `JornadaLaboral.test.tsx` |
| Decisiones compartidas: doble firma, rechazo con motivo, borrador que no se pierde | `DecisionesCompartidas.test.tsx` |
| Plataforma enlaza al buzón de comentarios de la app | `AdministracionPage.test.tsx` · «plataforma enlaza…» |

## Decisiones de esta zona

1. **Cabecera y piezas de Empresa.** Un `Cabecera` local (kicker de 11 px, título display de
   30 px, frase) y las tarjetas plegables con el mismo borde, superficie y fila que las filas de
   `EmpresaPage`. No se crea ningún botón, hoja ni «volver» nuevos.
2. **Volver con el «‹» único.** `/coach/estrategias` y `/coach/administracion` declaran
   `padre: '/empresa'` en `rutas.ts`. Desaparece el enlace de texto «Volver a mi app» del marco
   del coach y el «Volver a Mi día» al pie de Administración. La salida de siempre no se pierde:
   el «‹» lleva a Empresa y la barra del equipo sigue teniendo «Mi día».
3. **Filtro en la URL.** El filtro de Administración pasa de `useState` a `?filtro=accion`
   (con `replace`), así sobrevive a recargar y a volver, y el gesto atrás sale de la pantalla en
   vez de deshacer el filtro.
4. **Semáforo por materia.** El al-día va en punto de plata sin filete, el ámbar hueco y el rojo
   lleno: el color no es la única señal (la palabra sigue al lado).
5. **Hoja de movimiento del sistema.** La flecha de un plegable usa `--dur-base` y
   `motion-reduce:transition-none`; no se anima el alto, solo el giro del glifo.
6. **Lo que no se toca.** Puertas por capacidad, riesgo alto solo con `autorizar_excepcion`,
   consola en solo lectura, bandejas de primer plan y renovados, dolor = rojo, cuenta Alpha
   limitada a `/tablero`. No se entra a Supabase, no se leen datos reales.

## Rutas

No cambia ninguna ruta: las dos pantallas siguen en `/coach/estrategias` y
`/coach/administracion`. No hay redirecciones nuevas que añadir; sí cambia el padre del «‹».

## Pruebas que se añaden

- `EstrategiasPage.test.tsx`: la pantalla no pinta un «Volver a…» de texto.
- `AdministracionPage.test.tsx`: el filtro vive en la URL (entra por `?filtro=accion`, cambia la
  URL al tocar los chips) y la pantalla no pinta «Volver a Mi día».
- `rutas.inventario.test.ts`: el «‹» de las dos pantallas vuelve a Empresa; se actualiza la lista
  de salidas heredadas del «‹».
- `CoachLayout.acceso.test.tsx`: donde ya hay «‹» no se repite «Volver a mi app»; el «sin
  permiso» de Administración no lleva un «Volver» de texto.

## No comprobado

- Nada en un iPhone real ni con lector de pantalla.
- El contraste WCAG de los puntos del semáforo no se mide con fórmula; se usan los tokens.
- 390/1280 px: se revisa por lectura del marcado y con `npm run build`; no hay captura de
  navegador en esta zona (la revisión visual la hace Claude al recibir el PR).
