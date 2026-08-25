# Estado al cierre · noche del 2026-08-24 → 25

Sesión larga que empezó por «los videos no están disponibles» y terminó tocando
cuatro cosas distintas. Esto es lo que quedó hecho, lo que quedó pendiente y lo
que se afirmó mal por el camino.

**El disparador:** Natalia Loaiza y Juan Camilo Durán empiezan a entrenar el
martes 25. Al abrir la app se veía una sesión con la cabecera «EJERCICIO 1 DE 0»
y nada debajo.

---

## Lo que está en producción

| PR | Qué arregla |
|---|---|
| **#99** `d822a64` | Los videos de técnica, y que una sesión sin ejercicios no borre la pantalla |
| **#100** `b26ae31` | Que una etiqueta mal puesta no esconda ejercicios prescritos |

**#99 · Los videos.** Tres causas, ninguna era el video. (1) El botón «Técnica»
dependía de `contenidoDemoId`, que rellena quien carga el microciclo, y los
microciclos que salen del plan del coach no lo traen: `domain/demos.ts` cae ahora
a la biblioteca **por patrón de movimiento**, sin migrar ni un dato. (2)
`idDeYoutube` solo leía `watch?v=` y `youtu.be/`, y las fichas se pegan desde el
móvil, que comparte **Shorts**. (3) El enlace de salida solo se pintaba cuando
fallaba la lectura del id, así que un video con el embebido desactivado dejaba al
asesorado sin salida. Detalle en
[2026-08-24-demos-que-no-aparecian.md](2026-08-24-demos-que-no-aparecian.md).

**#99 · El saneado.** `hidratar` casteaba el blob de `datos` sin comprobarlo. Una
fila sin un array hacía que la app leyera `.length` de `undefined` y el
ErrorBoundary pintara «Esta sección no se pudo mostrar» — la pantalla entera
perdida por un campo ausente. Donde más dolía: `MiPlan` calcula **la lista de
secciones** con `plan.suplementacion.length`. `data/nube/saneado.ts` rellena vacío
lo que falte.

**#100 · La etiqueta.** Toda la maquinaria de fuerza colgaba de
`tipo !== 'metabolica'`, o sea que **la etiqueta decidía si se veía el
contenido**. Había dos sesiones activas marcadas `metabolica` **con ejercicios
dentro**: 7 de Alejandra Tapasco y 6 de Karin Better. Trece ejercicios que la app
no pintaba ni dejaba registrar. Ahora lo decide `hayEjercicios`.

## Los datos que se corrigieron

- **`fechaInicio` de Natalia:** 2026-08-24 → **2026-08-25**, para que su bloque
  coincida con su plan (martes 25 → martes 1-sep) y con el de Juan Camilo.
- **`tipo` de su Zona 2:** ausente → **`metabolica`**, como las otras seis
  sesiones de cardio del sistema.

Los dos con respaldo, idempotentes y verificados antes y después.

## Los tres barridos

- **`comprobar-fosiles.sql`** → cero fósiles en 100 filas. Se le añadieron el
  filtro por `estado` en la consulta 1 (la 2 ya lo tenía, y sin él el criterio de
  «cero filas» era inalcanzable) y una consulta 3 para los microciclos que las
  otras dos **no pueden mirar** — con `sesiones` en NULL, la lateral devuelve cero
  filas y borra el microciclo del resultado en silencio.
- **Inventario de ejercicios por sesión** → cero `ROTO`, cero sesiones de fuerza
  sin ejercicios. Todos los `ejercicios` son arrays.
- **`comprobar-alineacion.sql`** → **NO SE CORRIÓ.** Es el tercero de los tres
  obligatorios y tiene que dar cero filas antes de repartir la semana.

---

## Lo que se afirmó mal

**Dije que el `fechaInicio` era la causa de que a Natalia le saliera la Zona 2.
No lo era, y lo afirmé sin comprobarlo.**

`armarSemana` (`domain/rutaEntrenamiento.ts`) **no usa `fechaInicio` para
repartir los días**: construye los 7 días naturales alrededor de *hoy* y coloca
cada sesión en el día que dice su propio nombre. `fechaInicio` solo se usa en
`inicioSemanaDe`, para decidir si la semana abre en domingo o en lunes.
Comprobado después con el microciclo real:

```
ANTES  (inicio 24-ago) -> nat-m1-s5  ZONA 2 + MOVILIDAD (LUNES)  esDeHoy: true
DESPUÉS(inicio 25-ago) -> nat-m1-s5  ZONA 2 + MOVILIDAD (LUNES)  esDeHoy: true
```

Corregir el dato seguía siendo correcto, pero no era la causa de lo que se veía.
La lección está en el PR #101 y en la memoria del proyecto: antes de atribuir un
síntoma de «qué sesión me sale hoy» a un campo, escribir el test de tres líneas.

También conviene saber que el inventario mostraba `tipo: fuerza` en sesiones que
en realidad **no tienen `tipo`** — era el `coalesce` de la consulta, no el dato.

---

## Pendiente

### Lo único que puede dejar a alguien sin entrenar

**Seis asesorados sin microciclo para el 25.** Su bloque empezó el 17 y con
cadencia de 8 días venció el 24: Alejandra Cardona, Dhanny Agudelo, Felipe
Murillo, Juan Carlos Parra, Luis Hernández y Mara Piedrahita. Cinco de los seis
además no registraron **nada** en esos ocho días.

### Lo demás

- **`comprobar-alineacion.sql`** sin correr.
- **PR #101** abierto, sin mergear — que la app no ofrezca sesiones de un
  microciclo que aún no ha empezado. Solo acota por abajo; la mitad de los
  microciclos vencidos se deja a propósito. El argumento para mergearlo: si una
  asesorada tilda bloques antes de su `fechaInicio`, **esas marcas cuentan como
  fósiles** en el barrido, y se envenena la evidencia sola.
- **PR #96** en `CONFLICTING`. Su rama `diseno/grade-las-piezas` lleva duplicados
  los dos arreglos que se llevaron a `main` por cherry-pick. Necesita rebase.
- **Un stash en `alpha-app`** (`supabase-wip-no-mio`) con el arreglo del `rol` de
  `comprobar-fosiles.sql` — quitar `where u.rol = 'asesorado'`, que dejaba fuera a
  Manuela Quintero por ser `nutricionista` con microciclo. **Sin ese arreglo el
  barrido cuenta 141 donde hay 161.** Sigue sin commitear.
- **Deriva del núcleo del encoder.** `analisis.js` y `disco.js` llevan
  desalineados del original desde el 24-ago. La app mide con un núcleo viejo, que
  es exactamente lo que el #98 se escribió para cazar.
- **Duraciones imposibles** en dos test-post: Karen Michelle 5 min con 6
  ejercicios registrados, Laura Giraldo 1 min con 5. El cronómetro alimenta ese
  campo y sube al servidor.
