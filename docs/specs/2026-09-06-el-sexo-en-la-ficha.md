# El sexo en la ficha

**2026-09-06** · Bryan decidió que la ficha de cada asesorado lleve un campo `sexo` que
rellena el coach, y que con él el sujeto 3D del salón y del estudio del cuerpo se dibuje
con los huesos de un hombre o de una mujer sin que nadie toque nada. Es el punto abierto
2 de `2026-09-06-huesos-por-sexo.md`: la mitad de abajo (`juegoDeHuesos.ts`, la prop
`sexo` de `VisorPatron`, el selector del explorador) ya existía; esto es la de arriba, el
dato de la base al visor.

## Qué guarda la app hoy

Nada. Ni en `src/domain/types.ts`, ni en el código, ni en `supabase/migrations/`. Lo más
parecido es `PerfilNutricion.respuestas.genero` (`'M'`/`'H'`), que es una respuesta de la
encuesta de nutrición: la contesta el asesorado, la lee la nutricionista y sirve para la
composición corporal. No es lo mismo ni lo rellena la misma persona, así que **no se
enlazan**: el sujeto 3D sale de la ficha del coach y solo de ahí.

## Decisiones

### Dónde vive: `Perfil.sexo`, en su propia columna de `perfiles`

La «ficha» es `Perfil` (`perfiles.datos`, JSONB), que ya sube el coach por `subirPerfil`.
El campo va ahí en el dominio (`sexo?: 'hombre' | 'mujer'`), pero en la base viaja en una
**columna** `perfiles.sexo` (migración `0056`) y no como clave del blob, aunque el blob lo
admitiría sin migración:

- queda consultable en SQL sin abrir el blob;
- el `check ('hombre','mujer')` fija el vocabulario en la base —ni `M`, ni `F`, ni `H`—;
- y el blob viejo de un móvil no la puede pisar (ver abajo).

No va en `usuarios_app`: ahí el coach no tiene política de escritura sobre las filas de
otros, y darle una sería tocar RLS por un campo de ficha.

### Quién la escribe, y por qué el asesorado no la manda

Solo el coach. Tres capas, cada una por un motivo distinto:

1. **El dominio** solo ofrece `db.perfiles.guardarSexo` desde la pantalla del coach.
2. **La cola de sync** funde los upserts de la misma fila (`integrarEnCola`): si el coach
   fija el sexo y guarda una valoración sin red, el segundo envío reemplaza al primero.
   Por eso **los tres caminos del coach** (`guardarSexo`, `guardarValoracion`,
   `guardarPeldano`) mandan siempre la columna con lo que haya en local. **El del
   asesorado** (`agregarMedida`) **no la nombra**: su copia puede ser vieja —hidrató antes
   de que el coach la rellenara— y mandarla escribiría `null` encima. Un upsert que no
   nombra la columna la deja como está.
3. **El trigger `proteger_perfil`** (0008) deja al asesorado tocar solo sus medidas, pero
   compara `datos` y solo `datos`: una columna fuera del blob se le escapaba. La 0056 lo
   amplía para que el sexo lo escriba únicamente el coach. RLS no se toca: `perfiles` la
   tiene desde la 0001 y una columna nueva hereda las políticas de su tabla.

### El nombre de la columna sale de un solo sitio

`src/data/nube/perfilEnNube.ts` exporta `COLUMNA_SEXO`, `SELECCION_PERFILES` (lo que pide
`hidratar.ts`) y los tipos de las dos filas que suben. Un `.select()` con una columna que
no existe no avisa —ni `tsc` ni los tests lo ven, y `hidratarDesdeNube` degrada a la
instantánea local en silencio—, así que `perfilEnNube.test.ts` lee el SQL de las
migraciones y comprueba que la columna que se selecciona es la que crea la 0056, que el
`check` admite exactamente lo que admite el dominio, y que el envío del coach la nombra y
el del asesorado no.

### Lo que no cambia sin dato

`null` es «sin indicar». El salón y el estudio no pasan nada al visor y este usa su
defecto, que hoy es el neutro de siempre. **No se cambia el defecto del visor ni de
`juegoDeHuesos`**: eso lo lleva otra sesión.

## Orden de despliegue

**La migración va antes que el código.** Si el código nuevo llega a producción con la
0056 sin aplicar, el `select datos,sexo` falla, la hidratación se traga el error y toda
la app se queda con lo local sin sincronizar. Señal en `comprobar-migraciones.sql`:
`0056 - el sexo en la ficha`.

## Lo que queda abierto

- El encuadre del salón y la oclusión de aparatos se midieron sobre el neutro; con
  huesos de mujer el sujeto es 2,4 cm más bajo. Es de la sesión del salón.
- Un asesorado sin fila en `perfiles` no puede recibir sexo: el selector vive en la ficha
  y aparece cuando hay ficha.
