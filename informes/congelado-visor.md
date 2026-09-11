# El congelado del visor: qué se midió y qué no

El autor del PR #183 escribió en el cuerpo del PR: «No he visto esto renderizado.
El navegador se congela al abrir el visor y dejé de insistir.» Este informe no
discute esa frase: la pone a prueba con números tomados hoy, 2026-08-29, en
Chrome 151 sobre Windows 11 (AMD Radeon RX 6600, ANGLE/D3D11, pantalla a 144 Hz,
`devicePixelRatio` 1) y en Node v24.19.0 sobre la misma máquina.

Lo primero, y es lo incómodo: **el visor no se pudo abrir en ninguno de los dos
despliegues**, ni en producción ni en la preview. Las dos secciones siguientes
explican exactamente qué lo impidió. Lo que sí se midió —y de dos formas
independientes que se confirman entre sí— es el coste por fotograma del motor,
que es donde vive la sospecha.

## Medición en producción

URL de producción, obtenida con `gh api repos/:owner/:repo --jq '.homepage'` →
`https://alpha-athletics-app.vercel.app`.

La sesión del navegador ya estaba iniciada (cuenta «JD»), así que el problema no
fue el acceso. El problema es **de ruta**: `VisorPatron` sólo se monta desde
`EstudioDelPatron`, y `EstudioDelPatron` sólo se monta desde el `Sheet` de
`SesionPage.tsx:398`, que abre el botón «Patrón 3D» de `TarjetaEjercicio.tsx:144`.
Esa tarjeta cuelga de una guarda:

```tsx
{hayEjercicios && !todasRegistradas && (   // SesionPage.tsx:280
```

Las cuatro sesiones de la cuenta están cerradas. Medido navegando una a una y
contando botones cuyo texto casa con `/Patr/i`:

| sesión | cabecera | botones «Patrón 3D» |
|---|---|---|
| `jcd-m1-s1` | Sesión completa · 94 min · RPE 9/10 | 0 |
| `jcd-m1-s2` | Sesión completa · 80 min · RPE 10/10 | 0 |
| `jcd-m1-s3` | Sesión completa · 54 min · RPE 8/10 | 0 |
| `jcd-m1-s4` | Sesión completa · 77 min · RPE 9/10 | 0 |

Con `todasRegistradas === true` la sección entera de ejercicios no se pinta, así
que no hay disparador del visor en toda la app. La única forma de hacerlo
aparecer era borrar una serie registrada de `alpha-db-v2` en `localStorage`, y
eso **no se hizo**: `src/data/nube/` sincroniza hacia Supabase y no había forma de
garantizar que la edición se quedase en el navegador. Falsear datos de un
asesorado real para tomar una medida no es una medida.

Lo que sí quedó medido en producción, con la pestaña **visible**
(`document.visibilityState === "visible"`, comprobado en la misma llamada):

- fotogramas por segundo de la página, contando callbacks de
  `requestAnimationFrame` durante 2 000 ms: **144,0 fps** (289 fotogramas en
  2 006,8 ms). Es el techo de la pantalla, y confirma que ni la app ni la pestaña
  estaban frenadas.
- `read_console_messages` con `onlyErrors: true`: **cero errores**.

Para no quedarse sin dato del motor, sobre esa misma pestaña de producción se
ejecutó un banco con un contexto WebGL real (ver **Evidencia numérica**).

## Medición en la preview de la rama

URL: `https://alpha-athletics-app-git-escenario-el-laboratorio-coachingalpha.vercel.app`.
Responde, sirve la app y la sesión también está iniciada.

Dos cosas que conviene no confundir:

1. La preview del PR #183 es la rama `escenario/el-laboratorio`, no
   `salon/entrenar-4d`. Su `/entrenar` sigue siendo el `RutaPage` de siempre, no
   el salón: comprobado leyendo el texto de la página, que arranca en «EMPIEZA TU
   MICROCICLO / MICROCICLO M1 / 4 SESIONES».
2. Por tanto el visor está exactamente detrás de la misma puerta que en
   producción. Navegando a `/entrenar/sesion/jcd-m1-s1` en la preview sale la
   misma cabecera «Sesión completa · 94 min · RPE 9/10» y los mismos **0** botones
   «Patrón 3D».

Es decir: **la preview tampoco reproduce el congelado, porque tampoco deja llegar
al visor**. Lo que el autor del PR describió no se pudo ni confirmar ni desmentir
abriendo el visor, y decirlo de otra manera sería inventar.

Con la pestaña visible en la preview: **146,3 fps** en vacío y cero errores de
consola. Sobre esa pestaña se corrió el A/B de geometría —main contra la rama—
que aparece abajo.

**Qué haría falta para conseguir la medida que falta.** Cualquiera de estas tres,
y ninguna está en mi mano sin permiso de Bryan:

- una sesión del microciclo con al menos un ejercicio **sin registrar** en la
  cuenta de pruebas (basta con no cerrar `jcd-m1-s4`), o una cuenta de pruebas
  distinta con el microciclo recién sembrado;
- una ruta de desarrollo que monte `EstudioDelPatron` o `ExploradorAnatomico`
  directamente, del estilo `/entrenar/patron/:id`, aunque sea sólo en preview;
- o autorización explícita para editar `alpha-db-v2` en el navegador y devolverlo
  después, asumiendo el riesgo de que la cola de `src/data/nube/` suba el cambio.

## Causa

El coste está en `Motor.subir()` (`src/features/entrenar/visor/motor.ts:182-221`)
y lo dispara `VisorPatron.tsx:264`, que llama a `motor.subir(partes)` desde
`construir()`, y `construir()` corre dentro del `requestAnimationFrame` de
`VisorPatron.tsx:308-320` **en cada fotograma** mientras el patrón se reproduce o
la cámara gira.

`subir()` reconstruye la escena entera en seis arrays de JavaScript corrientes:

```ts
pos.push(...m.posicion)                                                   // motor.ts:192
for (const i of m.indice) idx.push(i + base)                              // motor.ts:197
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(datos), gl.DYNAMIC_DRAW)  // motor.ts:202
```

Los `push(...)` sobre `Float32Array` y el `new Float32Array(array)` posterior son
el gasto: se construye un array de números en el montón y luego se copia a un
array tipado, cada fotograma, para volver a subir bytes que en su mayoría no han
cambiado. De las siete mallas del fotograma, **cinco no cambian nunca** —bahía,
sala, trípode, huesos y guías están cacheadas por `VisorPatron.tsx:54-98`— y aun
así vuelven a serializarse enteras 60 veces por segundo.

Y esto es lo que decide el veredicto sobre el PR: **`motor.ts` no está tocado por
el PR #183**. El coste ya está en `origin/main`. Lo que el PR añade son la sala y
el trípode, y su tamaño medido es **947 vértices** sobre 30 752, un **+3,1 %** de
vértices y un **+2,4 %** de floats subidos. No es el 10 % que se estimó a ojo, y
como se ve abajo ni siquiera se distingue del ruido del banco.

Hay además un límite duro que hoy no se cruza pero conviene tener escrito. En
este Chrome, `array.push(...tipado)` lanza `RangeError: Maximum call stack size
exceeded` a partir de **124 056 elementos** (medido por búsqueda binaria en la
propia pestaña). La malla más grande de hoy es la de músculos: 14 488 vértices →
43 464 floats. El margen es de **×2,85**. Una malla 2,85 veces mayor no haría el
visor más lento: lo haría **reventar**, y desde `subir()`, que corre dentro de un
`requestAnimationFrame` sin `try/catch`. Eso sí se parecería a «el navegador se
congela».

## Evidencia numérica

**A. Tamaño real de la escena.** Script temporal en `.tmp-medicion/medir.ts` (ya
borrado), ejecutado con
`node node_modules/vite-node/vite-node.mjs .tmp-medicion/medir.ts`. Importa el
`Motor` de verdad, le inyecta un `gl` de mentira que sólo cuenta bytes, y
construye las mallas con el código de dominio real (patrón `sentadilla`,
`esqueletoEnFase`, `construirMusculos`, `construirLaboratorio`, `construirSala`,
`construirTripode`, `guias`):

| malla | vértices |
|---|---|
| bahía (`construirLaboratorio`) | 1 574 |
| plomada (`lineaDePeso`) | 410 |
| sala (`construirSala`) — sólo en el PR | 859 |
| trípode (`construirTripode`) — sólo en el PR | 88 |
| huesos (`construirHuesos`) | 13 774 |
| músculos (`construirMusculos`) | 14 488 |
| guías (`guias`) | 506 |
| **total con sala y trípode** | **31 699** |
| total sin ellos (lo que hay en `origin/main`) | 30 752 |

Por llamada a `subir()`: **348 689 floats** de atributos + **171 396 índices** =
**520 085** elementos escritos en arrays de JavaScript y copiados a arrays
tipados. A 60 Hz son 31,2 millones de elementos por segundo.

**B. Coste por llamada, en Node** (mismo script, media de 200 llamadas, cuatro
corridas):

| | corrida 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| `subir()` sin sala ni trípode | 17,65 ms | 15,45 ms | 15,32 ms | 15,58 ms |
| `subir()` con sala y trípode | 15,45 ms | 15,29 ms | 17,47 ms | 15,68 ms |
| construir las mallas del fotograma | 1,79 ms | 1,67 ms | 1,66 ms | 1,68 ms |

Las dos filas de arriba **se solapan y cambian de signo entre corridas**: el
aporte del PR no se distingue del ruido del banco. El coste que sí se ve es el de
`subir()` a secas, ~15,5 ms, con las mallas ya construidas y **sin GPU ninguna**.
Sumado a los ~1,7 ms de construir, el techo aritmético sale en **~57 fps antes de
dibujar un solo triángulo**.

**C. Coste por llamada, en Chrome, con WebGL de verdad.** Ejecutado en la pestaña
de producción con `javascript_tool`, replicando el cuerpo exacto de `subir()`
(los mismos `push(...)`, los mismos `new Float32Array`, los mismos seis
`gl.bufferData`) sobre mallas de los tamaños medidos en A, con un canvas de
1 112 × 929 y contexto `webgl` real. 40 llamadas tras calentamiento:

| | mín | mediana | máx |
|---|---|---|---|
| `subir()` tal como está hoy | 9,2 ms | **9,9 ms** | 24,1 ms |

Mediana de 9,9 ms → techo de **101 fps** para la subida sola, en una RX 6600 de
sobremesa. Un fotograma de 60 Hz dura 16,7 ms: `subir()` se come el **59 %** de
él y todavía no ha dibujado. La cola —24,1 ms de máximo— ya pierde fotogramas
sola.

Aviso sobre qué es esto exactamente: el banco es una **réplica** del cuerpo de
`subir()` escrita a mano, no el `subir()` compilado del bundle, porque `Motor` no
se exporta desde el chunk desplegado y la CSP (`script-src 'self'`, sin
`unsafe-eval`) impide reinyectar el módulo. Los tamaños de malla sí son los
reales, medidos en A con el código de dominio de este repositorio.

**D. Fotogramas por segundo reales, pestaña VISIBLE, bucle
`requestAnimationFrame`** (se comprobó `document.visibilityState === "visible"`
en la misma llamada que devolvió cada número; con la pestaña oculta el reloj de
animación se congela y el número que sale es falso):

| | producción | preview |
|---|---|---|
| bucle vacío | 145,8 fps | 146,3 fps |
| bucle con `subir()` en cada fotograma | **96,3 fps** | — |

Y el A/B de la geometría del PR, en la preview, tres repeticiones alternando el
orden para que el calentamiento no favorezca a ninguno:

| repetición | orden | sin sala ni trípode (main) | con sala y trípode (PR) |
|---|---|---|---|
| 1 | A, B | 95,2 fps | 91,7 fps |
| 2 | B, A | 92,6 fps | 97,6 fps |
| 3 | A, B | 93,9 fps | 101,4 fps |

**El signo se invierte dos veces de tres.** En dos de las tres repeticiones la
versión con MÁS geometría va MÁS rápido. La banda de ruido de este banco es de
unos ±10 fps sobre ~95, es decir ~10 %, y el efecto que se busca es del 2,4 %:
no cabe. Conclusión medida, no opinada: **la sala y el trípode del PR #183 no son
la causa de nada**.

**E. Lo que costaría el arreglo.** Segundo script temporal,
`.tmp-medicion/comparar.ts` (borrado también), que compara `subir()` tal como
está contra una versión que preasigna los arrays tipados una vez y los rellena
con `.set()` —sin arrays de números intermedios ni `push(...)`—, con los mismos
tamaños:

| | Node (mediana de 101) | Chrome (mediana de 41) |
|---|---|---|
| como está hoy | 14,15 ms | 9,8 ms |
| preasignando y `.set()` | **0,52 ms** | **0,7 ms** |
| factor | ×27 | ×14 |

En Chrome el número de «preasignando» incluye la subida a la GPU de verdad, que
es la parte irreducible. Los 9,1 ms que sobran son puro JavaScript.

**F. El límite duro.** Búsqueda binaria en la pestaña sobre
`[].push(...new Float32Array(n))`:

- umbral: **124 056** elementos → `RangeError: Maximum call stack size exceeded`
- mayor `push(...)` de hoy: 43 464 floats (malla de músculos)
- margen: **×2,85**

**Lo que no se midió y por qué.** No hay ninguna medida del visor renderizando de
verdad, ni en producción ni en la preview, porque el botón que lo abre no existe
mientras las cuatro sesiones estén cerradas (sección 1). No hay ninguna medida en
un móvil: todos los números de arriba salen de una máquina de sobremesa con una
RX 6600, y el visor está pensado para el teléfono del asesorado —lo dice
`motor.ts:323`, «es donde el asesorado lo va a abrir de verdad»—. Un teléfono de
gama media va entre 4 y 8 veces más lento en JavaScript de un hilo; con 9,9 ms
aquí, allí serían entre 40 y 79 ms por fotograma, o sea entre 13 y 25 fps. Eso es
aritmética sobre un factor supuesto, **no una medida**, y no debe citarse como si
lo fuera.

## Decisión que pide a Bryan

**1. Desatascar el PR #183 sin tocar `motor.ts`.** El congelado que reporta su
autor no se le puede atribuir: `motor.ts` no está en su diff, y su geometría
—947 vértices, +2,4 % de floats— no se distingue del ruido en tres repeticiones
medidas. Bloquear el PR por rendimiento sería castigar al mensajero. *Pide de
Bryan:* que acepte que el PR se juzgue por lo que cambia, y no por un síntoma que
ya estaba en `origin/main`.

**2. Arreglar `subir()` en su propio PR, contra `main`.** Preasignar los arrays
tipados y rellenar con `.set()`: medido, 9,8 ms → 0,7 ms en Chrome y 14,15 →
0,52 ms en Node. Es el cambio con mejor relación coste/efecto de todo lo que hay
sobre la mesa, y de paso aleja el `RangeError` de las 124 056 posiciones. Es un
fichero, ~20 líneas, sin cambio de contrato. *Pide de Bryan:* decidir si va antes
o después del #183. Mi recomendación es **antes y aparte**, porque así el #183 se
mide contra un motor sano. Ojo: `motor.ts` y `malla.ts` me están prohibidos en
escritura, así que este cambio necesita otra mano.

**3. Un segundo paso, si el primero no basta en móvil: no volver a subir lo que
no ha cambiado.** Cinco de las siete mallas del fotograma son fijas y ya están
cacheadas; sólo músculos y guías cambian. Partir el búfer en «fijo» y «vivo»
quitaría ~17 000 de los 31 699 vértices del trabajo por fotograma. *Pide de
Bryan:* si autoriza ese rediseño, que es más grande y sí toca el contrato de
`subir()`.

**4. Y lo que necesito de verdad: una puerta al visor.** Ninguna de las tres
decisiones anteriores está confirmada en el visor real, porque no se pudo abrir.
*Pide de Bryan:* una de estas dos, la que le parezca menos invasiva —dejar una
sesión del microciclo de pruebas sin cerrar, o una ruta de preview que monte
`EstudioDelPatron` directamente—. Con cualquiera de las dos, la medida que falta
sale en diez minutos, y entonces sí se podrá decir si el navegador se congela o
no.
