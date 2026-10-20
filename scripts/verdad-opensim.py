"""Verdad (c): momentos de la sentadilla por dinámica inversa de OpenSim 4.6 sobre un modelo plano.

    <python con opensim> scripts/verdad-opensim.py valores.json codigo.json

Modelo: cadena de articulaciones de pasador (eje z de OpenSim, x hacia adelante, y arriba) tobillo
anclado al suelo → tibia → muslo → tronco → cabeza, con la barra y los brazos como un cuerpo
soldado al tronco. Las masas, los largos y los centros de masas salen de las constantes del código
(ya cotejadas contra el PDF), pero el cálculo de los momentos es de OpenSim. Con velocidades y
aceleraciones en cero, la dinámica inversa da el par que hay que aplicar en cada coordenada.
Tolerancia fijada antes: |error| <= 1e-5 N·m. Código 1 si se pasa.
Convención: el par de OpenSim es antihorario-positivo (x adelante, y arriba): tobillo y cadera
coinciden con el signo de este dominio; la rodilla es relativa muslo-tibia y va con el signo
cambiado (extensor = -par).
"""
import json
import math
import sys

import opensim as osim

TOL = 1e-5


def momentos(v, p):
    s = p['sexo']
    k = lambda seg, c: v[f'deleva96.{s}.{seg}.{c}']
    kc = lambda seg, c: v[f'deleva96.cerv.{s}.{seg}.{c}']
    esc = p['talla'] / v[f'deleva96.{s}.estatura_ref']
    M = p['masa']
    a = p['pose']
    Lt, Lm, Lk, Lc = k('tibia', 'largo') * esc, k('muslo', 'largo') * esc, kc('tronco', 'largo') * esc, kc('cabeza', 'largo') * esc
    m = osim.Model()
    m.setGravity(osim.Vec3(0, -9.80665, 0))
    inercia = osim.Inertia(0.001, 0.001, 0.001)

    def cuerpo(nombre, kg, dist_cm):
        return osim.Body(nombre, kg, osim.Vec3(0, dist_cm, 0), inercia)

    # (nombre, masa kg, distancia del CM al origen del cuerpo medida hacia el proximal)
    tibia = cuerpo('tibia', 2 * k('tibia', 'masa') * M, (1 - k('tibia', 'cm')) * Lt)
    muslo = cuerpo('muslo', 2 * k('muslo', 'masa') * M, (1 - k('muslo', 'cm')) * Lm)
    tronco = cuerpo('tronco', kc('tronco', 'masa') * M, (1 - kc('tronco', 'cm')) * Lk)
    cabeza = cuerpo('cabeza', kc('cabeza', 'masa') * M, (1 - kc('cabeza', 'cm')) * Lc)
    kg_barra = p['carga'] + 2 * (k('brazo', 'masa') + k('antebrazo', 'masa') + k('mano', 'masa')) * M
    barra = osim.Body('barra', kg_barra, osim.Vec3(0, 0, 0), inercia)
    for c in (tibia, muslo, tronco, cabeza, barra):
        m.addBody(c)
    z0 = osim.Vec3(0, 0, 0)

    def pasador(nombre, padre, y_padre, hijo):
        j = osim.PinJoint(nombre, padre, osim.Vec3(0, y_padre, 0), z0, hijo, z0, z0)
        m.addJoint(j)
        return j

    pasador('tobillo', m.getGround(), 0.0, tibia)
    pasador('rodilla', tibia, Lt, muslo)
    pasador('cadera', muslo, Lm, tronco)
    pasador('cervical', tronco, Lk, cabeza)
    m.addJoint(osim.WeldJoint('soldadura_barra', tronco, osim.Vec3(0, Lk * (1 - a['barraT']), 0), z0, barra, z0, z0))
    st = m.initSystem()
    # Ángulo desde la vertical positivo adelante = giro horario = coordenada negativa; las relativas restan.
    q = {
        'tobillo': -a['tibia'],
        'rodilla': -(a['muslo'] - a['tibia']),
        'cadera': -(a['tronco'] - a['muslo']),
        'cervical': -(a['cabeza'] - a['tronco']),
    }
    js = m.getJointSet()
    coord = lambda n: js.get(n).get_coordinates(0)
    for n, val in q.items():
        coord(n).setValue(st, val)
    m.realizePosition(st)
    solver = osim.InverseDynamicsSolver(m)
    tau = solver.solve(st, osim.Vector(m.getNumSpeeds(), 0.0))
    # Una sola coordenada por articulación: el vector sigue el orden de la cadena (tobillo primero).
    assert tau.size() == len(q), tau.size()
    por_nombre = {n: tau.get(i) for i, n in enumerate(q)}
    return {'tobillo': por_nombre['tobillo'], 'rodilla': -por_nombre['rodilla'], 'cadera': por_nombre['cadera']}


def main():
    v = json.load(open(sys.argv[1], encoding='utf-8'))
    codigo = json.load(open(sys.argv[2], encoding='utf-8'))
    poses = json.load(open('scripts/poses-sentadilla.json', encoding='utf-8'))
    malas = 0
    for p, c in zip(poses, codigo):
        r = momentos(v, p)
        for art in ('tobillo', 'rodilla', 'cadera'):
            err = abs(r[art] - c[art])
            ok = err <= TOL
            malas += not ok
            print(f"{'ok ' if ok else 'MAL'} {p['nombre']:<18}{art:<8} opensim {r[art]:>12.6f}  codigo {c[art]:>12.6f}  err {err:.2e}")
    print(f'OpenSim {osim.__version__}: {len(poses) * 3} momentos cotejados · {malas} fuera de {TOL} N·m')
    return 1 if malas else 0


if __name__ == '__main__':
    sys.exit(main())
