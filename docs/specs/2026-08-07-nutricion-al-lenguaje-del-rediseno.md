# Nutrición al lenguaje del rediseño — diseño

**Fecha:** 7 de agosto de 2026
**Rama:** `nutricion-al-lenguaje-del-rediseno`
**Continúa:** PR #17 (`rediseno-app-asesorado`, 1 de agosto)

---

## Por qué

El rediseño del asesorado (PR #17) estableció un lenguaje visual: cabecera con
etiqueta pequeña sobre el título, título en `font-display` grande, y los bloques
de la pantalla entrando escalonados. Lo aplicó en Entrenar, Hoy, Progreso y
Logros.

**Nutrición se quedó fuera.** Son 17 archivos, y es la superficie que el
asesorado toca varias veces al día —cada comida—. Hoy se ve como la app de antes
del rediseño, al lado de pestañas que ya cambiaron.

## Lo que está mal hoy, medido

| Hallazgo | Evidencia |
|---|---|
| La etiqueta pequeña tiene **9 variantes** | 43 usos combinando `text-[10px]`/`text-[11px]` con `tracking-[0.12em → 0.18em]`. Nutrición usa `10px/0.14em`; el rediseño dejó `11px/0.16em` |
| El título de pantalla tiene **3 escalas** | Nutrición `text-xl` · Bienestar y Cuestionarios `text-3xl` · Progreso `text-2xl` |
| **Dos `<h1>` en la misma página** | `TopBar` (`layouts.tsx:56`) ya emite un `<h1>` en toda ruta de asesorado. `DiarioDia`, `MiPlan`, `VistaSemana`, `DetalleComida` y `EncuestaNutricion` añaden otro. Bienestar y Progreso sí usan `<h2>` |
| Nutrición **sin ritmo de entrada** | 17 archivos, 0 con `entrada entrada-N` |

El `<h1>` duplicado no es cosmético: un lector de pantalla anuncia dos títulos de
nivel 1 y la persona pierde la referencia de dónde está.

## Qué se decide

**1. Una sola cabecera de pantalla, como primitiva.**
`src/components/ui/CabeceraPantalla.tsx`, sin lógica de negocio (regla de
`components/ui/`). Cubre las cinco formas que ya existen en nutrición: botón de
volver, etiqueta, título, pie y acciones a la derecha. Ninguna es inventada.

**2. La forma canónica** —la del rediseño, no la mayoritaria—:

- Etiqueta: `text-[11px] font-bold uppercase tracking-[0.16em] text-tenue`
- Título: `font-display text-3xl leading-[1.05] text-texto`
- Elemento: **`<h2>`**, porque el `<h1>` es del `TopBar`

Se elige `leading-[1.05]` y no el `leading-none` de Bienestar porque aquí hay
títulos de dos líneas (la fecha larga de `DiarioDia`, «jueves, 7 de agosto») y
`leading-none` recorta los descendentes.

**3. Nutrición mantiene el tema.** Sigue en `texto`/`tenue`, que cambian con el
tema claro/oscuro. **No** se pasa a `silver-*`/`ink-*`, que están fijos en
`:root`: eso dejaría la pantalla oscura en tema claro. Entrenar y Progreso son
oscuros fijos a propósito —se usan en el gimnasio—; nutrición se consulta en
cualquier sitio.

**4. El ritmo de entrada** se aplica en las dos pantallas de lista larga
(`DiarioDia` y `MiPlan`), no en las hojas ni en los detalles: una hoja que se
abre ya tiene su propia animación de entrada, y encadenar las dos se ve como un
salto.

## Qué NO entra aquí

- **El barrido transversal** de las otras 9 variantes de etiqueta fuera de
  nutrición. Es una tanda propia; mezclarlas haría el diff ilegible.
- **La escala `bone-*`/`paper` muerta** (0 usos, declarada en `tokens.css:97`
  como «Superficies claras (Hoy/Bienestar/Progreso)» mientras Progreso se
  construyó en `bg-ink-900`). Es una contradicción real del design system, pero
  se resuelve decidiendo qué pantallas son oscuras fijas —una decisión de
  producto, no de refactor—.
- **Los 14 avisos del linter** que el CLAUDE.md deja pendientes a propósito.

## Cómo se sabe que salió bien

- `CabeceraPantalla` tiene test propio: emite `<h2>` y no `<h1>`, pinta la
  etiqueta solo si se le pasa, y el botón de volver llama a su callback.
- Un test comprueba que **ninguna pantalla de nutrición emite `<h1>`**. Es el que
  documenta el defecto de accesibilidad y evita que vuelva.
- `npm run verify` en verde.
