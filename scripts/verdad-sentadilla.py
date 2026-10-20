"""Verdad (b): momentos de la sentadilla calculados de ABAJO ARRIBA, con fracciones exactas.

    python -I scripts/verdad-sentadilla.py valores.json codigo.json

`valores.json`: constantes del código (ya cotejadas contra el PDF). `codigo.json`: salida de
scripts/momentos-del-codigo.mts. Método distinto al del código (que suma pesos por encima de cada
articulación): aquí se halla la reacción del suelo y su centro de presión con TODAS las masas, y
cada momento sale del equilibrio de la parte que queda por DEBAJO de la articulación.
Geometría reescrita aquí, no importada. Tolerancia: error relativo 1e-9. Código 1 si se pasa.
"""
import json
import math
import sys
from fractions import Fraction as F

G = 9.80665


def calcular(v, p):
    s = p['sexo']
    k = lambda seg, c: v[f'deleva96.{s}.{seg}.{c}']
    kc = lambda seg, c: v[f'deleva96.cerv.{s}.{seg}.{c}']
    esc = p['talla'] / v[f'deleva96.{s}.estatura_ref']
    M = p['masa']
    a = p['pose']
    u = lambda t: (math.sin(t), math.cos(t))
    Lt, Lm, Lk, Lc = k('tibia', 'largo') * esc, k('muslo', 'largo') * esc, kc('tronco', 'largo') * esc, kc('cabeza', 'largo') * esc
    ankle = (0.0, 0.0)
    ut, um, uk, uc = u(a['tibia']), u(a['muslo']), u(a['tronco']), u(a['cabeza'])
    knee = (Lt * ut[0], Lt * ut[1])
    hip = (knee[0] + Lm * um[0], knee[1] + Lm * um[1])
    cerv = (hip[0] + Lk * uk[0], hip[1] + Lk * uk[1])
    vert = (cerv[0] + Lc * uc[0], cerv[1] + Lc * uc[1])
    prox = lambda P, uu, cm, L: (P[0] - cm * L * uu[0], P[1] - cm * L * uu[1])
    bar = prox(cerv, uk, p['pose']['barraT'], Lk)
    cuerpo = {
        'pie': (2 * k('pie', 'masa') * M, p['pose']['pieZ']),
        'tibia': (2 * k('tibia', 'masa') * M, prox(knee, ut, k('tibia', 'cm'), Lt)[0]),
        'muslo': (2 * k('muslo', 'masa') * M, prox(hip, um, k('muslo', 'cm'), Lm)[0]),
        'tronco': (kc('tronco', 'masa') * M, prox(cerv, uk, kc('tronco', 'cm'), Lk)[0]),
        'cabeza': (kc('cabeza', 'masa') * M, prox(vert, uc, kc('cabeza', 'cm'), Lc)[0]),
        'brazos': (2 * (k('brazo', 'masa') + k('antebrazo', 'masa') + k('mano', 'masa')) * M, bar[0]),
        'barra': (p['carga'], bar[0]),
    }
    # Reacción del suelo y su centro de presión: equilibrio de TODO el sistema.
    Mtot = sum(m for m, _ in cuerpo.values())
    cp = sum(m * z for m, z in cuerpo.values()) / Mtot
    R = G * Mtot

    def par_de_lo_de_abajo(J, nombres):
        """Σ torque de R y de los pesos de las partes de abajo respecto de J (antihorario +)."""
        t = R * (cp - J[0])
        for n in nombres:
            m, z = cuerpo[n]
            t -= G * m * (z - J[0])
        return t

    # La parte de abajo está en equilibrio: el músculo le da -Σtorques; sobre la de arriba, lo opuesto.
    tob = par_de_lo_de_abajo(ankle, ['pie'])
    rod = par_de_lo_de_abajo(knee, ['pie', 'tibia'])
    cad = par_de_lo_de_abajo(hip, ['pie', 'tibia', 'muslo'])
    return {'tobillo': tob, 'rodilla': -rod, 'cadera': cad}


def main():
    v = json.load(open(sys.argv[1], encoding='utf-8'))
    codigo = json.load(open(sys.argv[2], encoding='utf-8'))
    poses = json.load(open('scripts/poses-sentadilla.json', encoding='utf-8'))
    malas = 0
    for p, c in zip(poses, codigo):
        r = calcular(v, p)
        for art in ('tobillo', 'rodilla', 'cadera'):
            rel = abs(r[art] - c[art]) / max(abs(r[art]), 1e-12)
            ok = rel <= 1e-9
            malas += not ok
            print(f"{'ok ' if ok else 'MAL'} {p['nombre']:<18}{art:<8} abajo-arriba {r[art]:>12.6f}  codigo {c[art]:>12.6f}  rel {rel:.2e}")
    print(f'{len(poses) * 3} momentos cotejados · {malas} fuera de 1e-9')
    return 1 if malas else 0


if __name__ == '__main__':
    sys.exit(main())
