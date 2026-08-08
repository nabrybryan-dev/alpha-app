# Nutrición al lenguaje del rediseño — plan

**Fecha:** 7 de agosto de 2026
**Spec:** [`../specs/2026-08-07-nutricion-al-lenguaje-del-rediseno.md`](../specs/2026-08-07-nutricion-al-lenguaje-del-rediseno.md)

---

## Paso 1 — El test que documenta el `<h1>` duplicado (rojo)

`src/features/nutricion/encabezados.test.tsx`

Monta cada pantalla de nutrición dentro del `AsesoradoLayout` real y comprueba
que hay **un solo `<h1>`** en el documento (el del `TopBar`).

Falla a propósito: hoy hay dos. Commit `test:` propio, según el patrón del repo.

## Paso 2 — La primitiva

`src/components/ui/CabeceraPantalla.tsx` + `CabeceraPantalla.test.tsx`

```
interface CabeceraPantallaProps {
  etiqueta?: string        // la línea pequeña en mayúsculas
  titulo: string
  pie?: ReactNode          // línea bajo el título (kcal, explicación)
  acciones?: ReactNode     // botones a la derecha
  alVolver?: () => void    // si viene, pinta el botón ←
  etiquetaVolver?: string  // aria-label del botón (por defecto "Volver")
  capitalizar?: boolean    // para títulos que salen de Intl en minúscula
}
```

Emite `<h2>`. Sin estado, sin datos, sin `db`.

## Paso 3 — Adoptarla, pantalla por pantalla

| Archivo | Forma que usa |
|---|---|
| `MiPlan.tsx` | volver + título |
| `VistaSemana.tsx` | volver + título |
| `DetalleComida.tsx` | volver + etiqueta (hora) + título + pie (kcal) |
| `DiarioDia.tsx` | etiqueta + título capitalizado + 2 acciones |
| `EncuestaNutricion.tsx` | etiqueta + título + pie (párrafo) |

El paso 1 pasa a verde aquí. Actualizar el encabezado del test para que deje de
decir que falla a propósito (regla del CLAUDE.md).

## Paso 4 — El ritmo de entrada

`DiarioDia` y `MiPlan`: envolver cada bloque de primer nivel en
`entrada entrada-N`, numerando de arriba abajo y sin pasar de `entrada-6`
(no hay más pasos definidos en `tokens.css`).

No se toca `SheetCantidad`, `SheetBuscarAlimento` ni `DetalleComida`: las hojas
ya animan al abrirse.

## Paso 5 — Verificar

```bash
npm run verify
```

Y mirar la app de verdad en el móvil: 430×932, tema claro **y** oscuro. La skill
`verificar-contra-la-realidad` aplica —los tests no ven píxeles—.

## Riesgos

- **El título salta de 20 px a 30 px.** En `DiarioDia` el título es la fecha
  larga y pasará a dos líneas. Es lo que se busca (contraste de escala), pero hay
  que verlo en pantalla antes de dar por bueno el paso 3.
- **`capitalize` de Tailwind** sobre un `Intl` en español capitaliza cada
  palabra, no solo la primera. Hoy ya es así en `DiarioDia`; si al verlo molesta,
  se arregla en el formateador, no en la clase.
