"""Cruza el termino inercial de la app (`inercial.ts`) con la dinamica inversa del banco virtual (`calculo/banco/fisica.py`).

    npx vite-node scripts/inercial-para-el-cruce.mts > cruce-app.json
    py -I scripts/cruce-inercial-con-banco.py cruce-app.json <ruta de lab-banco>

El banco recibe omega y alfa ANALITICAS; la app recibe solo las muestras y deriva por diferencias finitas. Los dos usan
el mismo signo (funcional de la app). El banco con eje_del_radio 0 / 1 (sagital / transverso) acota la banda de la app.
Solo lectura sobre el banco: se importa, no se modifica. Sale con codigo 1 si alguna diferencia pasa de 0,05 N.m.
"""
import json
import sys

ruta_json, ruta_banco = sys.argv[1], sys.argv[2]
sys.path.insert(0, ruta_banco)
from calculo.banco import deleva, fisica  # noqa: E402

TOLERANCIA = 0.05  # N.m: error de las diferencias finitas con dt = 0,002 s en estos senos
casos = json.load(open(ruta_json, encoding="utf-8"))
peor = 0.0
print(f"{'caso':24s} {'k':>4s} {'art':8s} {'app (rango)':>26s} {'banco sag':>10s} {'banco trans':>11s} {'dif max':>8s}")
for nombre, c in casos.items():
    for marco in c["marcos"]:
        res = {}
        for eje in (0, 1):
            s = deleva.construir_sujeto(c["sexo"], c["talla"], c["masa"], eje_del_radio=eje)
            res[eje] = fisica.momentos(s, c["carga"], c["barraT"], marco["theta"], marco["omega"], marco["alfa"])
        for art in ("tobillo", "rodilla", "cadera"):
            ban = [float(res[e]["inercial"][art]) for e in (0, 1)]
            app = marco[art]["inercial"]
            # la banda de la app va entre los dos radios: sus extremos deben ser los dos valores del banco
            dif = max(abs(app["inf"] - min(ban)), abs(app["sup"] - max(ban)))
            peor = max(peor, dif)
            print(f"{nombre:24s} {marco['k']:4d} {art:8s} [{app['inf']:11.3f},{app['sup']:11.3f}] {ban[0]:10.3f} {ban[1]:11.3f} {dif:8.4f}")
        tot_ban = float(res[1]["total"]["cadera"])
        # el total difiere por g (9,81 en el banco, 9,80665 en la app): solo la parte estatica
        if nombre == "A_quieto" and marco["k"] == 60:
            print(f"   total cadera: app {marco['cadera']['total']['valor']:.3f}  banco {tot_ban:.3f}  (g 9.80665 vs 9.81)")
print(f"\ndiferencia maxima entre los extremos de la banda de la app y el banco: {peor:.4f} N.m (tolerancia {TOLERANCIA})")
sys.exit(0 if peor <= TOLERANCIA else 1)
