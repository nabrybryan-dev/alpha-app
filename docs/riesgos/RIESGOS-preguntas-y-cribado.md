# Dónde se rompe esto con gente real dentro · la pregunta (T3) y el cribado (T4)

Abogado del diablo sobre lo que se está construyendo ahora mismo: `T3 · la pregunta llega a
la app` y `T4 · el cribado vive en la base` (`cerebro-alpha-agentes/pruebas/CONTRATOS.md`).
Esto no busca bugs de código —eso es de PRUEBAS—: busca lo que le pasa a una persona real
con un teléfono real y una señal real.

> **AL SUBIRLO AL REPOSITORIO (2026-09-10).** Este análisis se escribió el 7-sep y vivió
> tres días **solo en el disco de una máquina**, citado por el README de la cinta y sin que
> nadie más pudiera leerlo. Se sube tal cual, sin retocar una línea: lo que decía entonces
> es lo que decía.
>
> Lo que ha cambiado desde entonces, para que nadie lo lea como si siguiera todo abierto:
>
> - **El riesgo 1 está cerrado por la mitad que se veía.** El formulario ya no se retira a
>   media pregunta cuando llega la ficha del coach: se queda y dice «esto ya estaba
>   contestado». Lo que sigue abierto es el fondo, y es una decisión, no un arreglo:
>   **qué gana cuando la respuesta nueva de la persona choca con la ficha que ya había**.
>   Hoy gana la que está arriba, y si alguien contesta justo porque empezó una medicación,
>   la buena es la suya.
> - La capa de interfaz que aquí «todavía no existe en el árbol» ya existe, y de su
>   revisión salieron cinco fallos más, arreglados el 10-sep: respuestas que se quedaban
>   pegadas de un cuestionario al siguiente, una pregunta imposible de contestar que
>   escondía todas las demás, el detalle de salud viajando con el nombre equivocado, el
>   formulario esfumándose, y un aviso que dependía del día de la semana.

## Qué he mirado y qué no

Leído entero, en el árbol `C:\Users\ASUS\dev\alpha-app-datos` **el 2026-09-07**:
`supabase/migrations/0058_cribado.sql`, `0001`, `0008`, `0019`, `0049`,
`supabase/comprobar-migraciones.sql` (bloque 0058), `src/data/nube/hidratar.ts`,
`sync.ts`, `cola.ts`, `procesador.ts`, `fusion.ts`, `firma.ts`, `src/data/mockDb.ts`,
`src/data/repos.ts`, `src/domain/types.ts`, `src/app/SessionProvider.tsx`,
`src/features/hoy/HoyPage.tsx`, `AvisoSinSincronizar.tsx`,
`src/features/cuestionarios/*`, y del lado del cerebro `agentes/cribado.py` e
`INVARIANTES.md` (I-23).

**Lo que NO he hecho, y hay que decirlo:** no he abierto la app en un navegador ni en un
teléfono, no he ejecutado una sola consulta contra Supabase, y no he corrido `npm run
verify`. Todo lo que sigue sale de leer el árbol. Cada apartado trae **cómo se
comprobaría**, que es justo la parte que aquí no se ha hecho: sin eso un riesgo es una
opinión.

**El árbol se mueve mientras se lee.** La capa de datos está trabajando en este mismo
worktree: `sync.ts` no tenía bloque de cribado en mi primera lectura y sí lo tenía media
hora después. Todo lo que digo del código nuevo va fechado hoy y hay que releerlo antes de
actuar. La capa de interfaz (`CribadoForm.tsx`, `necesitaCribado.ts`, `TarjetaPregunta.tsx`,
`preguntasDeLaCadena.ts`) **todavía no existe en el árbol**, así que lo que digo de ella son
riesgos de diseño con su comprobación, no hallazgos.

**Este archivo no es de nadie más.** Está fuera de `src/` y de `supabase/`, y no debe
entrar en el PR de T3 ni en el de T4: su aceptación exige que toquen exactamente sus
ficheros.

---

## Resumen, por gravedad

| # | Riesgo | Gravedad | ¿Ya roto hoy? | Dueño |
|---|---|---|---|---|
| 1 | El cribado que la app da por contestado y la base no tiene | CRÍTICO | Nuevo (T4) | SERVIDOR Y DATOS |
| 2 | Un cambio solo de cribado es invisible para todos los teléfonos | CRÍTICO | Nuevo (T4) | SERVIDOR Y DATOS |
| 3 | «Sí, tengo dolor en el pecho» tres días tarde no tiene por dónde entrar | CRÍTICO | Nuevo (T4) | Decisión de Bryan + INTERFAZ |
| 4 | Media ficha que se lee como ficha: `fuente='wiki'` admite las doce en nulo | ALTO | Nuevo (T4/T16) | SERVIDOR Y DATOS + INTERFAZ |
| 5 | La respuesta llega después de que la cadena tirara del supuesto | ALTO | Nuevo (T3) | contratos + SERVIDOR Y DATOS |
| 6 | Bloquear Hoy hasta contestar, con Supabase caído o sin señal | ALTO | Nuevo (T4) | Decisión de Bryan + INTERFAZ |
| 7 | El expediente clínico de la cartera entera, en el navegador del coach | ALTO | Nuevo (T4) | Decisión de Bryan + SERVIDOR Y DATOS |
| 8 | Diez de doce en el vestuario: no queda nada | ALTO | **Ya roto** | INTERFAZ |
| 9 | Una respuesta no se corrige, se duplica; y el reintento la rechaza | ALTO | **Ya roto** | SERVIDOR Y DATOS |
| 10 | Una columna mal escrita en el `select` deja el cribado invisible sin un error | ALTO | **Ya roto** (patrón) | SERVIDOR Y DATOS + PRUEBAS |
| 11 | Una operación atascada congela TODA la descarga de ese teléfono | MEDIO-ALTO | **Ya roto** | SERVIDOR Y DATOS |
| 12 | Dos ramas, un `0058`, y ningún registro de versiones | MEDIO-ALTO | **Ya roto** | SERVIDOR Y DATOS + el coach |
| 13 | La pregunta que nadie contesta no caduca y nadie ve el reloj | MEDIO | Nuevo (T3) | Decisión de Bryan + contratos |
| 14 | El que no puede contestar: seis que no abren la app | MEDIO | Nuevo (T4) | Decisión de Bryan |
| 15 | Borrar mal: el login que sobrevive y la respuesta que se va en cascada | MEDIO | **Ya roto** | el coach + SERVIDOR Y DATOS |
| 16 | Una pregunta clínica que da 15 XP | BAJO | Nuevo (T3) | Decisión de Bryan + INTERFAZ |

---

## 1 · El cribado que la app da por contestado y la base no tiene

**Gravedad: CRÍTICO.** Es la única combinación de esta lista en la que la pantalla afirma
lo contrario de lo que hay en la base **sobre un dato de seguridad**, sin un error a la
vista, y encima con un aviso que tranquiliza. Todo lo demás de aquí abajo o se ve, o no
decide sobre la salud de nadie.

### Qué pasa

La persona rellena las doce preguntas, pulsa enviar, la pantalla dice que ya está y deja de
pedírselo. En la base no hay nada suyo, o hay una fila distinta. La cadena lee la base, no
la pantalla: programa sin cribado, o con el cribado a medias que ya había.

### En qué condición exacta

Basta que **exista fila en el servidor y no en la instantánea de ese teléfono**. Y eso pasa
sin nada raro:

1. La persona abre la app a las 10:00 (se hidrata: todavía no tiene fila de cribado).
2. El coach vuelca su expediente de la wiki a las 10:05 —`insert into cribado (…) values
   (…, 'wiki')`, que es exactamente lo que T16 va a hacer con las ocho fichas en prosa—.
3. La persona rellena el formulario a las 10:10 sin haber vuelto a hidratar. Para un
   asesorado la hidratación **solo** ocurre en un `SIGNED_IN` (el refoco de la app), y el
   refresco cada 45 s es solo del staff (`SessionProvider.tsx:171-174`).
4. `sync.ts:519-556` encola un `upsert`. PostgREST lo traduce a `insert … on conflict do
   update`. La clave primaria es `usuario_id` (`0058_cribado.sql:69`), así que choca.
5. La rama de `update` exige una política de UPDATE que aplique a esa sesión. La única que
   hay es `cribado_lo_cambia_el_coach` (`0058:134-137`), y el asesorado no es coach: la
   escritura se rechaza (`42501`).
6. `procesador.ts:79-86`: ocho intentos y a descartes, en silencio.
7. `AvisoSinSincronizar.tsx:38-46` acaba diciéndole: *«Lo que anotaste sigue guardado en tu
   teléfono, no se perdió»*. Es verdad y es inútil: esa operación no va a subir nunca, y el
   botón «Intentar de nuevo» la reencola dos veces más (`cola.ts:65`, `MAX_RESCATES = 2`)
   para volver a fallar.

Y la variante que no necesita al coach: la misma persona contesta en el móvil y en la
tablet. La segunda choca contra la fila de la primera y termina igual.

### A quién le duele

A quien contestó —cree que ya lo hizo— y al coach, que ve una fila `wiki` a medias y no
sabe que hay una respuesta completa encerrada en un teléfono. Y a la cadena, que decide con
la fila vieja.

### Cómo se comprueba

- En la base, las filas que pueden provocar el choque:
  `select usuario_id, fuente, fecha, actualizado_en from public.cribado order by fuente;`
- En el teléfono (consola del navegador, con la sesión de esa persona):
  `JSON.parse(localStorage.getItem('alpha-cola-descartes') ?? '[]').filter(o => o.tabla === 'cribado')`
  → una operación ahí con `intentos: 8` es este fallo, ya ocurrido.
- Reproducción limpia sobre un usuario de prueba: `insert` de una fila `wiki`, y desde la
  sesión de esa persona `supabase.from('cribado').upsert({usuario_id: <suyo>, fuente:'app', …})`
  → debe devolver `42501`. Si devuelve `201`, entonces el problema es el opuesto y peor: el
  asesorado puede reescribir su propia puerta clínica.

### Mitigación accionable

Que la escritura del asesorado sea un **insert que no pisa** (`insert` a secas, o
`upsert` con `ignoreDuplicates`), y que el rechazo por fila ya existente **no se reintente
ocho veces**: se distingue de un fallo de red y se resuelve enseñando en pantalla «esto ya
estaba contestado, tu coach lo tiene» y rehidratando. Dueño: **SERVIDOR Y DATOS**.

---

## 2 · Un cambio solo de cribado es invisible para todos los teléfonos

**Gravedad: CRÍTICO.** No pierde datos, pero deja el dato bueno **sin llegar a donde se
usa**, y además es el motor del riesgo 1: si el teléfono se enterara de la fila del
servidor, no habría choque. Y castiga justo a quien menos usa la app.

### Qué pasa

El coach carga los cribados desde los expedientes. En el teléfono de esa gente no cambia
nada: la app les sigue pidiendo el cribado. Y al revés: el coach corrige una respuesta y la
corrección no llega ni al teléfono de la persona ni a la segunda pestaña del propio coach.

### En qué condición exacta

`hidratarDesdeNube` se salta la descarga entera cuando la firma del servidor no ha cambiado
(`hidratar.ts:271-277`: si `sinCambios(...)` es cierto, `return` **antes de construir el
snapshot**). La firma la calcula `public.firma_de_sincronizacion()`, que es una lista de
`union all` escrita a mano (`0049_firma_de_sincronizacion.sql:163-212`).

- `cribado` **no está en esa lista**: la 0058 no la modifica. Un cambio que solo toque
  `cribado` deja la firma idéntica → nadie vuelve a descargar.
- `cribado` **tampoco tiene el trigger** `trg_actualizado_en` (0049:73-135 lo pone en 21
  tablas; la 0058 no lo añade a la suya). Así que aunque mañana se meta en la lista, un
  `update` del coach no movería `actualizado_en` ni el conteo: la firma seguiría diciendo
  «no cambió» sobre un dato que sí cambió. Es literalmente el fallo que la cabecera de la
  0049 dice que la 0049 existe para no cometer (líneas 25-36).

Quien tiene otras tablas moviéndose (mensajes, check-ins, series) se salva por accidente:
cualquier otro cambio fuerza la descarga completa y el cribado viene de paquete. **Quien no
usa la app no tiene ese accidente**, y son exactamente las personas cuyo cribado hay que
volcar desde la wiki.

### A quién le duele

A los que llevan meses sin abrir la app —el encargo cita seis de veintitrés sin un check-in
en su vida—, al coach que cree haber cargado algo que no se ve, y a la propia cadena
cuando lea `cribado_fuente` en un dispositivo desactualizado.

### Cómo se comprueba

- `select * from public.firma_de_sincronizacion() where tabla = 'cribado';` → **hoy
  devuelve 0 filas**. Debe devolver una.
- `select count(*) from pg_trigger t join pg_class c on c.oid = t.tgrelid
   where t.tgname = 'trg_actualizado_en' and c.relname = 'cribado' and not t.tgisinternal;`
  → hoy 0. Debe ser 1.
- De punta a punta: con una sesión de asesorado abierta y quieta, insertar su fila de
  cribado desde el SQL Editor y **no tocar ninguna otra tabla**; volver a la app (refoco,
  que dispara `SIGNED_IN`) y mirar si `JSON.parse(localStorage['alpha-db-v2']).cribados`
  la trae. Hoy la predicción es que no.

### Mitigación accionable

Tres líneas en la 0058: la fila `cribado` en el `union all` de la firma, el trigger
`trg_actualizado_en`, y la entrada `cribados: ['cribado']` en `FUENTES` de
`src/data/nube/firma.ts` (hoy no está, y por eso el campo nunca se conserva —que es el lado
seguro— pero tampoco se sabe cuándo cambió). Dueño: **SERVIDOR Y DATOS**.

---

## 3 · «Sí, tengo dolor en el pecho» tres días tarde no tiene por dónde entrar

**Gravedad: CRÍTICO.** Porque el caso que la puerta clínica existe para atrapar es
precisamente el síntoma **nuevo**, y hoy el diseño solo sabe recibir el síntoma viejo.

### Qué pasa

La persona contestó el cribado el lunes y le cargaron el plan. El jueves nota dolor
torácico al subir escaleras. Abre la app. **No hay dónde decirlo.** El formulario ya no se
le muestra, y si volviera a enviarlo no pasaría nada: `mockDb.ts:810-821` ignora en
silencio el segundo envío («si ya hay fila, se deja la que está») y `sync.ts:525-527` ni
siquiera encola (`if (antes) return`). El microciclo vivo sigue vivo. La cadena, la próxima
vez que corra, leerá el cribado del lunes.

### En qué condición exacta

Siempre que el cambio sea posterior a la primera respuesta. La 0058 lo decide a propósito
(su cabecera, líneas 44-54: *«se lo dice al coach y el coach lo actualiza»*), y la decisión
de que el asesorado no reescriba su propia puerta es **correcta**. Lo que falta no es el
permiso: es el camino. Hoy «se lo dice al coach» significa escribirle por el chat y confiar
en que lo lea, y nada en la app le sugiere hacerlo.

Y hay un agravante de tiempo: aunque el coach lo actualice el mismo día, por el riesgo 2 esa
actualización puede no llegar a ningún dispositivo, y **nada** conecta un cambio de cribado
con el microciclo que ya está cargado. No existe una señal de «este plan se decidió con un
cribado que ya no es el vigente».

### A quién le duele

A la persona con el síntoma nuevo, que es el único caso en el que este dato salva algo.

### Cómo se comprueba

- En modo demo, dos veces seguidas: `db.cribado.contestar(x)` y `db.cribado.contestar(y)`
  con el mismo `usuarioId` → `db.cribado.byUsuario(id)` sigue devolviendo `x`, y
  `JSON.parse(localStorage['alpha-cola-sync'])` tiene **una** operación, no dos.
- En la base, la pregunta que hoy no se puede responder:
  `select c.usuario_id, c.actualizado_en, m.datos->>'numero'
     from cribado c join microciclos m on m.usuario_id = c.usuario_id
    where m.estado = 'activo' and c.actualizado_en > m.creado_en;`
  → cada fila es un plan vivo decidido con un cribado que después cambió. Hoy nadie mira
  eso.

### Mitigación accionable

Es **decisión de Bryan antes que código**: qué pasa con el microciclo vivo cuando el cribado
cambia a peor (¿se para, se marca para revisión, se avisa al coach y ya?). Con la decisión
tomada, lo mínimo en la app es un camino explícito —«algo ha cambiado en mi salud»— que
mande un mensaje al coach y deje marca; y en la base, una comprobación como la de arriba en
el barrido posterior a cada carga. Dueños: **Bryan** para la regla, **INTERFAZ** para el
camino.

---

## 4 · Media ficha que se lee como ficha

**Gravedad: ALTO.** La media ficha es peor que ninguna, y aquí la base la permite por
diseño para las filas que no vienen de la app.

### Qué pasa

Existe una fila de cribado de una persona con las doce respuestas en nulo. La app ve fila y
deja de preguntar. La cadena ve fila y declara `cribado_fuente: "base"`. Nadie ha
contestado nada.

### En qué condición exacta

`cribado_de_la_app_esta_completo` (`0058:103-112`) exige las doce **solo si
`fuente = 'app'`**. Esto es correcto y está bien razonado —una ficha de la wiki puede no
traer un dato—, pero deja legal esto:

```sql
insert into public.cribado (usuario_id, fuente) values ('…', 'wiki');
```

Una fila con doce nulos. A partir de ahí:

- Si `necesitaCribado.ts` (que aún no existe) se implementa como «¿hay fila?», esa persona
  no vuelve a ver el formulario nunca.
- Si el volcado de T16 traduce un hueco de la wiki a `'ausente'` en vez de dejarlo nulo,
  se inventa un cribado: `ausente` significa «se le preguntó y no tiene». La 0058 y
  `hidratar.ts:79-96` protegen esto en su lado (`campoCribado` deja la clave sin poner
  cuando el valor no es uno de los tres), pero **quien escriba el volcado puede saltárselo
  desde el SQL Editor**, y nada lo comprueba.
- I-23 dice que `verde` exige los nueve presentes y que faltando cualquiera la zona es
  amarilla; I-36 (T2) dice que con `cribado_fuente: "base"` los nueve van en
  `presente`/`ausente` y ninguno en `no_declarado`. Una fila de nulos rompe la segunda por
  el lado silencioso: el que la vuelca decide qué hacer con el hueco.

### A quién le duele

A quien tiene el cuadro clínico y no se le preguntó: su ficha vacía se lee como ficha
hecha.

### Cómo se comprueba

- `select usuario_id, fuente from public.cribado
    where fuente <> 'app' and (diagnostico is null or quien_lo_lleva is null
      or tratamiento_activo is null or medicacion_cronica is null
      or autorizacion_sanitaria is null or restricciones_explicitas is null
      or sintomas_con_esfuerzo is null or nivel_funcional is null
      or que_le_han_dicho_que_no_haga is null or parq_enfermedad_cardiaca is null
      or parq_medicamento_presion is null or parq_huesos_articulaciones is null);`
  Hoy debe dar 0 filas porque la tabla está vacía. **El día del volcado, esta consulta es
  la que dice cuántas medias fichas hay**, y ese número no puede quedarse sin mirar.
- Del lado de la app: que `necesitaCribado` devuelva `true` para una fila con cualquiera
  de los doce sin valor, no solo cuando no hay fila.

### Mitigación accionable

`necesitaCribado` cuenta campos, no filas. Y el volcado de T16 escribe nulo donde la wiki
no dice nada, jamás `'ausente'`, con la consulta de arriba como comprobación posterior
obligatoria. Dueños: **INTERFAZ** (`necesitaCribado`) y **SERVIDOR Y DATOS** (el volcado).

---

## 5 · La respuesta llega después de que la cadena tirara del supuesto

**Gravedad: ALTO.** Es el caso «dos a la vez» del encargo, y hoy no hay ni empate: la
respuesta de la persona sencillamente no participa.

### Qué pasa

La cadena para y pregunta. La persona contesta en el móvil a las 10:00. A las 10:05 la
cadena se reanuda con `que_pasa_si_no_contesta: "seguir_con_supuesto"` y programa con el
supuesto. Nadie mira si ya había respuesta. La persona ve su respuesta enviada y un plan que
la contradice; el fichero del dictamen dice que nadie contestó.

### En qué condición exacta

Nada une las dos mitades. T3 escribe la respuesta en la tabla `respuestas` por
`db.cuestionarios.responder` (`sync.ts:669-687`) y añade `origen` y `ref` al objeto
`Cuestionario` (que viaja dentro de `cuestionarios.datos`, jsonb). La cadena, en cambio,
vive en ficheros: `pregunta-*.json` con su `fecha`, y el dictamen con `pregunta_ref`. **No
hay ninguna lectura de `respuestas` en el contrato de T1 ni de T3**, y `preguntasDeLaCadena.ts`
—que aún no existe— está descrito como el camino de ida (pintar la pregunta), no el de
vuelta.

El orden que lo provoca es el normal: la cadena se corre cuando el coach la corre, y la
persona contesta cuando abre el móvil. No hace falta ninguna carrera fina.

### A quién le duele

A la persona, que contestó para nada; y a la confianza en la cadena, que es lo que hace que
alguien vuelva a contestar la próxima vez.

### Cómo se comprueba

- `select r.usuario_id, r.cuestionario_id, r.fecha_iso, r.valores
     from public.respuestas r
    where r.cuestionario_id = '<el ref de la pregunta>';`
  y comparar `fecha_iso` con la fecha del fichero de la prescripción cargada. Si la
  respuesta es anterior y el dictamen dice que se usó el supuesto, ha ocurrido.
- La forma de que deje de poder ocurrir: que el dictamen guarde **qué respuesta leyó** (id y
  `fecha_iso`, o «ninguna a fecha X») y que `verificar-cadena.py` rechace una prescripción
  basada en un supuesto cuando existe una respuesta anterior a ella.

### Mitigación accionable

Un campo en el contrato —«respuesta leída, o ninguna a esta hora»— y una costura que lo
compruebe. Sin eso, «quién gana» no tiene respuesta: es que ni siquiera compiten. Dueños:
**contratos** (el campo y la costura) y **SERVIDOR Y DATOS** (que `preguntasDeLaCadena.ts`
sepa leer la respuesta, no solo pintar la pregunta).

---

## 6 · Bloquear Hoy hasta contestar, con Supabase caído o sin señal

**Gravedad: ALTO.** Porque el precio del bloqueo lo paga la adherencia, que es el segundo
peldaño de la jerarquía del método, y lo paga en el peor momento: la persona ya está en el
gimnasio.

### Qué pasa

La persona llega al gimnasio, abre la app y se encuentra un formulario clínico de doce
preguntas que no puede saltar. Lo rellena, pulsa enviar y no pasa nada visible —o pasa, pero
la pantalla sigue bloqueada porque el estado se calcula sobre datos que no llegaron—. No
entrena.

### En qué condición exacta

Depende de cómo se escriba `necesitaCribado.ts`, que todavía no existe. Los tres modos de
fallo que ya están servidos por el código de alrededor:

1. **Sin red al entrar.** `SessionProvider.tsx:114-119` deja pasar el fallo de hidratación
   si ya hay datos locales de esa persona. Con la instantánea vieja, un `necesitaCribado`
   que solo mire local dirá «falta» aunque la fila esté arriba desde hace una semana.
2. **Escritura local que no persiste.** `mockDb.ts:76-98`: si el almacén está lleno,
   `guardar()` **no lanza**, marca sin espacio y sigue. La copia en memoria queda al día; al
   recargar, la respuesta ya no está y el bloqueo vuelve.
3. **El rol equivocado.** `HoyPage` la abren también el coach y la nutricionista
   (`HoyPage.tsx:300`). Si el bloqueo no filtra por `usuario.rol`, la pantalla del staff se
   queda pidiendo un PAR-Q.

### A quién le duele

A quien iba a entrenar; y al coach, que se entera por WhatsApp.

### Cómo se comprueba

- Con las herramientas del navegador en modo avión: entrar, rellenar, enviar, recargar.
  El bloqueo tiene que caer con la respuesta en cola, no esperando al servidor.
- Con el almacén lleno a propósito (escribir basura en `localStorage` hasta la cuota):
  enviar el cribado y recargar. Si vuelve el formulario, es el modo 2.
- Con una sesión de coach: abrir `/hoy`. No debe aparecer nada de cribado.

### Mitigación accionable

**Es decisión de Bryan antes que código:** ¿el cribado sin contestar impide entrenar, o solo
impide programar el siguiente microciclo? Las dos son defendibles y hoy no está escrita
ninguna. Si es bloqueo, tiene que ser bloqueo *de la carga del plan* (lado del coach), no de
la pantalla de un día que ya está prescrito. Dueños: **Bryan** para la regla, **INTERFAZ**
para que el estado se lea de local y filtre por rol.

---

## 7 · El expediente clínico de la cartera entera, en el navegador del coach

**Gravedad: ALTO.** Son datos de salud reales, sin cifrar, en un equipo que no es un
servidor, y con una sesión que por decisión de producto no caduca nunca.

### Qué pasa

`hidratarDesdeNube` pide `cribado` sin filtro (`hidratar.ts:445`) y deja que RLS decida.
Para el coach, `cribado_lee_lo_suyo` (`0058:122-124`) devuelve **todas** las filas, incluido
`detalle`, que es prosa libre con el nombre del medicamento y del diagnóstico
(`0058:93-97`). Todo eso se escribe tal cual en `localStorage` bajo `alpha-db-v2`
(`mockDb.ts:174-179`), y ahí se queda: la limpieza solo ocurre en `SIGNED_OUT`
(`SessionProvider.tsx:150-157`), y la sesión está diseñada para no expirar
(`SessionProvider.tsx:26-31`).

### En qué condición exacta

Siempre, desde la primera hidratación del coach después de aplicar la 0058. No hace falta
ningún fallo.

### A quién le duele

A las veinticinco personas de la cartera, y al negocio el día que ese portátil se preste,
se pierda o lo mire alguien por encima del hombro.

### Cómo se comprueba

- En el navegador del coach: `JSON.parse(localStorage.getItem('alpha-db-v2')).cribados.length`
  → el número de personas con cribado, y `…cribados[0].detalle` → la prosa clínica.
- Y la pregunta que va con ella: `select count(*) from public.cribado;` con la sesión de la
  nutricionista debe dar 0 o 1 (solo la suya), porque la política dice `es_coach()` y no
  `es_staff()`. **Eso también hay que decidirlo**: hoy la nutricionista queda ciega al
  cribado, y prescribe a gente con medicación crónica.

### Mitigación accionable

Dos decisiones de Bryan y un cambio pequeño: (a) si el coach necesita `detalle` de todos
en el móvil o le basta pedirlo al abrir la ficha de una persona; (b) si la nutricionista
debe ver los campos que la afectan (medicación, diagnóstico) por una vista recortada, como
ya se hizo con `checkins_nutricion` en la 0013/0039 —el patrón existe y funciona—. Dueños:
**Bryan** y **SERVIDOR Y DATOS**.

---

## 8 · Diez de doce en el vestuario: no queda nada

**Gravedad: ALTO. Ya roto hoy**, con los cuestionarios que ya existen; T4 lo hereda si el
formulario nuevo se escribe con la misma forma.

### Qué pasa

Rellena diez de doce, la llaman, cierra la hoja o el sistema mata la app en segundo plano.
Al volver: cero de doce. No queda media ficha —eso sería el riesgo 4—: no queda nada, y hay
que volver a teclear las diez.

### En qué condición exacta

`ResponderCuestionario.tsx:12` guarda todo en `useState`, sin persistir nada. El botón está
desactivado hasta tener las doce (`:81`, `disabled={respondidas < total}`), así que no hay
envío parcial posible. Y el contenedor es un `Sheet` que se cierra con
`onCerrar={() => setAbierto(undefined)}` (`CuestionariosPage.tsx:63`): al cerrarse, el
componente se desmonta y el estado se va. El repositorio **sí** tiene borradores para otras
cosas (`limpiarBorradoresLocales`, usado en el registro de series), pero aquí no se usan.

Que el botón exija las doce es correcto para el dato —«no» se marca, ausente no es «no»—.
El problema no es la exigencia: es que exigir las doce **y** no guardar nada por el camino
convierte una interrupción normal en trabajo perdido. En iOS, con la app en segundo plano,
la interrupción no es rara: es lo habitual.

### A quién le duele

A quien lo intenta en el vestuario, que es dónde va a pasar. Y al coach: la segunda vez no
lo rellena.

### Cómo se comprueba

Paso a paso, hoy mismo, sin base de datos: abrir `/cuestionarios`, abrir uno de doce
preguntas, contestar diez, cerrar la hoja con el gesto de cerrar, volver a abrirla. La
barra de progreso vuelve a «0 de N».

### Mitigación accionable

Borrador por respuesta en `localStorage`, con la misma pieza que ya usa el registro de
series, y que el borrador se limpie al enviar. Dueño: **INTERFAZ**.

---

## 9 · Una respuesta no se corrige, se duplica; y el reintento la rechaza

**Gravedad: ALTO. Ya roto hoy.** Es el mismo mecanismo del riesgo 1 en la tabla de al lado,
y con T3 pasa a llevar respuestas de la cadena, no solo cuestionarios del coach.

### Qué pasa

Dos cosas, y ninguna avisa:

1. **Se duplica.** `mockDb.ts:790-804` siempre añade una fila con
   `id: r-<cuestionario>-<usuario>-<Date.now()>`. Contestar dos veces el mismo cuestionario
   crea dos filas con ids distintos, que la cola no colapsa (`cola.ts:165-175` agrupa por
   `tabla:id`). `CuestionariosPage.tsx:19-20` da por contestado si existe **alguna**. Nadie
   define cuál manda, y la cadena tampoco: leerá la que le venga primero.
2. **El reintento se rechaza.** Si la petición se pierde después de que el servidor la
   escribiera (wifi de gimnasio: la fila entra, el acuse no vuelve), el reintento manda el
   mismo `id` → `on conflict do update` → y `respuestas` **no tiene política de UPDATE**
   (`0001_esquema.sql:194-197`: solo `select` e `insert`). Rechazo, ocho intentos, descarte.

### A quién le duele

A quien contestó y ve «✓ Enviado» sobre una respuesta que arriba está duplicada o
descartada; y a quien lea la tabla para decidir.

### Cómo se comprueba

- `select cuestionario_id, usuario_id, count(*) from public.respuestas
    group by 1, 2 having count(*) > 1;`
  → cada fila es una persona que contestó dos veces sin que nada lo notara.
- `select cmd, policyname from pg_policies where tablename = 'respuestas';`
  → hoy no aparece ninguna de `UPDATE`, que es lo que hace fallar el reintento.

### Mitigación accionable

Id determinista por (cuestionario, usuario) para que el reintento sea el mismo dato, y una
regla escrita de cuál manda cuando hay dos (la última, y que la app lo enseñe así). Dueño:
**SERVIDOR Y DATOS**.

---

## 10 · Una columna mal escrita en el `select` deja el cribado invisible sin un error

**Gravedad: ALTO.** Es un fallo conocido de esta casa —un `.select()` con columna falsa no
lo ve ni `tsc` ni la batería de tests— y aquí cae sobre diecisiete columnas escritas a mano.

### Qué pasa

La app deja de recibir cribados. No hay error en pantalla, no hay test rojo, y el
comportamiento es indistinguible de «nadie ha contestado todavía»: se conserva lo local
(`hidratar.ts:642-643`).

### En qué condición exacta

`hidratar.ts:445` nombra las diecisiete columnas en una sola cadena. Si una se escribe mal
—o si alguien renombra una columna en una migración posterior— PostgREST devuelve `42703`,
que **no** es `42P01` ni `PGRST205`, así que `esTablaInexistente` (`hidratar.ts:70-72`) dice
que no, no se apaga nada, y la rama de error conserva lo local para siempre.

El repositorio ya tiene la defensa para el caso equivalente y solo para él: la selección de
perfiles vive en `perfilEnNube.ts` y `perfilEnNube.test.ts` la compara contra la migración
(lo dice el comentario de `hidratar.ts:314-316`). El cribado no tiene ese amarre.

### A quién le duele

A todo el mundo a la vez, y en silencio; y al que lo diagnostique dentro de tres semanas.

### Cómo se comprueba

- Un test que lea `supabase/migrations/0058_cribado.sql`, saque los nombres de columna y los
  compare con la cadena del `select` —exactamente lo que hace `perfilEnNube.test.ts` con
  `perfiles`—.
- Y a mano, contra la base:
  `select count(*) from information_schema.columns where table_name = 'cribado';` → 17,
  que es lo que ya exige la aceptación de T4, cruzado con la cadena del `select`.

### Mitigación accionable

Sacar la selección a una constante junto a su comprobación, como se hizo con los perfiles.
Dueños: **SERVIDOR Y DATOS** (la constante) y **PRUEBAS** (el test que la ata a la
migración).

---

## 11 · Una operación atascada congela TODA la descarga de ese teléfono

**Gravedad: MEDIO-ALTO. Ya roto hoy**, pero el cribado le da un motivo nuevo y muy probable
para atascarse (riesgo 1).

### Qué pasa

Mientras haya algo sin subir, ese teléfono deja de bajar datos. El microciclo que el coach
acaba de cargar no llega; el mensaje del coach tampoco.

### En qué condición exacta

`SessionProvider.tsx:111`: en un refoco de alguien que ya estaba dentro, si la cola no está
vacía, se vuelve sin hidratar. Es una protección correcta —no pisar lo que aún no ha
subido— pero se apoya en que la cola siempre acabe vaciándose. Una operación que el
servidor **nunca** va a aceptar (la del riesgo 1) la mantiene ocupada ocho rondas, y el
procesador solo reintenta cada 30 s (`procesador.ts:140`) o al volver la conexión. Después
se descarta… y `rescatarDescartes` la devuelve a la cola en el siguiente inicio de sesión,
hasta dos veces más (`cola.ts:218-236`).

### A quién le duele

A la persona, que ve un plan viejo; y al coach, que dio por entregado lo que cargó.

### Cómo se comprueba

Sembrar a mano una operación imposible y observar: en la consola de la app,
`localStorage.setItem('alpha-cola-sync', JSON.stringify([{tabla:'cribado',tipo:'upsert',payload:{usuario_id:'00000000-0000-0000-0000-000000000000'}}]))`,
cambiar de pestaña y volver (dispara `SIGNED_IN`), y comprobar que
`JSON.parse(localStorage['alpha-db-v2']).firmaSync` no se mueve mientras esa operación siga
ahí.

### Mitigación accionable

Distinguir «no ha subido todavía» de «no va a subir nunca»: una operación rechazada por
permiso o por fila existente no debe seguir contando como trabajo en curso ni bloquear la
bajada. Dueño: **SERVIDOR Y DATOS**.

---

## 12 · Dos ramas, un `0058`, y ningún registro de versiones

**Gravedad: MEDIO-ALTO. Ya roto hoy** como práctica; el cribado sube la apuesta porque su
migración lleva las políticas que protegen datos de salud.

### Qué pasa

Dos sesiones distintas eligen el mismo número de migración, o una versión del `0058` se
aplica a mano en el SQL Editor y después el fichero cambia en el repo. La base y el
repositorio dicen cosas distintas y `comprobar-migraciones.sql` sigue diciendo `SI`, porque
comprueba señales (que exista el `check`, que exista una política de UPDATE), no el texto.

### En qué condición exacta

Está documentado en `CLAUDE.md` §3: *«dos ramas cogieron 0020 a la vez y una tuvo que
renumerarse después de estar aplicada»*, y *«se aplican a mano en el SQL Editor: no hay
registro de versiones»*. La carpeta de migraciones tiene además **dos huecos**: no existen
`0028` ni `0055`. Un hueco no prueba un accidente, pero sí prueba que el número no es una
garantía de nada.

Con dos worktrees vivos del mismo repo —hoy los hay— y la capa de datos y la de interfaz
tocando la misma pieza, el modo de fallo concreto es: la capa de datos aplica su `0058` a la
base, y el `0058_cribado.sql` que acaba en `main` es otro (una política corregida, un
`check` más). Nadie lo nota hasta que una política falta en producción.

### A quién le duele

A quien confía en que el repositorio describe la base. Y a los veinticinco, si lo que falta
es una política.

### Cómo se comprueba

- `select tablename, policyname, cmd, qual, with_check from pg_policies
    where tablename = 'cribado' order by cmd;`
  → tienen que salir exactamente las cinco de la 0058, y el `qual` de la de UPDATE **no
  puede** mencionar `uid()`. Esa segunda señal ya está escrita en
  `comprobar-migraciones.sql:1068-1078`; lo que falta es correrla **después** de aplicar y
  pegar la salida en el PR.
- `git log --oneline -- supabase/migrations/0058_cribado.sql` frente a la fecha en que se
  aplicó: si hay commits posteriores a la aplicación, hay divergencia.

### Mitigación accionable

Regla de una línea y sin código: **el `0058` se aplica una sola vez, y su salida de
`comprobar-migraciones.sql` se pega en el PR**. Si el fichero cambia después, se aplica como
`0059`. Dueños: **SERVIDOR Y DATOS** y **el coach**, que es quien pega el SQL.

---

## 13 · La pregunta que nadie contesta no caduca y nadie ve el reloj

**Gravedad: MEDIO.** No corrompe nada; deja a una persona parada sin que nadie lo sepa.

### Qué pasa

La cadena pregunta con `que_pasa_si_no_contesta: "esperar"`. La persona no abre la app. La
pregunta se queda ahí semanas, la tarjeta se sigue pintando igual el día 1 y el día 21, y el
plan de esa persona no avanza. Nadie ve la antigüedad.

### En qué condición exacta

El objeto `Cuestionario` (`types.ts:529-535`) tiene `id`, `titulo`, `descripcion`,
`preguntas` y `asignadoA`. No tiene fecha. T3 le añade `origen` y `ref`, y tampoco fecha. La
app calcula «sin contestar» como «asignado y sin fila en `respuestas`»
(`HoyPage.tsx:42-44`), que es una condición sin tiempo: verdadera para siempre. La fecha
existe, pero en el fichero `pregunta-*.json` del agente, que la app no lee.

El encargo cita cuatro derivaciones escritas sin enviar y una de tres semanas: es la misma
forma de fallo, y ya está ocurriendo en la parte de arriba de la tubería.

### A quién le duele

A quien espera un plan que no llega, y al coach, que no tiene una lista de «esto lleva
parado X días».

### Cómo se comprueba

`select c.id, c.datos->>'titulo', c.actualizado_en,
        (select count(*) from public.respuestas r where r.cuestionario_id = c.id) as respuestas
   from public.cuestionarios c
  where c.datos->>'origen' = 'cadena'
  order by c.actualizado_en;`
→ las filas con `respuestas = 0` y `actualizado_en` viejo son las paradas. Nota: mientras la
0058 no añada el trigger, `actualizado_en` de `cuestionarios` sí lo tiene (0049:47 y
0049:85-87), así que esta consulta sí funciona hoy.

### Mitigación accionable

**Decisión de Bryan primero**: cuántos días espera la cadena antes de tirar del supuesto, y
qué se le dice a la persona cuando eso ocurre. Después, la fecha viaja en el objeto y la
tarjeta la enseña («te lo preguntamos hace 12 días»). Dueños: **Bryan** y **contratos**.

---

## 14 · El que no puede contestar: seis que no abren la app

**Gravedad: MEDIO.** Es el caso que convierte cualquier compuerta en una pared.

### Qué pasa

Seis de veintitrés no han hecho un check-in en su vida. Para ellos, `fuente = 'app'` no va a
ocurrir: la única vía es que el coach meta la fila `wiki` o `encuesta`. Si además el cribado
bloquea algo, la primera vez que abran la app en meses se encontrarán doce preguntas
clínicas antes de nada, que es la peor bienvenida posible para alguien que ya estaba
desenganchado.

### En qué condición exacta

Siempre; no hace falta ningún fallo. Y se cruza con el riesgo 2: son exactamente las
personas cuyas otras tablas no se mueven, así que su firma no cambia y el cribado que el
coach les cargue puede no llegarles nunca a su teléfono (aunque para ellos eso importa poco,
porque no lo abren).

### A quién le duele

A ellos, y al coach, que necesita el cribado para poder programarles algo.

### Cómo se comprueba

`select u.id, u.nombre
   from public.usuarios_app u
   left join public.checkins c on c.usuario_id = u.id
   left join public.cribado k on k.usuario_id = u.id
  where u.rol = 'asesorado' and c.id is null and k.usuario_id is null;`
→ la lista de quién no puede contestar y no tiene ficha. Es la lista de trabajo del coach,
no una alarma del sistema.

### Mitigación accionable

Es **decisión de Bryan**: quién rellena el cribado de quien no usa la app, y si a esa gente
se le programa mientras tanto (la respuesta honesta hoy sería `no_evaluada`, que para la
cadena). No hay código que arregle esto. Dueño: **Bryan**, con el coach ejecutando.

---

## 15 · Borrar mal: el login que sobrevive y la respuesta que se va en cascada

**Gravedad: MEDIO. Ya roto hoy** en su primera mitad; la segunda la estrena T3.

### Qué pasa

Dos borrados parciales, en direcciones opuestas:

1. **Se borra la persona de `usuarios_app`** para darla de baja. La cascada se lleva su
   cribado, sus microciclos y sus respuestas… pero `usuarios_app.id` referencia
   `auth.users(id) on delete cascade` (`0001_esquema.sql:6`), y esa cascada va **de
   `auth.users` hacia abajo, no al revés**: el login sigue vivo. La persona entra, y como el
   trigger `al_crear_usuario` solo dispara al **insertar** en `auth.users`
   (`0001:31-34`), no se le recrea la fila: se queda en la pantalla «Tu cuenta existe pero
   no tiene perfil» (`SessionProvider.tsx:246-254`) con una sesión válida.
2. **Se borra o se rehace un cuestionario de la cadena.** `respuestas.cuestionario_id`
   referencia `cuestionarios(id) on delete cascade` (`0001:112`). Retirar una pregunta borra
   la respuesta que ya se había dado; y como el `id` es texto y lo elige quien la crea,
   volver a correr la cadena con el mismo `id` reescribe `datos` y deja la respuesta vieja
   colgando de un enunciado nuevo. La app no vería diferencia: sigue habiendo una fila en
   `respuestas` con ese `cuestionario_id`, así que la pregunta nueva sale como contestada.

### A quién le duele

A quien se dio de baja y sigue pudiendo entrar; y a quien contestó una pregunta que después
cambió de texto.

### Cómo se comprueba

- `select u.id, u.email from auth.users u
     left join public.usuarios_app a on a.id = u.id where a.id is null;`
  → cero filas. Cualquier fila es un login vivo sin perfil.
- `select r.cuestionario_id, r.fecha_iso, c.actualizado_en
     from public.respuestas r join public.cuestionarios c on c.id = r.cuestionario_id
    where c.actualizado_en > r.fecha_iso;`
  → cada fila es una respuesta que se dio a un enunciado anterior al actual.

### Mitigación accionable

Escribir el procedimiento de baja donde se ejecuta (se borra en `auth.users`, no en
`usuarios_app`), y que el `id` de un cuestionario de la cadena lleve dentro su fecha, para
que reescribir una pregunta cree una fila nueva en vez de mutar la vieja. Dueños: **el
coach** (el procedimiento) y **SERVIDOR Y DATOS** (el id).

---

## 16 · Una pregunta clínica que da 15 XP

**Gravedad: BAJO.** No rompe nada; empuja en la dirección equivocada un dato que no debe
tener prisa.

### Qué pasa

La pantalla de cuestionarios anuncia «+15 XP por cuestionario»
(`CuestionariosPage.tsx:28`, con `XP_POR_ACCION.respuesta = 15` en `gamification.ts:64`). Si
la pregunta de la cadena y —peor— el cribado entran por esa misma puerta, contestar deprisa
y cualquier cosa suma puntos y sube en el ranking. Un cribado no es una racha.

### En qué condición exacta

Si `TarjetaPregunta` escribe por `db.cuestionarios.responder` —que es lo que dice el
contrato de T3— la respuesta entra en la misma tabla que cuenta el XP.

### A quién le duele

A dos personas distintas, y de dos maneras que no se parecen en nada:

- **A quien contesta por los puntos.** El «no» y el «sí» pagan igual —los 15 XP son por
  cuestionario enviado, sin mirar el contenido— pero cuestan cosas muy distintas: un «sí»
  abre el campo `detalle` y obliga a escribir qué diagnóstico, qué medicamento, qué le
  dijeron que no hiciera (`0058:93-97`); doce «no» seguidos son doce toques y el nivel sube
  lo mismo. El camino barato es el que niega. Y ese «no» de conveniencia queda escrito con
  el mismo valor que un «no» verdadero: `ausente` significa «se le preguntó y no tiene», así
  que en la base las dos filas son idénticas y no hay forma de distinguirlas. Es la
  distinción que la 0058 se toma tres párrafos en defender —`ausente` no es nulo—, deshecha
  desde el otro lado: no por el hueco, sino por la respuesta apresurada.
- **Al coach y a la cadena, que leen esa fila como la más fiable de las tres fuentes.**
  `fuente = 'app'` es la única que significa «lo contestó la persona en primera persona»
  —frente a `wiki`, que es prosa copiada por otro— y encima es la única que la base obliga a
  traer completa (`cribado_de_la_app_esta_completo`). Si además es la única que da puntos,
  la fuente mejor considerada es justo la que tiene el incentivo dentro. Con I-23 en la mano
  eso se traduce en algo concreto: un `verde` con los nueve campos presentes, impecable para
  el validador, apoyado en doce respuestas dadas en veinte segundos camino del vestuario.

Y le duele a una tercera cosa que no es una persona: **a la medida**. El día que alguien
cuente cuántos cribados salieron negativos, no habrá manera de separar los negativos de
verdad de los negativos rápidos, porque no se guarda cuánto se tardó en contestar ni si se
volvió atrás. La cifra saldrá tranquilizadora y no se podrá auditar.

### Cómo se comprueba

En modo demo, mirar el nivel antes y después de responder una pregunta de la cadena, o leer
`useGamificacion` y comprobar si cuenta esa fila.

### Mitigación accionable

Decisión de Bryan: el cribado y la pregunta clínica no puntúan, o puntúan aparte. Si
puntúan, que sea por contestar bien y a tiempo, no por contestar. Dueños: **Bryan** y
**INTERFAZ**.

---

## Lo que he mirado y NO he encontrado roto

Para que la lista de arriba se pueda pesar:

- **El «ausente no es nulo» está bien resuelto en las tres capas.** La tabla usa vocabulario
  cerrado con `null` permitido (`0058:78-91`), el tipo deja el campo sin poner
  (`types.ts:740-765`), y `hidratar.ts:76-104` (`campoCribado` y `parqCribado`) devuelve un
  objeto vacío cuando el valor no es uno de los tres, en vez de rellenar con un valor por
  defecto. Un `boolean not null default false` habría convertido todo silencio en un «no», y
  no está. Esa parte está bien hecha y no hay que tocarla.
- **El asesorado no puede reabrir su propia puerta clínica.** No hay `update` para él en la
  0058, no hay método `actualizar` en `CribadoRepo` (`repos.ts:257-270`), y
  `comprobar-migraciones.sql:1068-1078` lo comprueba exigiendo que ninguna política de
  UPDATE mencione `uid()`. Tres capas diciendo lo mismo. El riesgo 3 no es que esto esté
  mal: es que falta el camino de vuelta.
- **La lectura del cribado sí funde lo que está en cola.** `hidratar.ts:644` pasa por
  `conPendientes('cribado', …)`, y `fusion.ts:23-38` resuelve la identidad por `usuario_id`
  tanto en la fila del servidor como en el `payload` encolado. Sin eso, la respuesta dada
  sin señal habría desaparecido de la pantalla en la primera hidratación tras reabrir la
  app. Está puesto.
- **La cola aguanta la pérdida de red.** Escritura local síncrona, cola en su propia clave
  de `localStorage` que sobrevive a la recarga (`cola.ts:78-103`), sin gastar intentos
  mientras `navigator.onLine` sea falso (`procesador.ts:78`), y con la instantánea cediendo
  el sitio antes que la cola cuando el teléfono se llena (`cola.ts:87-102`). El frente de
  «se fue la señal» está bien defendido; lo que falla es el de «el servidor dice que no»,
  que es el riesgo 1.
- **El apagado por tabla inexistente está bien acotado.** `esTablaInexistente`
  (`hidratar.ts:70-72`) distingue `42P01`/`PGRST205` de un 500 pasajero, y el cribado
  conserva lo local cuando la tabla no está (`hidratar.ts:642-643`), así que aplicar la 0058
  tarde no borra nada. El orden de despliegue que declara la cabecera de la migración
  (líneas 61-64) se sostiene leyendo el código.
