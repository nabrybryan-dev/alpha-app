# El puente: de los números de cada persona a su revisión publicada

**2026-09-11.** Complementa `docs/specs/2026-09-10-revision-semanal-en-video.md`, que
decide *qué* es la revisión semanal. Esto es *cómo se produce*, de punta a punta.

## El agujero que tapa

Al 11-sep estaban las cuatro piezas y ninguna se hablaba con la siguiente:

| Pieza | Dónde | Qué hace |
|---|---|---|
| La cuenta | `src/domain/resumenSemanal/calcular.ts` | los números de la semana de una persona |
| El guion | `src/domain/resumenSemanal/guion.ts` | los mete en frases; la frase sin dato se cae |
| La voz | fuera del repo (Python) | dice el guion con la voz clonada |
| El publicador | `scripts/publicar-video.mjs` | sube el archivo y escribe la fila |

Era tener la báscula, la libreta, el micrófono y el mensajero sin nadie que los pasara de
mano en mano. Mientras tanto `videos_semanales` tenía **0 filas**.

## La cadena, en tres pasos

```
1. npm run revision-semanal -- --paso guiones --semana 2026-09-07
      lee la base, arma la tanda y escribe salidas/revision-<lunes>/
        · <uuid>.txt       el guion de cada quien
        · manifiesto.json  la tanda entera, con sus números

2. python generar_revisiones.py salidas/revision-<lunes>/     (en dev/prueba-voz)
      lee el manifiesto y deja <uuid>.mp3 al lado

3. npm run revision-semanal -- --paso publicar --semana 2026-09-07
      sube cada audio y escribe su fila. NUNCA aprueba.
```

**Tres pasos y no uno, a propósito.** En medio hay una hora de máquina hablando, y lo que
se le va a decir a alguien con la voz del coach tiene que poder leerse *antes* de que suene.
El paso 2 vive donde vive el modelo, con su propio entorno de Python: la app no sabe generar
voz y no tiene por qué.

## Lo que se decidió, y por qué

**La tanda la define el microciclo activo, no la lista de asesorados.** Parte de la cartera
está inactiva a propósito —una pausa, un viaje, un alta que aún no empieza—, y a esa gente
no se le manda el domingo la revisión de una semana que no tenía que entrenar.

**A quien no hay nada que decirle no se le manda un hola y un adiós.** El saludo y la
despedida no dependen de ningún dato, así que sin freno saldría un audio con la voz del
coach que no dice ni un número, y eso suena a error. Tener algo que decir es tener al menos
una de las tres: sesiones pautadas, adherencia registrada, o una noche con sus dos horas.
Quien se queda fuera **se dice por su nombre** en la salida; no desaparece en silencio.

**La adherencia y el sueño se calculan con TODO lo registrado, no con la ventana de siete
días.** Es el mismo número que alimenta la tarjeta de Hoy, y la revisión se ve pegada encima
de esa tarjeta: recortar la ventana aquí haría que el asesorado oyera un número y leyera
otro a dos centímetros. Si algún día pasa a ser semanal, tiene que cambiar **en los dos
sitios a la vez**.

**El guion que se publica sale del manifiesto, palabra por palabra.** El paso 3 no vuelve a
calcularlo: lo que se publica tiene que ser exactamente lo que se revisó, y es lo que
permite auditar después qué se le dijo a alguien.

**La semana la manda el manifiesto.** Si la línea de órdenes pide otra, se para: publicar
bajo la fecha de una semana unos audios hechos para otra es la forma de que alguien oiga
números viejos.

**Publicar sigue sin aprobar.** El puente no tiene forma de escribir la firma, igual que el
publicador. Lo que hace que una revisión salga es la bandeja, y la RLS de la 0068 esconde al
asesorado toda fila sin firmar.

## Dónde vive cada decisión

- `src/domain/resumenSemanal/reparto.ts` — **puro y probado en frío**: quién entra en la
  tanda, cómo se casan las filas de la base con cada persona, qué dice el guion de cada
  quien y a quién se salta. Incluido el mapeo `usuario_id` → `usuarioId`, que es donde uno
  se equivoca: un nombre mal copiado no da error, deja a alguien con cero sesiones y le dice
  en voz alta que no entrenó.
- `scripts/revision-semanal.mjs` — pide los datos, escribe archivos y publica. No decide.
- `scripts/lib/publicar-una-revision.mjs` — subir y escribir **una**, compartido con
  `publicar-video.mjs`. Estaba dentro del publicador y se sacó al aparecer el segundo que lo
  necesitaba: tenerlo dos veces permite que discrepen, y esa clase de desacuerdo no da
  error, da un archivo que el móvil no abre.

## Una trampa que costó encontrar

**El publicador no arrancaba nunca.** `publicar-video.mjs` llevaba un `#!/usr/bin/env node`,
pero se lanza con `npm run`, que pasa por vite-node, y vite-node reescribe los imports
arriba del todo: eso empuja el `#!` a la sexta línea, donde ya no es un shebang sino un
error de sintaxis. Medido el 11-sep sobre `main`, con el archivo tal y como se fusionó.

El error decía «Invalid or unexpected token» y señalaba una línea que no existía en el
archivo que uno lee. Ni una palabra sobre shebangs. Por eso ninguno de los dos scripts lleva
uno, y ambos lo dicen en su cabecera.
