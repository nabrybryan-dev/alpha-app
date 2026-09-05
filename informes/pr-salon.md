El salón de `/entrenar` pasa a seguir el kit «Sala de entrenamiento» del handoff. Lo que el
kit aporta es **cómo se distribuye la información**; la sala, su mobiliario, sus espacios y
el sujeto no se han tocado.

La idea que gobierna los siete commits, en las palabras del encargo: **desaparecer la mayor
cantidad de letras y cuadros que tapen el salón**, y que lo que quede se toque en vez de
leerse en controles puestos encima.

## Lo que se ve

**De cinco cuadros de pared a UNO.** En el muro quedan el código de sala, el nombre del
ejercicio en trazo con sus dos ecos de canto, y un único hueco que se turnan el cronómetro
y la carga. Se fueron la tabla de series, «a continuación», el mando de registrar, la
marquesina del ritmo y el reflector de la cámara — ninguno perdió su dato.

**La prescripción rodea al sujeto.** Series, repeticiones, descanso y RIR son cuatro postes
con su base y un cartel que siempre mira a cámara. Y la clave de que el salón siga
despejado: **la cifra entra, se lee tres segundos y se retira**; lo que permanece es el
poste. Tocar una la deja fija.

**La ficha sale del borde izquierdo.** Se tira y aparece, siguiendo al dedo. Dentro se
llena carga, reps y RIR, y ahí mismo se guarda. Al guardar: se cierra, sale la frase sobre
la sala, y **el descanso arranca solo** —salvo en la última serie, porque el descanso es el
que va entre series del mismo ejercicio—.

**Todo se toca.** El mando del reloj va desnudo, sin aro ni etiquetas: se tira a un lado y
lo que cambia se lee **en la pared**, nunca sobre el mando. La semana es un tambor con
inercia. Las capas del cuerpo se atraviesan **hundiendo el dedo** en el sujeto. Y con el
dedo dentro, tirar a un lado pasa de ejercicio.

**La sala respira** ±2,5° cuando nadie la toca, y **se retira** un 12 % mientras sube la
lectura larga de abajo — que ahora explica cada prescripción en tres niveles: qué es, por
qué importa, y la señal que se mira.

## Lo que se decidió y conviene saber

- **Las cuatro estaciones en corro del kit no caben aquí.** Con una ventana horizontal de
  12,18°, un cartel a 45° del eje cae en x=523 de una pantalla de 390, en cualquier radio
  entre 1,0 y 3,2 m. Viven en el espacio del sujeto y lo que las ata a la sala es el azimut.
- **No se ha traído el `scroll-snap`** de la maqueta: un contenedor con scroll vertical se
  comería el arrastre vertical sobre el sujeto, que aquí es el eje W y en la maqueta no
  existe. Sí se ha traído el efecto que importa, la sala retirándose.
- **Se pierden dos cosas, y van dichas:** pausar y añadir 15 s al descanso (ahora es un
  modo del reloj de la pared, no una barra con mandos), y cambiar de capa con teclado — un
  gesto de presión no tiene equivalente. Si hace falta, el sitio no es devolver la escalera
  de botones: es que las capas se recorran desde la ficha.

## Lo que destapó mirar la pantalla, no los tests

Cada tanda salió verde antes de estar bien. Lo que solo dijo la foto o la medida:

- «Sin kilos» arriba y «La semana pasada · 20 KG» debajo: dos datos ciertos que juntos
  decían uno falso.
- «SERIE 1 DE 3» escrito dos veces —muro y mando— y luego otra vez dentro del propio cajón.
- Reps y RIR en dos columnas: dentro de los 232 px del cajón **la cifra medía cero píxeles**
  y seguía en el DOM.
- Los puntos de ejercicio existían, medían 350×4 y se pintaban debajo del tirador del panel.
- El vaivén de la cámara era **código muerto** —vivía en una rama que nunca se ejecutaba— y,
  al arreglarlo, seguía quieto porque el bucle trabaja en segundos y el vaivén en
  milisegundos.

Y un agujero del entorno de prueba que costó una vuelta: **en jsdom un `PointerEvent` no
transporta `clientX` ni `clientY`**. Llegan vacías, el desplazamiento sale `NaN` y el
manejador se ejecuta entero sin mover nada.

## Segunda tanda: precisión, movimiento y el fantasma

Bryan pidió después «precisar más las dimensiones del salón cuadridimensional, los grados de
las acciones musculares, y que al prescribir técnica desde el encoder se vea la diferencia
entre lo que la persona hizo y lo que tenía que hacer, o lo que hizo la semana pasada».
Cuatro commits:

- **La carta del espacio** (`escena/carta.ts`): el plano cartesiano declarado en un sitio y
  contrastado con los objetos de verdad (`carta.test.ts`, 15 pruebas). Destapó que el sujeto
  estaba **hundido 10,6 cm** en la placa —la sonda de la suela apuntaba hacia arriba por un
  signo— y que conviven **dos convenciones de ángulo** (cámara = 90° − sala), ahora con
  prueba en vez de con comentarios.
- **El movimiento**: la trayectoria por las tres poses ya no tiene codo (Hermite monótono,
  Fritsch–Carlson) y la bajada dura lo que cuenta la pared (`tempo`).
- **El fantasma, parte A** (motor): mezcla alfa en dos tandas, horneado en CPU, un segundo
  cuerpo translúcido desde una huella.
- **El fantasma, parte B** (la huella real): la hoja de medición devuelve `VelocidadDeSerie`
  con la huella de la última repetición; la cámara la anota en el borrador; `guardar()` la
  relee y la serie viaja con ella. Cierra un agujero de agosto: `historial.ts` leía
  `SerieRegistrada.velocidad` y **nadie la escribía**. El salón enseña la huella de hoy, o la
  de la semana pasada por nombre, y si no hay ninguna no inventa un fantasma.

Visto en Chrome real con GPU: sin medida no hay fantasma; con huella, el fantasma queda de
pie sobre el suelo mientras el sujeto baja. Y una hora de diagnóstico que queda dicha para
no repetirla: **el sujeto del salón NO está roto**. La capa W=0 («piel») son músculos pálidos
sin huesos, y a 4,6 m parece un haz de puntas; medido fotograma a fotograma, la caja es la de
un cuerpo sano (1,57 m de pie, 0,85 m en el fondo, sin NaN, hueso 0, alfa 1).

### El fantasma ARTICULAR

Bryan pidió cerrar lo que quedaba pendiente: que el fantasma no repita la técnica ideal a
otro ritmo sino que **doble lo que se dobló**. Sin cruzar la aduana: la app acepta tal cual
el `pista.json` que ya escribe `articulaciones.py` (**se pasan datos, no código**, la misma
frontera que `importarMedida.ts`), y el dominio lo convierte:

- `domain/patrones/huellaArticular.ts`: de la pista sagital a ángulos por muestra en los
  canales del rig —rodilla, cadera, tronco (40/60 lumbar/tórax), hombro, codo—, con la
  última repetición encontrada por histéresis sobre la vertical de la carga (muñecas si se
  ven, si no la cadera). El tobillo no se lee: lo resuelve `apoyarPies()`.
- `HuellaDeRepeticion.articular`, `poseDeHuella()`, y `esqueletoEnFase(…, medida)` que
  sobrepone los canales medidos quitando sus dos lados.
- Entra por el panel de palancas del encoder, atada al ejercicio escrito ahí; se guarda por
  nombre (`huellasArticulares.ts`) y en el salón manda sobre las huellas de barra.
- Probado contra **verdad sintética** (`pistaSintetica.ts`, como `cuerpo-sintetico.py`):
  rodilla 0→120 se lee 0→120, un canal quieto sale plano, la ventana es la última
  repetición. El sintético tenía el brazo colgando de la vertical en vez del tronco y leía
  2·tronco + hombro: lo cazó la prueba del canal plano.

Foto local `informes/fantasma-articular.png`: el fantasma con esqueleto, casi de pie, sobre el
sujeto en el fondo. Lo que sigue pendiente son las fuerzas —el brazo de momento sobre el
cuerpo—, que siguen siendo spec.

## Estado

`npm run verify`: **3.250 pruebas** en verde, 0 errores, 6 avisos (delta cero). El único rojo local es `nucleo.test.ts` —el `disco.js` de las herramientas del encoder lo está tocando otra sesión— y en el CI no corre porque allí no está ese repo. Cuatro
guardianes del repo cazaron la limpieza y los cuatro están atendidos: código huérfano,
clases de animación sin consumir, el inventario de recuadros y la auditoría de campos —los
que salieron del muro siguen montados con `sr-only`, así que se oyen y se cuentan.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_018AcBuSR9b9ePtiakvTTkHa
