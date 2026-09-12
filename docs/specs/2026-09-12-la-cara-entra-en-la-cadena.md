# La cara entra en la cadena (2026-09-12)

La revisión semanal ya salía con la voz de Bryan. Esto es lo que hizo falta para que salga
también **con su cara**, y por qué cada decisión es como es.

Sucede a `2026-09-11-el-puente-de-la-revision-semanal.md`, que montó los tres pasos —números,
voz, publicación—. Aquí se añade el paso 2.5.

## La idea, que no es la obvia

**No son veintidós clones: es un avatar y veintidós audios.** La cara se prepara una sola vez
—fotogramas, coordenadas, máscaras de fusión y representaciones internas— y a partir de ahí
solo cambia lo que dice. Por eso el coste crece con los segundos, no con la gente.

Esa distinción no es teórica: usando el modo equivocado del modelo, cada vídeo volvía a
analizar los 627 fotogramas del maestro. **Veintidós veces el mismo trabajo.**

## La cadena entera

```
1. los números y el guion   portátil    lee la base, escribe qué se le dice a cada quien
2. la voz                   portátil    frase a frase, medida; si una sale corta, nadie sale
2.5 LA CARA                 Kaggle      sube, genera, recoge y BORRA los audios de allí
3. publicar, sin firmar     portátil    el mp4 si existe, el mp3 si no
4. la firma                 una persona una por una, con el texto delante
```

## Por qué la cara se va fuera, y a Kaggle

El portátil es AMD y el modelo habla el idioma de las tarjetas NVIDIA. Lo intentamos
traducir: **ZLUDA se monta entero y falla en el primer cálculo** (`named symbol not found`,
con dos versiones de PyTorch y tras precompilar). El equipo de una compañera sí tiene NVIDIA,
pero es su puesto de trabajo: durante las pruebas, el sistema mató un proceso por falta de
memoria con Photoshop abierto.

Kaggle y no Colab por una razón concreta: **Kaggle ejecuta en segundo plano** (30 h por
semana, sesiones de 9-12 h), y Colab se desconecta a los 90 minutos si nadie toca la pestaña.
Un viernes de madrugada no hay nadie tocando pestañas.

## Lo que cuesta, medido

| | |
|---|---|
| preparar el avatar | 12,5 min, **una sola vez** |
| cada vídeo | **142 s** |
| la tanda de 22 | **~1 h 15** |
| tarjeta | Tesla **P100** (la vieja que reparte Kaggle; con una T4 será menos) |
| resultado | **22 de 22 pasan la puerta de calidad** |

## La decisión que más importa: la cara no puede tumbar la revisión

Si el paso 2.5 falla —Kaggle caído, sin cuota, sin red— **se anota el motivo y se sigue**. El
paso 3 publica el mp4 cuando existe y el mp3 cuando no, así que **un viernes sin cara es un
viernes con voz, no un viernes sin revisión**.

Visto funcionar con el lanzador escondido a propósito: «no encuentro el lanzador. SIGO: se
publicará la voz», «caras en la carpeta: 0 de 22», y la cadena llega hasta el final.

## Lo que se sube fuera, y lo que vuelve

Sube **el identificador y el audio**. Ni el guion, ni el nombre, ni la ficha: quien renderiza
no necesita saber de quién es cada archivo. Y **los audios se borran de Kaggle al terminar**,
en un `finally`, para que el borrado no dependa de que alguien se acuerde.

## Seis trampas que costaron una noche, y dónde muerden

1. **`bbox_shift` no hace nada en v15.** Los dos scripts del modelo lo pisan a cero. Se
   acepta en la línea de órdenes y se ignora: un barrido con él daría seis vídeos idénticos
   y una tabla que dice «empate», que parece un resultado.
2. **Las rutas de los pesos por defecto son las de v1** aunque se pida v15. Sin pasarlas a
   mano, **corre el modelo viejo creyendo que hace el nuevo, y no avisa**.
3. **El pickle de coordenadas se escribe en el PADRE de `--result_dir`**, y sin
   `--saved_coord` se borra al terminar. Por eso «reutilizar el análisis» no reutilizaba nada.
4. **`mmpose` ya no se instala en ninguna máquina moderna**: no compila contra el PyTorch que
   exigen las tarjetas nuevas, y en Python 3.12 revienta porque desapareció
   `pkgutil.ImpImporter`. Se sustituye por el mismo DWPose en ONNX.
5. **El trío `diffusers` / `accelerate` / `transformers` del `requirements.txt` ya no encaja
   entre sí.** Cada versión vieja pide a la otra algo que aún no existía.
6. **Kaggle reparte P100 o T4 sin dejar elegir**, y su PyTorch preinstalado **no soporta la
   P100**. El error no menciona la tarjeta: dice *no kernel image is available*.

## Y una del lado de casa

`$ErrorActionPreference` estaba en `'Stop'` en el guion del viernes. Con eso, PowerShell
convierte en error mortal **cualquier cosa que un programa externo escriba por el canal de
errores**. El generador de voz imprime un aviso sobre `pkg_resources` al cargar el modelo, y
eso bastaba para tumbar la cadena **en el paso 2**, con un mensaje que habla de `setuptools`
y no menciona ni la voz ni la revisión. Ahora está en `'Continue'`: cada paso comprueba su
propio `$LASTEXITCODE` y para con un motivo escrito, que es la red de verdad.

## Cuatro trampas más, y las cuatro acaban igual (12-sep, por la mañana)

La corrida de confirmación terminó **en verde y diciendo «2 de 22 pasan»**. Los veintidós
vídeos eran correctos: medidos aquí, cada uno dura **exactamente** lo que su audio, con
diferencia de 0,00 s en los veintidós. Lo que estaba roto era todo lo que hay alrededor.

1. **El vídeo salía llamándose `audio_0.mp4`.** El nombre del vídeo lo pone la clave del
   clip en la configuración del modelo, y ahí iba un contador. El publicador busca
   `<usuarioId>.mp4` junto al `<usuarioId>.mp3`: con otro nombre **no lo ve**. Veintidós
   caras correctas y un viernes con voz. Ahora la clave es el nombre del audio.
2. **La puerta medía cada vídeo contra el audio de otra persona.** El emparejamiento era
   `wavs.get(nombre) **or** el primer audio`: como ningún nombre casaba (trampa 1), los
   veintidós se compararon con el audio de 11,86 s del primero. Pasaron los dos que por
   casualidad duran eso. **Un emparejamiento que falla se dice; no se sustituye por uno
   cualquiera.**
3. **La recogida se traía veinte archivos de entre miles.** El listado de la salida viene
   **paginado**, y quien lo pedía no recorría las páginas; y sin filtro se descargan además
   los ~10 GB del modelo. Ahora se piden por patrón y se recorren las páginas.
4. **El cuaderno leía un conjunto de datos y la subida escribía en otro.** El metadato
   apuntaba a `alpha-tanda-2026-09-07` —con la fecha dentro— y el programa sube siempre a
   `alpha-tanda`. Un viernes cualquiera eso no da error: **renderiza los audios de otra
   semana con los nombres de esta**, y se publican vídeos con los números equivocados. De
   propina, la carpeta de subida llevaba **su propia copia del cuaderno**, que nadie
   actualizaba: se corregía el cuaderno y Kaggle ejecutaba el viejo. Las dos cosas las
   escribe ahora el propio lanzador antes de subir.

Y una de casa: **la biblioteca de Kaggle guarda el registro del cuaderno con la codificación
antigua de Windows**, y nuestro registro lleva acentos. Revienta con `UnicodeEncodeError`
**después** de haber hecho el trabajo. El lanzador se relanza en UTF-8.

**Lo que las cuatro tienen en común es lo importante:** ninguna da un error rojo. Todas
terminan en «caras en la carpeta: 0 de 22» y una revisión con voz —que es justo el camino
que dejamos preparado para cuando Kaggle esté caído—. **Un respaldo que se traga los fallos
del camino principal es un respaldo que impide verlos.** Por eso la recogida ahora **dice**
cuándo llegan vídeos que no llevan el nombre de nadie de la tanda, en vez de contarlos como
caras.

## Lo que queda abierto

- **La apertura de la boca.** Medida: el render abre un **85 %** de lo que abre el maestro.
  Los labios NO salen más finos —salen al 109 %—, que era la hipótesis inicial y era falsa.
  Las palancas reales son `extra_margin`, `parsing_mode` y los anchos de mejilla.
- **La nitidez.** El viaje a 256 px se lleva el grueso del detalle; un retoque solo en la
  boca recupera casi todo lo recuperable. El resto es arquitectura del modelo.
- **La sincronía fonema a fonema** no la mide nadie todavía: haría falta un SyncNet.
