"""Cruza el peso muerto de la app (`pesoMuerto.ts`) con las primitivas de dinamica inversa del banco virtual (`calculo/banco/fisica.py`).

    npx vite-node scripts/peso-muerto-para-el-cruce.mts > cruce-peso-muerto-app.json
    py -I scripts/cruce-peso-muerto-con-banco.py cruce-peso-muerto-app.json <ruta de lab-banco>

El banco solo trae la sentadilla (barra sobre el tronco); aqui se arma el peso muerto con SUS primitivas (posicion, aceleracion, momento sobre los de
arriba) y las mismas cuatro masas de la cadena, pero con los brazos y la barra colgando del hombro: una direccion fija (indice de angulo 4, constante)
mas el largo de cada segmento del brazo. Recibe omega y alfa ANALITICAS; la app deriva por diferencias finitas. Solo lectura sobre el banco.
Sale con codigo 1 si alguna diferencia pasa de 0,05 N.m.
"""
import json
import math
import sys

import numpy as np

ruta_json, ruta_banco = sys.argv[1], sys.argv[2]
sys.path.insert(0, ruta_banco)
from calculo.banco import deleva, fisica  # noqa: E402

TOLERANCIA = 0.05
casos = json.load(open(ruta_json, encoding="utf-8"))


def momentos_peso_muerto(sujeto, carga, brazo, theta, omega, alfa):
    """Momentos en signo APP (tobillo, rodilla, cadera), estatico y total, del peso muerto con la barra en las manos."""
    cuerpos, _ = fisica.cuerpos_de_la_sentadilla(sujeto, carga, 0.0)
    por = {c.nombre: c for c in cuerpos}
    s = sujeto.seg
    Lt, Lm, Lk = s["tibia"].largo_m, s["muslo"].largo_m, s["tronco"].largo_m
    Lb, La, Lh = s["brazo"].largo_m, s["antebrazo"].largo_m, s["mano"].largo_m
    mb, ma, mh = 2 * s["brazo"].masa_kg, 2 * s["antebrazo"].masa_kg, 2 * s["mano"].masa_kg
    d_b, d_a, d_h = s["brazo"].cm * Lb, Lb + s["antebrazo"].cm * La, Lb + La + s["mano"].cm * Lh
    d_brazos = (mb * d_b + ma * d_a + mh * d_h) / (mb + ma + mh)
    hombro = ((0, Lt), (1, Lm), (2, Lk))
    # el angulo 4 es constante: direccion hombro->mano = (sen brazo, -cos brazo) = u(pi - brazo)
    th = np.append(np.asarray(theta, float), math.pi - brazo)
    om = np.append(np.asarray(omega, float), 0.0)
    al = np.append(np.asarray(alfa, float), 0.0)
    brazos = fisica.Cuerpo("brazos", mb + ma + mh, hombro + ((4, d_brazos),))
    barra = fisica.Cuerpo("barra", carga, hombro + ((4, d_h),))
    todos = {"tibia": por["tibia"], "muslo": por["muslo"], "tronco": por["tronco"], "cabeza": por["cabeza"], "brazos": brazos, "barra": barra}
    pos, acc, alf = {}, {}, {}
    for n, c in todos.items():
        pos[n] = fisica.posicion(c.coef, th)
        acc[n] = fisica.aceleracion(c.coef, th, om, al)
        alf[n] = 0.0 if c.gira_con is None else al[c.gira_con]
    arriba = {
        "tobillo": ["tibia", "muslo", "tronco", "cabeza", "brazos", "barra"],
        "rodilla": ["muslo", "tronco", "cabeza", "brazos", "barra"],
        "cadera": ["tronco", "cabeza", "brazos", "barra"],
    }
    uniones = {"tobillo": (), "rodilla": ((0, Lt),), "cadera": ((0, Lt), (1, Lm))}
    salida = {"estatico": {}, "total": {}}
    for art, nombres in arriba.items():
        zJ, yJ = fisica.posicion(uniones[art], th) if uniones[art] else (0.0, 0.0)
        kg = [todos[n].kg for n in nombres]
        z = [pos[n][0] for n in nombres]
        y = [pos[n][1] for n in nombres]
        cero = [0.0] * len(nombres)
        est = fisica.momento_sobre_los_de_arriba(kg, z, y, cero, cero, cero, cero, zJ, yJ)
        tot = fisica.momento_sobre_los_de_arriba(
            kg, z, y, [acc[n][0] for n in nombres], [acc[n][1] for n in nombres], [todos[n].inercia for n in nombres], [alf[n] for n in nombres], zJ, yJ
        )
        sg = fisica.SIGNO_APP[art]
        salida["estatico"][art] = sg * est
        salida["total"][art] = sg * tot
    return salida


peor = 0.0
print(f"{'caso':24s} {'k':>4s} {'art':8s} {'app (rango inercial)':>26s} {'banco sag':>10s} {'banco trans':>11s} {'dif max':>8s}")
for nombre, c in casos.items():
    for marco in c["marcos"]:
        res = {}
        for eje in (0, 1):
            s = deleva.construir_sujeto(c["sexo"], c["talla"], c["masa"], eje_del_radio=eje)
            res[eje] = momentos_peso_muerto(s, c["carga"], c["brazo"], marco["theta"], marco["omega"], marco["alfa"])
        for art in ("tobillo", "rodilla", "cadera"):
            ine = [res[e]["total"][art] - res[e]["estatico"][art] for e in (0, 1)]
            app = marco[art]["inercial"]
            dif = max(abs(app["inf"] - min(ine)), abs(app["sup"] - max(ine)))
            peor = max(peor, dif)
            print(f"{nombre:24s} {marco['k']:4d} {art:8s} [{app['inf']:11.3f},{app['sup']:11.3f}] {ine[0]:10.3f} {ine[1]:11.3f} {dif:8.4f}")
        # el total estatico: la app usa g = 9,80665 y el banco 9,81; solo la parte estatica difiere
        if nombre == "A_quieto" and marco["k"] == 60:
            for art in ("tobillo", "rodilla", "cadera"):
                print(f"   total {art}: app {marco[art]['total']['valor']:.3f}  banco {res[1]['total'][art]:.3f}  (g 9.80665 vs 9.81)")
print(f"\ndiferencia maxima entre los extremos de la banda inercial de la app y el banco: {peor:.4f} N.m (tolerancia {TOLERANCIA})")
sys.exit(0 if peor <= TOLERANCIA else 1)
