# Traspaso: sentadilla bulgara en el dominio (rama `salon/zancada-bulgara`, 22-oct-2026)

Base: `salon/peso-muerto-zancada` (825ed29c). Archivos nuevos: `zancadaBulgara.ts` y su prueba; tocados: `registro.ts` (3 constantes), `index.ts`, `API-DEL-SUJETO-PARA-EL-LABORATORIO.md`.

## Regla y fuente (REPARTO-ZANCADA.md, 22-oct, leido entero)
Trasera = 0,30 BW (Helme 2020, n = 26: 0,30 +- 0,09 BW), banda [0,26; 0,35] BW (Arakawa 2025, n = 9: "0,26-0,35 BW"), `estimado`; delantera = F_total - F_tras.
Variantes `no_afirmable` (el codigo lo dice y una prueba lo fija): sentadilla dividida plana (un estudio, n = 8, promedio temporal) y zancada con paso (sin estudio abierto).

## Donde el documento manda sobre el encargo
- El encargo pide "termino inercial por pierna". El documento (§4, tabla de estado) dice: termino inercial por pierna, cualquier variante, `no_afirmable` (ningun estudio lo separa); "con la busqueda elevada se puede aplicar la regla al F_total completo, con la salvedad de la excentrica".
  Implementado asi: la regla se aplica al F_total con aceleracion; el inercial por pierna sale `estimado` con ese aviso en `supuestos`, NO como medida.
  **Decision para Bryan**: si prefiere seguir al pie de la letra la tabla (`no_afirmable`), basta devolver `no_afirmable` en `momentosDeBulgaraEnElTiempo`. Recomendado: dejarlo como esta, con el aviso, hasta tener placa de fuerzas.
- Aritmetica de B: 169/666 N = 0,254, no 0,26; el documento escribe 0,26. Se uso 0,26 (manda el documento). B tampoco cierra la suma de fuerzas (~0,9 BW), lo avisa el propio documento.

## Por que no `momentosEnElTiempo` para el reparto
Esa funcion da el momento de todo lo de ARRIBA de una articulacion con la reaccion en la articulacion fuera de la ecuacion (una sola cadena). Por pierna hace falta la reaccion de cada pie y la otra pierna.
Se reutilizan `derivadaSegunda`, `momentoNetoSobre` y los radios de giro; `momentosEnElTiempo` (con `VARIANTE_PESO_MUERTO`) queda como oraculo: cadera delantera + cadera trasera = cadera del oraculo - y_cadera * (suma de m*a_z). Identidad derivada a mano y comprobada en 5 cuadros.

## Supuestos propios (convencion_propuesta, sin fuente)
- El CP del pie delantero no se supone: sale del equilibrio de momentos con las dos fuerzas fijadas por la regla. Debe caer en [-0,25 * largo del pie, +largo del pie] desde el tobillo; si no, `no_afirmable` (pose y regla incompatibles). El 0,25 es mio.
- Reacciones solo verticales; la fuerza horizontal neta no se reparte (se informa por cuadro). Pies fijos entre cuadros. CP trasero +-3 cm como en `zancada.ts`.
- Carga en mancuernas a los lados (geometria de `zancada.ts`); la barra al hombro (el caso de Helme) NO esta modelada.

## Filas para PROCEDENCIAS.tsv (repo del cerebro; NO las escribi: es otro repo)
Formato de los radios del bloque 10 (valor TAB [id] que_es TAB fuente TAB estado TAB fecha TAB nota). Sin estas filas `npm run procedencias-sujeto` dara 3 `sin_fila`. Valores, ids y fuentes:

| valor | id | fuente | estado |
|---|---|---|---|
| 0.30 | `helme20.bulgara.trasera.bw` | Helme M, Emmonds S, Low CJ. J Strength Cond Res 2020, DOI 10.1519/JSC.0000000000003727, tabla 2 (0,30 +- 0,09 BW, n = 26, barra); via REPARTO-ZANCADA.md §1 fila A y §4 | transcrito, 2026-10-22 |
| 0.26 | `arakawa25.bulgara.trasera.bw_inf` | Arakawa H et al. Int J Exerc Sci 2025;18(7):881-894, PMC12408075, tabla 1; limite tal como lo escribe REPARTO-ZANCADA.md §4 (169/666 daria 0,254) | transcrito, 2026-10-22 |
| 0.35 | `arakawa25.bulgara.trasera.bw_sup` | idem; 234/666 = 0,351 | transcrito, 2026-10-22 |

## Pruebas y mutaciones (22-oct)
`npx vitest run src/domain` -> 210 archivos, 4083 pruebas OK (antes de agregar la prueba de la rodilla; ver el commit final para la cifra). 151/188/497 intactos: `capaDeMomentos.test.ts`, `frontera.test.ts`, `inercial.test.ts` (69 pruebas, sin cambiar valores).
`npx tsc -b`: sin errores en `src/domain` (hay errores previos en `src/features/coach/presentacion/escena3d`: faltan `three` y `@react-three/fiber` en node_modules, que es un enlace al del worktree de ejercicios). `npx eslint src/domain/sujeto` limpio.
8 mutaciones sembradas (fraccion 0,33; F_del sin restar la trasera; BW con la masa de la carga; signo de alfa; equilibrio sin la trasera; plana pasa a estimado; signo de la rodilla; inercial sin restar el estatico): 8 de 8 muertas (la de la rodilla sobrevivio la primera vez y se agrego una prueba).

## Revision ciega (revisor, 22-oct)
- Cuentas a mano propias (80 kg, 1,78 m, 40 kg): trasera 235,36 N (0,26 -> 203,98; 0,35 -> 274,59), total 1176,80 N, delantera 941,44 N; carga 0 deja la trasera igual; cadera trasera = -93,2 N·m (flexora, coherente con el titulo de Arakawa); paso 0 y CP trasero a 1,6 m -> `no_afirmable`. Todo coincide.
- Defecto real corregido: si parte de la regla saca el CP delantero del pie, esas combinaciones se descartaban y la banda quedaba mas estrecha que la regla sin decirlo (ej.: tronco -0,05, paso 1,0 -> reparto [0,767; 0,800]). Ahora el `nivel` dice «envolvente parcial: k de 9». Prueba roja d88aded6, arreglo en el commit siguiente.
- Inercial por pierna: la fuente no se contradice en las fuerzas (F_tras queda fija en 0,30 BW y la inercia vertical va entera a la delantera, que es justo «aplicar la regla al F_total»), pero el CAMPO `inercial` por pierna es una cifra que la tabla §4 declara `no_afirmable`. **Decision para Bryan**: (a) dejarlo `estimado` con el aviso (autor), o (b) `inercial` por pierna `no_afirmable` y conservar `total` y `estatico` `estimado`. Recomendacion del revisor: (b), porque es la cifra que la fuente niega expresamente y `total` ya contiene la regla aplicada al F_total.
- Anomalia 169/666 = 0,254 frente a 0,26: verificada contra el documento (§1 fila B: estrecho, inclinacion adicional, 169 N; 67,9 kg -> 666 N). El documento redondea mal; se mantiene 0,26 porque el encargo y §4 lo fijan. **Decision para Bryan**: dejar 0,26 o bajar a 0,25.

## No se comprobo
Nada con personas ni video. Los valores 0,30/0,26/0,35 no se recotejaron contra los PDF (se citan del documento). No se corrio `npm run verify` completo ni `procedencias-sujeto` (el libro del cerebro no tiene las filas aun).
