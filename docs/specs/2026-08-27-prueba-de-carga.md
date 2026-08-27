# Prueba de carga: el script, y dónde correrlo

**Fecha:** 2026-08-27
**Estado:** script escrito y sin correr

El script está en `scripts/carga/hidratacion.k6.js`, con el porqué de cada
decisión en su cabecera. Este documento cubre lo que el script no puede
resolver solo: **contra qué se corre**.

---

## Tres cosas que hay que decidir antes de correr nada

### 1. No contra producción

`sbzmbiwrnvegrticatza` tiene los datos de salud de 26 personas reales. Una
prueba de carga escribe, satura, y —esto es lo que más cuesta reparar— **ensucia
los contadores de `pg_stat`** con los que se ha medido todo el trabajo de
escalabilidad. Correrla ahí una vez estropea la línea base para siempre: los
`seq_scan` acumulados dejan de significar «lo que hacen las personas» y pasan a
incluir mil usuarios inventados.

El script se niega solo. Hay que pasarle `-e CONTRA_PRODUCCION=lo-asumo` para
saltárselo, y el nombre de la variable es el aviso.

### 2. Hace falta un proyecto de destino

Una **rama de Supabase** es lo adecuado: un proyecto efímero al que se le aplican
las migraciones y que **no lleva los datos de producción**. Tiene coste, así que
se confirma antes de crearla.

Ojo con lo que eso implica para el resultado: una rama nace **vacía**. Con las
tablas a cero, Postgres elige planes distintos —un `seq scan` sobre cero filas es
gratis— y el informe diría que todo va perfecto. **Hay que sembrarla** con un
volumen parecido al que se quiere probar: si se quiere saber qué pasa con 1.000
usuarios, la base tiene que tener datos de 1.000 usuarios, no de 26.

Esa siembra es trabajo aparte, y sin ella la prueba mide humo.

### 3. Y k6 puede no arrancar en esta máquina

`CLAUDE.md`, sección 1:

> La directiva de **Control de aplicaciones (WDAC)** de este equipo bloquea los
> binarios nativos de npm. […] Antes de proponer una herramienta, comprobar que
> no dependa de un `.node` ni de un `.exe`.

k6 es un binario de Go: en Windows, un `.exe`. Es exactamente el caso que ya
costó una vez con `oxlint`, que quedó configurado e inservible mientras el
equipo creía tener un linter.

**Compruébalo antes de montar nada:** `k6 version`. Si WDAC lo bloquea, quedan
dos salidas: correrlo desde otra máquina o desde CI —el runner de GitHub Actions
no tiene esa directiva—, o escribir una prueba más modesta en Node puro, que
llega menos lejos pero no necesita binarios.

## Qué mide, y qué decidió su forma

Cada iteración imita **una pestaña abierta en un refresco**, no una petición
suelta:

1. `firma_de_sincronizacion` — el camino corto (0049)
2. las 21 consultas en paralelo, con las columnas reales de `hidratar.ts`
3. `ranking_disciplina` — desde la vista materializada (0048)
4. espera de ~45 s, que es lo que hace `SessionProvider.tsx`

Tres decisiones que cambian el resultado:

- **Va autenticado.** Sin JWT no se activa RLS, y RLS es justo lo que decide
  cuánto trabajo hace el servidor.
- **`PROPORCION_COACH`** reparte cuántos entran como staff. Pesa más de lo que
  parece: un coach descarga la cartera entera y un asesorado solo lo suyo, así
  que el mismo número de usuarios da cargas muy distintas según la mezcla. Por
  defecto 0,05 — uno de cada veinte.
- **La espera de 45 s no se quita.** Sin ella se mediría un martilleo que ningún
  usuario real produce, y el cuello de botella que saldría sería el del
  generador de carga.

## Cómo leer el resultado

El número final no es el informe. Lo que importa es **en qué escalón** empiezan a
subir los tiempos y **qué fase se degrada primero**:

| se degrada primero | qué significa | por dónde tirar |
|---|---|---|
| `hidratacion` | volumen de datos: se descarga demasiado | el salto por tabla que quedó fuera del PR #124 |
| `firma` | contención en Postgres: los `count(*)` bajo RLS pesan | registro de cambios por usuario en vez de contar |
| `ranking` | el cron no refresca y se está calculando en vivo | mirar `cron.job` y el sello |
| todas a la vez | conexiones agotadas | el *pooler* de Supabase, no el código |

Esa última fila es la que más se confunde con un problema de código. Si los
tiempos se disparan **de golpe** y a la vez en todas las fases, casi nunca es una
consulta: es que no quedan conexiones. Se ve en el panel de Supabase, no en el
informe de k6.

## Lo que ya sabemos sin correrla

No se parte de cero. De lo medido entre el 26 y el 27 de agosto:

- El RLS por fila costaba ~1.100 barridos de `usuarios_app` por hidratación.
  Ahora ~20. **Ese cuello ya no está.**
- El ranking pasó de 23,12 ms a 0,17 ms de mediana.
- Un refresco en el que nadie tocó nada pasó de 21 descargas de tabla entera a
  una consulta.

Así que la prueba no sirve para «ver si escala»: sirve para encontrar **el
siguiente** cuello, que ya no es ninguno de esos tres. La hipótesis a batir es
que sea el volumen de descarga del coach, porque es lo único que sigue creciendo
de forma lineal con la cartera.
