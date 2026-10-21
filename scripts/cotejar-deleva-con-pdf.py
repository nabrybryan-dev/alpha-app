"""Coteja las constantes de de Leva del código contra el PDF del artículo.

    npx vite-node scripts/volcar-valores-sujeto.mts > valores.json
    python -I scripts/cotejar-deleva-con-pdf.py valores.json Leva-1996.pdf

Lee el texto del PDF (pypdf), recorta la Tabla 4 y toma por posición las filas que el código usa.
Sale con código 1 si algún valor del código difiere del PDF, y con 2 si no encuentra la tabla
(un cotejo que no encuentra su fuente no puede dar verde). El texto sale de un OCR del escaneo:
una cifra mal leída aparece aquí como diferencia y se resuelve mirando la imagen.
"""
import json
import re
import sys

import pypdf

# Orden de las filas de la primera parte de la Tabla 4 (extremos fáciles de usar).
FILAS = ['cabeza', 'tronco', 'tronco_sup', 'tronco_med', 'tronco_inf', 'brazo', 'antebrazo', 'mano', 'muslo', 'tibia_maleolo', 'pie']
NUM = r'\d+\.\d+'


def numeros(linea):
    return [float(x) for x in re.findall(NUM, linea)]


def leer_tabla(ruta):
    r = pypdf.PdfReader(ruta)
    for pag in r.pages:
        t = pag.extract_text() or ''
        if 'Table 4. Adjusted parameters' in t:
            return t
    return None


def principal(ruta_valores, ruta_pdf):
    codigo = json.load(open(ruta_valores, encoding='utf-8'))
    texto = leer_tabla(ruta_pdf)
    if texto is None:
        print('No encuentro la Tabla 4 en el PDF')
        return 2
    lineas = [l.strip() for l in texto.splitlines()]
    # Filas con 12 números: largo F/M, masa F/M, CM F/M y 6 radios de giro.
    primera = [numeros(l) for l in lineas if len(numeros(l)) == 12][: len(FILAS)]
    if len(primera) != len(FILAS):
        print(f'esperaba {len(FILAS)} filas completas y leí {len(primera)}')
        return 2
    pdf = {}
    for nombre, n in zip(FILAS, primera):
        pdf[nombre] = {'largo': (n[0], n[1]), 'masa': (n[2], n[3]), 'cm': (n[4], n[5])}
    # Tibia con extremos KJC-AJC: fila de «extremos alternativos», con un "4.8 1" partido por el OCR.
    alt = None
    for l in lineas:
        l2 = re.sub(r'(\d\.\d) (\d)(?= )', r'\1\2', l)
        n = numeros(l2)
        if n[:2] == [438.6, 440.3]:
            alt = n
            break
    if alt is None:
        print('no encuentro la fila alternativa de la tibia (438.6 440.3)')
        return 2
    pdf['tibia'] = {'largo': (alt[0], alt[1]), 'masa': (alt[2], alt[3]), 'cm': (alt[4], alt[5])}
    # Cabeza VERT-CERV y tronco CERV-MIDH: filas de extremos alternativos (largo F M, masa F M, CM F M).
    for nombre, primeros in (('cerv_cabeza', [243.7, 242.9]), ('cerv_tronco', [614.8, 603.3])):
        fila = next((numeros(l) for l in lineas if numeros(l)[:2] == primeros), None)
        if fila is None:
            print(f'no encuentro la fila alternativa {nombre}')
            return 2
        pdf[nombre] = {'largo': (fila[0], fila[1]), 'masa': (fila[2], fila[3]), 'cm': (fila[4], fila[5])}
    cuenta = 0
    malas = []
    for id_, valor in codigo.items():
        p = id_.split('.')
        if p[0] != 'deleva96':
            continue
        if p[1] == 'cerv':
            sexo = 0 if p[2] == 'm' else 1
            campo = p[4]
            bruto = pdf['cerv_' + p[3]][campo][sexo]
            esperado = bruto / 1000 if campo == 'largo' else bruto / 100
            cuenta += 1
            if abs(esperado - valor) > 1e-9:
                malas.append((id_, valor, esperado))
            continue
        sexo = 0 if p[1] == 'm' else 1
        if p[2] == 'estatura_ref':
            esperado = {0: 1.735, 1: 1.741}[sexo]  # de la leyenda de la tabla: 173.5 m (errata) y 1.741 m
        else:
            campo = p[3]
            bruto = pdf[p[2]][campo][sexo]
            esperado = bruto / 1000 if campo == 'largo' else bruto / 100
        cuenta += 1
        if abs(esperado - valor) > 1e-9:
            malas.append((id_, valor, esperado))
    ESPERADOS = 62
    if cuenta != ESPERADOS:
        print(f'se esperaban {ESPERADOS} valores de de Leva y el codigo trae {cuenta}: el cotejo no puede pasar')
        return 1
    for m in malas:
        print(f'DIFERENCIA {m[0]}: código {m[1]}, PDF {m[2]}')
    print(f'{cuenta} valores de de Leva cotejados contra el PDF · {len(malas)} diferencias')
    return 1 if malas else 0


if __name__ == '__main__':
    sys.exit(principal(sys.argv[1], sys.argv[2]))
