# Traspaso: peso muerto y zancada en el dominio de la app (rama `salon/peso-muerto-zancada`, 22-oct-2026)

**Base: `salon/inercial-procedencias` (5db475c8), NO `salon/sujeto-sentadilla`**: el término inercial y los radios de giro registrados están en la cadena `salon/inercial` →
`salon/inercial-procedencias`, que no está en `salon/sujeto-sentadilla`. No toca `salon/al-dia` ni las ramas congeladas (el cambio de `inercial.ts` es de esta rama).

## Qué hay
- `pesoMuerto.ts`: geometría con los brazos colgando del hombro y la barra en la mano; momentos estáticos con contrato; serie con término inercial.
- `zancada.ts`: dinámica **estática** de las dos piernas por separado con carga en mancuernas; sin inercial.
- `inercial.ts`: generalizado (`momentosEnElTiempo` + `VarianteDeEjercicio`) para que el término inercial sirva a cualquier cadena sagital; la sentadilla sigue igual
  (`momentosDeSentadillaEnElTiempo` es un envoltorio; sus 25 pruebas pasan sin cambio).

## Peso muerto
Mismos tobillo → rodilla → cadera → cervical → vértex y signos que la sentadilla; cambia dónde va la carga: el brazo es una recta hombro-mano a `brazo` radianes de la
vertical, con brazo, antebrazo y mano en sus centros de masas de de Leva, y la barra en el centro de masas de la mano.
Supuestos: el hombro en el punto cervical (cada cm de error en horizontal mueve la cadera ~10 N·m con 100 kg; no medido); brazos estirados y rígidos; los dos brazos como un
solo punto; pie plano. **Pose de referencia** `POSE_DE_PARTIDA_ILUSTRATIVA` (tibia 0,35, muslo −1,4, tronco 0,95, cabeza 0,5, brazos verticales): escrita para ver órdenes de magnitud,
**no es la técnica de nadie ni una norma** (`convencion_propuesta`).

Casos con respuesta conocida (`pesoMuerto.test.ts`, 21):
| Caso | Respuesta | Resultado |
|---|---|---|
| de pie, brazos colgando | 0 en los tres | < 1e-9 |
| tronco a 60°, piernas verticales | cadera = g·[m_tronco·(1−0,5138)·L + (m_cabeza + m_brazos + carga)·L]·sen 60°; rodilla = −cadera; tobillo = cadera | exacto a 1e-8 (≈ 280 N·m) |
| agarre bajo el hombro | a brazo + antebrazo + 0,79·mano de largo | exacto a 1e-12 |
| identidad con la sentadilla | con brazos verticales el estático es el de la sentadilla con la barra en el cervical (solo importan las posiciones horizontales) | 3 poses, 1e-8 |
| barra sobre el pie | `brazoParaBarraSobre` la deja a 1e-9 m de la vertical pedida; una vertical inalcanzable da `null` | cumple |
| péndulo del tronco con la cadera fija y brazos colgando | fórmula analítica con los desplazamientos fijos de los brazos y la barra | 4 cuadros, 0,05 N·m |

**Cruce con el banco virtual** (`lab/banco` en main, `calculo/banco/fisica.py`, solo lectura): `scripts/peso-muerto-para-el-cruce.mts` + `scripts/cruce-peso-muerto-con-banco.py` arman el
peso muerto con las primitivas del banco (la dirección del brazo es un ángulo fijo extra) y comparan el término inercial con ω y α analíticas y con los radios sagital y transverso:
**diferencia máxima 0,0052 N·m** en 4 cuadros × 3 articulaciones de un movimiento con las cuatro articulaciones en fases distintas; la parte estática difiere solo por g (9,80665 contra 9,81; p. ej. cadera 648,461 contra 648,682).

## Zancada
Pierna delantera con ángulos; la trasera, con el tobillo `pasoM` detrás y a `alturaTobilloTraseroM` del suelo, y la rodilla resuelta del triángulo (rodilla por delante). Mancuernas colgando
de los brazos verticales (`cargaKg` = suma de las dos). Reparto de la fuerza vertical por la regla de la palanca con el CM del cuerpo entero entre los centros de presión (CP: pie delantero
en su CM, trasero en la bola del pie); momentos de abajo arriba por pierna con los mismos signos que la sentadilla. La **banda** = envolvente de mover cada CP ± 3 cm (`convencion_propuesta`).
Casos (`zancada.test.ts`, 21): con el paso en cero y el CP bajo el CM, cada pierna = mitad de la sentadilla; **los dos momentos de cadera suman el del tronco, la cabeza, los brazos y la carga**
(4 poses, 1e-6); la rodilla trasera cierra el triángulo a 1e-12 y va por delante; caso a mano del triángulo (0,5/0,5/0,6 → rodilla a (0,4; 0,3)); regla de la palanca a mano; fuera de los apoyos, fuera de alcance, datos que faltan → `no_afirmable`.

## Pruebas y mutaciones
`npx vitest run src/domain` (suite del dominio completa): ver el informe; `eslint src/domain/sujeto` limpio; `tsc` sin errores en `src/domain/sujeto`. 7 mutaciones sembradas (signo del brazo, posición de la barra, recorte del ángulo,
signo de la rodilla, lado de la palanca, lado de la rodilla trasera, reparto fuera de [0, 1]): **7 de 7 muertas**.

## No se comprobó / decisiones pendientes
- **Sin inercial en la zancada**: con aceleración el reparto entre los dos pies no tiene regla publicada. Opción recomendada: dejarlo `no_afirmable` hasta tener una placa de fuerzas o un supuesto firmado por Bryan.
- **Reparto y CP son supuestos**, no medidas: sin placa de fuerzas el reparto de la zancada solo se acota con la banda de ± 3 cm; la forma de la envolvente es mía.
- El hombro en el cervical, brazos estirados y mancuernas siempre a los lados (en la zancada con mancuernas en el pecho, o con barra, la geometría cambia: no cubierto).
- La zancada no mueve el pie trasero ni resuelve el talón levantado como un pie inclinado; solo el tobillo a esa altura.
- Nada con personas ni video real. La pose de partida del peso muerto es ilustrativa. No se pasó `npm run verify` completo.
