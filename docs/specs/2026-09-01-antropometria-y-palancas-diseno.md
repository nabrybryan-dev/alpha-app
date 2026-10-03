# Antropometría individual y palancas — diseño aprobado

Fecha: 2026-09-01  
Estado: aprobado por el coach para implementación

## Decisión

La app guarda **exactamente ocho** medidas, en centímetros:

1. `tibiaPeroneCm`
2. `femurCm`
3. `torsoCm`
4. `antebrazoCm`
5. `brazoCm`
6. `anchoClavicularCm`
7. `cinturaCm`
8. `caderasCm`

No entran estatura, envergadura, peso, pliegues ni una novena medida. Cintura y
caderas son perímetros de contexto: nunca sustituyen una longitud ni se usan para
calcular un brazo de momento.

## Fuentes y jerarquía

- Anatomía local: `C:/Users/ASUS/Downloads/tratado_anatomia_100_paginas.html`,
  en especial capítulo 1 (proporciones longitudinales) y capítulo 3 (palancas de
  tercer género).
- Doctrina ejecutable: `C:/Users/ASUS/dev/cerebro-alpha/wiki/conocimiento/segmentos-ejes-y-palancas.md`.
- Tabla actual de la app: `src/domain/biomecanica/`.

El tratado fundamenta la relación geométrica; no autoriza a estimar fuerza
interna. La doctrina del cerebro pone el límite: una cámara ve eje y línea
externa, no la inserción tendinosa ni la tolerancia del tejido. El gran anexo de
telemetría del HTML se declara simulado en el propio documento y por eso no se
usa para fijar umbrales poblacionales.

## Persistencia aislada

`perfiles_antropometricos` tiene una fila por `auth.users.id`, ocho columnas
numéricas `NOT NULL` y `actualizado_en`. No se guarda dentro de
`perfiles.datos`: un guardado de palancas no puede sobrescribir objetivos,
valoraciones, medidas corporales ni prescripción.

En el dispositivo usa `alpha-antropometria-v1`, distinta de `alpha-db-v2`. El
cierre de sesión borra ambas. El repositorio solo devuelve una persona por id;
RLS deja leer/escribir al dueño y al coach. La cola sincroniza un upsert sobre
`usuario_id`, y la hidratación conserva lo local si la tabla no existe o la red
falla.

## Dos distinciones que no se pueden perder

### Dominada y jalón

La dominada es cadena cerrada: las manos quedan fijas, se mueve el cuerpo y la
línea de fuerza pasa por el centro de masas del cuerpo + lastre. El jalón es
cadena abierta: se mueve la mano y la línea la fija el cable. Seguir un cable en
la dominada produce un número preciso sobre una línea inexistente.

### Convencional y rumano

El peso muerto convencional inicia en el suelo y coordina extensión de rodilla y
cadera. El rumano inicia erguido, desplaza la cadera hacia atrás y mantiene la
rodilla casi fija. Comparten categoría de volumen, pero no pose, lectura técnica
ni regla individual. El nombre del ejercicio decide la variante; nunca se
reescribe el texto de prescripción.

## Registro de reglas

Todas viven en `REGLAS_BIOMECANICAS`. Una regla sin id, evidencia contraria,
población, caso, límites o aprobación no cumple contrato.

| ID | Población | Evidencia a favor | Evidencia contraria | Caso numérico | Límite principal | Aprobación |
|---|---|---|---|---|---|---|
| `BIO-SENTADILLA-FEMUR-TORSO-01` | Adultos en sentadilla cerrada sin limitación clínica declarada | Fémur largo aumenta brazo de cadera y puede exigir inclinación | Tobillo, pies, carga y técnica también deciden | 50/45 = 1,11 | No diagnostica movilidad ni cambia la variante | Coach, 2026-09-01 |
| `BIO-PM-CONVENCIONAL-SEGMENTOS-02` | Adultos, convencional desde suelo | Fémur/tibia condicionan la salida con rodilla+cadera | No mide capacidad, brazo interno ni tolerancia | 50/40 = 1,25 | No aplica a rumano/RDL | Coach, 2026-09-01 |
| `BIO-PM-RUMANO-FEMUR-TORSO-03` | Adultos, rumano desde erguido | Rodilla casi fija; separación de barra alarga cadera y lumbar | Con carga ligera el torso puede dominar el momento | 48/52 = 0,92 | No calcula fuerza lumbar interna | Coach, 2026-09-01 |
| `BIO-DOMINADA-BRAZOS-TORSO-04` | Adultos en dominada estricta | Miembro superior cambia recorrido; manos fijas, cuerpo móvil | Agarre, escápula, lastre y CdM también mandan | (34+28)/50 = 1,24 | No usa cable ni prescribe lastre | Coach, 2026-09-01 |
| `BIO-HOMBRO-ANCHO-BRAZO-05` | Adultos sin restricción clínica de hombro | Geometría externa altera trayectoria | Brazo tendinoso interno no se ve ni se deduce | 42/34 = 1,24 | No diagnostica ni fija ancho de agarre | Coach, 2026-09-01 |
| `BIO-PERIMETROS-NO-SON-PALANCAS-06` | Cualquier adulto con cintura/caderas | Distribución de masa participa en el CdM | Perímetros no localizan CdM ni eje/línea | 78/102 = 0,76 | No escala segmentos ni momentos | Coach, 2026-09-01 |

## Salida trazable

`analizarBiomecanica` devuelve patrón, cadena, origen de línea, plan de medida,
perfil usado, ids de reglas, aprobaciones, fuentes y límites. Si faltan las ocho
medidas, devuelve la mecánica base sin personalización: no completa huecos con
promedios. Las aplicaciones describen cómo interpretar una ejecución; no emiten
series, cargas, repeticiones, RIR ni cambios a la prosa del coach.

El análisis posterior siempre devuelve `encoder.estado`:

- `sin-grabacion`: no existe una captura actual;
- `analizado`: existe captura actual y no hay semana anterior o su firma es
  compatible;
- `incompatible`: las dos tomas semanales no se comparan y se enumeran todos
  los motivos.

La firma exige igualdad en siete piezas: patrón, variante, carga, ROM, escala,
FPS y versión del encoder. El analizador recibe resultados ya producidos, no
enciende una grabación, y conserva intactos los objetos de captura.

## Criterios de cierre

- El contrato exporta ocho claves y la base tiene esas ocho columnas.
- Guardar antropometría no modifica `perfiles`.
- Salir de sesión elimina la copia antropométrica del dispositivo.
- `DOMINADA PRONA` resuelve al patrón `dominada`, cadena cerrada.
- `PESO MUERTO CONVENCIONAL` resuelve a `peso_muerto_convencional`.
- `PESO MUERTO RUMANO` conserva `bisagra_cadera`.
- Cada conclusión individual lista la regla aprobada que la produjo.
