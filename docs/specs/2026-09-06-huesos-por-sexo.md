# Huesos por sexo para el sujeto 3D — 2026-09-06

## Qué y por qué

El sujeto de `src/domain/patrones/esqueleto.ts` (`ESQUELETO`, 21 huesos) tiene
proporciones inventadas. Al encajarle encima los dos atlas reales (2026-09-05) se midió
que no cuadra con ninguno: su tibia mide 0,43 m cuando la de un varón de referencia mide
0,377 y la de una mujer 0,341, y su cadera está más alta que la de los dos. Deformar cada
atlas hacia el sujeto (lo que se hizo para que coincidieran) es la salida mala; la buena
es que el sujeto tenga **huesos con longitud por sexo**.

Regla que manda sobre todo lo demás: **por defecto no cambia nada**. Cada patrón, cada
prueba y cada foto aprobada están hechos con las medidas de hoy, así que el juego
`neutro` es el que sigue saliendo si nadie elige otro, y es el mismo objeto `ESQUELETO`.

## Las medidas de referencia

Alturas de las articulaciones, de pie, desde el suelo, en metros. El sujeto se mide con
`resolver({}, [0, 0, 0], [0, 0, 0])` y `puntoDeHueso(esq, hueso, 0|1)`; **no** sobre la
malla de `construirHuesos()`, que dibuja en el espacio local de cada hueso y ya engañó
una vez (dijo que el sujeto medía 0,555).

| articulación               | neutro (hoy) | varón, BodyParts3D 4.0 | mujer, Human Reference Atlas v1.5 |
|----------------------------|-------------:|-----------------------:|----------------------------------:|
| tobillo                    | 0,076        | 0,072                  | 0,074                             |
| rodilla                    | 0,505        | 0,449                  | 0,415                             |
| cadera (cabeza del fémur)  | 0,955        | 0,912                  | 0,833                             |
| hombro (cabeza del húmero) | 1,412        | 1,415                  | — (sin húmero en la fuente)       |
| codo                       | 1,104        | 1,110                  | —                                 |
| muñeca                     | 0,846        | 0,884                  | —                                 |
| coronilla                  | 1,690        | 1,714                  | 1,666                             |
| medio hombro (eje → húmero)| 0,168        | 0,190                  | —                                 |

Largos que salen de restar: fémur 0,463 / 0,418; tibia 0,377 / 0,341; húmero 0,305;
antebrazo 0,226 (varón / mujer).

## El modelo (`src/domain/patrones/juegoDeHuesos.ts`)

Un juego decide **siete números**: fémur, tibia, húmero, antebrazo, altura de la cadera,
estatura y media anchura de hombros. De ahí sale un esqueleto con los mismos 21 huesos,
el mismo orden y los mismos padres (así `INDICE_HUESO` y las 24 matrices del shader
valen para todos); solo cambian `desde` y `largo`:

- **El tronco entero** —pelvis, columna, cuello, cráneo y la altura a la que cuelgan
  clavículas, escápulas y brazos— se estira con **un solo factor**: del origen de la
  pelvis a la coronilla en el juego, partido por lo mismo en el neutro. Con él el varón
  clava la coronilla y deja el hombro a 4 mm (1,411 contra 1,415), el codo a 2 mm y la
  muñeca a menos de 1 mm. Un segundo factor para cabeza y cuello mejoraría 4 mm a cambio
  de un número que la mujer no puede aportar (su atlas no trae hombro).
- Cada hueso que **nace en la punta de su padre** (tibia, pie, antebrazo, mano) se
  recoloca al largo nuevo del padre.
- **La clavícula crece con los hombros** para seguir llegando a la cabeza del húmero
  (0,155 → 0,178 en el varón), y la escápula se desplaza hacia fuera lo mismo que el
  hombro.
- **Lo que no tiene medida no se toca**: mano, pie, anchura de cadera, grosor de nada,
  ningún `reposo`.

La geometría (`construirHuesos(huesos)`) sigue al juego estirando cada hueso a lo largo
de su eje en la razón de su largo, con las normales corregidas por la inversa traspuesta.
Con el neutro se devuelve la malla tal cual: mismo SHA-256 que antes.

### El supuesto del brazo femenino

El atlas femenino no trae húmero ni radio (sus 91 piezas de esqueleto son la columna,
dos rodillas y tejido óseo suelto). Húmero, antebrazo y anchura de hombros de la mujer
son **los del varón escalados a su estatura** (1,666 / 1,714): 0,296 / 0,220 / 0,185. Está
escrito como SUPUESTO en el código y clavado en un test para que cambiarlo sea un acto
consciente.

## Lo medido después

| articulación | neutro | hombre (ref.) | mujer (ref.) |
|--------------|-------:|--------------:|-------------:|
| tobillo      | 0,076  | 0,073 (0,072) | 0,075 (0,074) |
| rodilla      | 0,505  | 0,449 (0,449) | 0,415 (0,415) |
| cadera       | 0,955  | 0,912 (0,912) | 0,833 (0,833) |
| hombro       | 1,412  | 1,411 (1,415) | 1,351 (—)     |
| codo         | 1,104  | 1,108 (1,110) | 1,057 (—)     |
| muñeca       | 0,846  | 0,884 (0,884) | 0,839 (—)     |
| coronilla    | 1,690  | 1,714 (1,714) | 1,666 (1,666) |
| medio hombro | 0,168  | 0,190 (0,190) | 0,185 (—)     |

De pie sobre el suelo (`resolverConApoyo`, planta a 7,5 cm bajo el tobillo) el varón queda
2–3 mm más alto que la tabla, porque la sonda de la planta no es por sexo.

## Lo que no cambia

- Sin parámetro, o con `neutro`: matrices de la pose vacía y de dos patrones (sentadilla a
  0,5; empuje horizontal a 0,25), malla ósea (13.774 vértices, posiciones y normales),
  encuadre y traza — mismo SHA-256 que en `9df953f`, clavado en `juegoDeHuesos.test.ts`.
- El salón sigue en neutro: su encuadre y la oclusión de aparatos se calculan sobre el
  patrón sin juego.
- `puntoDeHueso` no necesita parámetro: lee los largos del esqueleto resuelto.

## Interfaz

`VisorPatron` recibe `sexo?: Sexo` (por defecto `neutro`) y lo pasa a todo lo que
resuelve el sujeto: malla, reposo, traza, encuadre, cada fotograma y el fantasma. El
explorador anatómico enseña un selector Neutro / Hombre / Mujer junto a «Anatomía real».
Con palabras y no con ♂/♀: el guardián `emojis-como-iconos.test.ts` no deja símbolos
haciendo de icono, porque los dibuja el sistema operativo y salen distintos en cada
teléfono.

## Lo que queda por decidir (Bryan)

1. Si el neutro debe pasar a ser el varón real. Hoy no: cambiaría lo que se ve en todos
   los patrones y las fotos aprobadas.
2. De dónde saldrá el sexo de cada persona: la app no lo guarda en ningún sitio (ni en
   tipos, ni en código, ni en migraciones). Hace falta un campo de perfil.
3. Si el brazo femenino supuesto vale hasta que haya un atlas femenino con brazo.
4. Si la planta bajo el tobillo (7,5 cm, `ALTURA_DEL_TOBILLO`) debe ir por sexo (el varón
   del atlas tiene 6,2 cm entre planta y tobillo).
