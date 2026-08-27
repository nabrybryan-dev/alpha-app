# Subir el techo de 194 asesorados — pasos

**2026-08-27** · ejecuta `docs/specs/2026-08-27-informe-de-carga-mil-usuarios.md`

El qué y el porqué están en el informe. Esto es el cómo: el orden, qué toca cada
paso y qué se comprueba después.

**Todas las cifras de aquí están medidas, no estimadas.** Se reproducen con
`supabase/banco-de-carga.sql` sobre una base de usar y tirar, y con
`supabase/medir-carga-del-coach.sql` contra producción.

> **Esto no es urgente hoy.** Con 24 asesorados el coach ocupa el 12 % de su
> cuota. Es el plan para cuando la cartera crezca, y el número que dispara la
> alarma es **150** — no 194, porque a 194 ya está roto.

---

## El techo, en una línea

`localStorage` tiene 5 MB por origen en Chrome. La app escribe ahí la instantánea
entera. Al coach le tocan **26.920 bytes por asesorado** solo de microciclos.

```
5 MB ÷ 26.920 bytes = 194 asesorados
```

No es la base de datos. Postgres sirve esa consulta en 343 ms y ni se despeina.

## Cómo saber cuándo empezar

Antes de nada, poner un número en el que mirar. Hoy no existe.

```sql
-- supabase/medir-carga-del-coach.sql, cambiando `objetivo` por la cartera real
```

**Disparador: cuando el coach pase del 50 % de la cuota** (~97 asesorados).
Ahí empieza el paso 1, no antes. Optimizar sin necesidad es cómo se rompe lo que
funciona.

---

## Paso 1 · Que el coach no guarde microciclos ajenos en disco

**Quita el muro entero. Es el único paso que de verdad hace falta.**

El coach necesita los microciclos ajenos **mientras mira**, no entre sesiones.
Ya hay precedente en el repo: `historialDe` (#142) devuelve datos sin tocar la
instantánea, y el componente los guarda en su estado.

Aquí es lo mismo un nivel más arriba: los activos y propuestos de la cartera
viven en memoria mientras la pestaña esté abierta, y no viajan a `localStorage`.

**Qué se toca**
- `src/data/mockDb.ts` — separar qué parte de la instantánea se persiste
- `src/data/nube/hidratar.ts` — dónde aterriza lo ajeno

**El riesgo, dicho por delante:** es la ruta donde este repo ya perdió datos dos
veces. La regla que lo hace seguro es la misma del #155: **lo propio y lo
pendiente de subir SIEMPRE en disco; lo ajeno, memoria.** Lo propio es
irrecuperable si se pierde; lo ajeno se vuelve a bajar.

**Se comprueba**
- El coach recarga la pestaña y su cartera vuelve a estar completa.
- Una asesorada sin señal registra series, cierra la app, la abre: **sigue todo**.
- `perdida-datos.test.ts` en verde sin tocarlo. Si se pone rojo, el cambio está
  mal, no el test.

---

## Paso 2 · Resumen en vez de blob para la lista

**Multiplica el techo por ~100.** Solo si después del paso 1 hiciera falta.

Medido: un microciclo pesa 20.983 bytes; lo que la lista del coach necesita
—quién, qué número, en qué estado, desde cuándo, cuántas sesiones— pesa **137
veces menos**.

Precedente exacto en el repo: la migración **0013** hizo esto mismo con la
nutricionista. `checkins_nutricion` le da tres columnas en vez de la fila entera.

**Lo que NO se puede hacer, y es la trampa de este paso**

Calcular `pctRegistrado` en SQL. `sesionCompleta` (`domain/cumplimiento.ts`)
tiene reglas con historial de incidentes escrito —«si hay ejercicios, mandan los
ejercicios, aunque esté marcada metabólica»— y este repo ya se quemó con la misma
regla escrita dos veces: 128 ejercicios de 13 asesorados desalineados el
2026-08-12.

Si el resumen necesita ese número, tiene que salir de **una sola** definición.
La opción menos mala es extender la vista materializada del ranking (0048), que
ya duplica ese criterio de forma aceptada y documentada desde la 0005.

**Se comprueba**
- Pantalla por pantalla del coach antes de recortar. Recortar de más es una
  pantalla en blanco.
- El semáforo y la revisión de cartera dan lo mismo que antes, asesorado por
  asesorado.

---

## Paso 3 · La instantánea a IndexedDB

**Quita el límite, pero es el cambio más grande.** Solo si 1 y 2 no bastaran.

IndexedDB no tiene la cuota de 5 MB: usa el presupuesto del origen, que en
móviles suele ser cientos de megas.

**Por qué va el último**
- Es asíncrono, y `mockDb` lee **síncrono** en todas partes (`ref.actual`).
  Cambiarlo toca cada repositorio y cada pantalla.
- Sube el techo sin reducir el trabajo: seguirían viajando y parseándose 26 MB
  cada 45 s. Cabría, pero el móvil seguiría sufriendo.

Es decir: **resuelve el síntoma, no la causa.** Los pasos 1 y 2 quitan el peso;
éste solo hace sitio para él.

---

## Lo que ya está hecho, para no repetirlo

| | |
|---|---|
| RLS por fila | 0045–0047. De ~1.100 barridos por hidratación a ~20 |
| Ranking | 0048. De 23,12 ms a 0,17 |
| Índices | 0044. Solo hacía falta uno; tres estaban duplicados |
| Saltar tablas sin cambios | #136, con la firma de la 0049 |
| El coach sin histórico ajeno | #142. De 105 MB a 26, medido |
| Que no se pierdan escrituras al llenarse | #155 |

**El lado servidor está exprimido.** Lo que queda es todo del lado del
navegador, y ése es el hallazgo que ordena este plan: se atacó el servidor
durante toda una sesión, y el techo nunca estuvo ahí.
