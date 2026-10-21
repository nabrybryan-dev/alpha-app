"""Coteja las constantes de Silder 2007 y Ward 2009 del código contra el texto de los artículos.

    npx vite-node scripts/volcar-valores-sujeto.mts > valores.json
    python -I scripts/cotejar-silder-ward-con-html.py valores.json Silder.html Ward.html

Los dos artículos son manuscritos de acceso abierto de PubMed Central, guardados como HTML. Se leen
las TABLAS (no un resumen): Silder Tabla 4 (parámetros, media y sd) y Tabla 2 (ensayos, de donde sale
el dominio), Ward Tabla 3 (PCSA). Sale con código 1 si algún valor del código difiere, y con 2 si no
encuentra una tabla (un cotejo que no encuentra su fuente no puede dar verde).
"""
import html as _html
import json
import re
import sys
from html.parser import HTMLParser

MENOS = '−'


class Tablas(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tablas = []
        self._fila = None
        self._celda = None
        self._dentro = 0

    def handle_starttag(self, tag, attrs):
        if tag == 'table':
            self._dentro += 1
            self.tablas.append([])
        elif tag == 'tr' and self._dentro:
            self._fila = []
        elif tag in ('td', 'th') and self._fila is not None:
            self._celda = []

    def handle_endtag(self, tag):
        if tag in ('td', 'th') and self._celda is not None and self._fila is not None:
            self._fila.append(re.sub(r'\s+', ' ', _html.unescape(''.join(self._celda))).strip())
            self._celda = None
        elif tag == 'tr' and self._fila is not None:
            if self.tablas:
                self.tablas[-1].append(self._fila)
            self._fila = None
        elif tag == 'table':
            self._dentro = max(0, self._dentro - 1)

    def handle_data(self, data):
        if self._celda is not None:
            self._celda.append(data)


def tablas_de(ruta):
    p = Tablas()
    p.feed(open(ruta, encoding='utf-8', errors='ignore').read())
    return p.tablas


def num(s):
    return float(s.replace(MENOS, '-'))


# --- Silder, Tabla 4 -----------------------------------------------------------------------
MUSCULOS_SILDER = {
    'Rectus Femoris (RF)': 'RF',
    'Hamstrings (HAM)': 'HAM',
    'Gastrocnemius (GAS)': 'GAS',
    'Hip Flexors (HF)': 'HF',
    'Hip Extensors (HE)': 'HE',
    'Knee Flexors (KF)': 'KF',
    'Knee Extensors (KE)': 'KE',
    'Ankle Plantarflexors (PF)': 'PF',
}
PAR = re.compile(r'(-?\d+(?:\.\d+)?)\s*\(\s*(\d+(?:\.\d+)?)\s*\)')


def silder_tabla4(tablas):
    for t in tablas:
        nombres = [f[0] for f in t if f]
        if 'Rectus Femoris (RF)' in nombres and 'Hip Flexors (HF)' in nombres:
            salida = {}
            for fila in t:
                if not fila or fila[0] not in MUSCULOS_SILDER:
                    continue
                m = MUSCULOS_SILDER[fila[0]]
                pares = PAR.findall(' '.join(c for c in fila[1:] if c).replace(MENOS, '-'))
                nombre_campos = ['bp', 'bd', 'a'] if len(pares) == 3 else ['bp', 'a']
                if len(pares) not in (2, 3):
                    return None
                for campo, (media, sd) in zip(nombre_campos, pares):
                    salida[f'silder07.{m}.{campo}.media'] = float(media)
                    salida[f'silder07.{m}.{campo}.sd'] = float(sd)
            return salida
    return None


# --- Silder, Tabla 2 -----------------------------------------------------------------------
def rango(texto):
    """'-15-0' -> (-15, 0); '0' -> (0, 0); '~ -20' -> (-20, -20); '-20-20' -> (-20, 20); '~ 15' -> (15, 15)."""
    t = texto.replace(MENOS, '-').replace('~', '').replace('–', '|').replace(' ', '')
    # el guion largo (U+2013) separa los extremos; un '-' pegado a un número es su signo
    partes = t.split('|')
    if len(partes) == 2:
        return float(partes[0]), float(partes[1])
    return float(partes[0]), float(partes[0])


def silder_dominio(tablas):
    for t in tablas:
        enc = ' '.join(t[0]) if t else ''
        if 'Hip Flexion' in enc and 'Knee Flexion' in enc and 'Ankle' in enc:
            ensayos = []
            for fila in t[1:]:
                if len(fila) >= 4 and fila[0].isdigit():
                    ensayos.append((rango(fila[1]), rango(fila[2]), rango(fila[3])))
            if len(ensayos) != 15:
                return None
            hip_lo = min(e[0][0] for e in ensayos)
            hip_hi = max(e[0][1] for e in ensayos)
            rod_lo = min(e[1][0] for e in ensayos)
            rod_hi = max(e[1][1] for e in ensayos)
            tob_lo = min(e[2][0] for e in ensayos)
            tob_hi = max(e[2][1] for e in ensayos)
            # cadera hasta donde llegó con la rodilla flexionada del todo (135): el techo de los ensayos con rodilla 0-135
            con_rodilla_flexionada = max(e[0][1] for e in ensayos if e[1][1] >= rod_hi)
            # con la cadera más profunda (la de mayor techo), hasta dónde se ensayó la rodilla
            profunda = max(ensayos, key=lambda e: e[0][1])
            return {
                'silder07.dominio.caderaMin': hip_lo,
                'silder07.dominio.caderaMax': hip_hi,
                'silder07.dominio.caderaHastaConRodillaFlexionada': con_rodilla_flexionada,
                'silder07.dominio.rodillaMin': rod_lo,
                'silder07.dominio.rodillaMax': rod_hi,
                'silder07.dominio.rodillaConCaderaProfunda': profunda[1][1],
                'silder07.dominio.tobilloMin': tob_lo,
                'silder07.dominio.tobilloMax': tob_hi,
            }
    return None


# --- Ward, Tabla 3 -------------------------------------------------------------------------
MUSCULOS_WARD = {
    'Gluteus maximus': 'gluteo_mayor',
    'Rectus femoris': 'recto_femoral',
    'Vastus lateralis': 'vasto_lateral',
    'Vastus intermedius': 'vasto_intermedio',
    'Vastus medialis': 'vasto_medial',
    'Adductor magnus': 'aductor_mayor',
    'Biceps femoris long head': 'biceps_larga',
    'Biceps femoris short head': 'biceps_corta',
    'Semitendinosus': 'semitendinoso',
    'Semimembranosus': 'semimembranoso',
}
MAS_MENOS = re.compile(r'(\d+(?:\.\d+)?)\s*±\s*(\d+(?:\.\d+)?)')


def ward_tabla3(tablas):
    for t in tablas:
        enc = ' '.join(t[0]) if t else ''
        if 'PCSA' in enc and 'Pennation' in enc:
            col = next(i for i, c in enumerate(t[0]) if 'PCSA' in c)
            salida = {}
            for fila in t[1:]:
                nombre = re.sub(r'\s*\(n\s*=\s*\d+\)', '', fila[0]).strip() if fila else ''
                if nombre in MUSCULOS_WARD:
                    m = MAS_MENOS.search(fila[col])
                    if not m:
                        return None
                    salida[f'ward09.{MUSCULOS_WARD[nombre]}.pcsa.media'] = float(m.group(1))
                    salida[f'ward09.{MUSCULOS_WARD[nombre]}.pcsa.sd'] = float(m.group(2))
            return salida
    return None


def principal(ruta_valores, ruta_silder, ruta_ward):
    codigo = json.load(open(ruta_valores, encoding='utf-8'))
    fuentes = {
        'Silder Tabla 4': silder_tabla4(tablas_de(ruta_silder)),
        'Silder Tabla 2 (dominio)': silder_dominio(tablas_de(ruta_silder)),
        'Ward Tabla 3': ward_tabla3(tablas_de(ruta_ward)),
    }
    for nombre, v in fuentes.items():
        if v is None:
            print(f'No encuentro o no puedo leer: {nombre}')
            return 2
    esperado = {}
    for v in fuentes.values():
        esperado.update(v)
    ids_codigo = {k for k in codigo if k.startswith(('silder07.', 'ward09.'))}
    mal = 0
    for k, v in sorted(esperado.items()):
        if k not in codigo:
            print(f'FALTA EN EL CODIGO  {k} (el artículo dice {v})')
            mal += 1
        elif abs(codigo[k] - v) > 1e-9:
            print(f'DIFIERE  {k}: código {codigo[k]} · artículo {v}')
            mal += 1
    for k in sorted(ids_codigo - set(esperado)):
        print(f'SIN FUENTE EN EL ARTICULO  {k} (código {codigo[k]})')
        mal += 1
    print(f'{len(esperado)} valores leídos de los artículos · {len(ids_codigo)} en el código · {mal} problemas')
    # Un cotejo que no lee lo esperado da un falso verde: tiene que ser el número exacto.
    if len(esperado) != 66:
        print(f'Se esperaban 66 valores y se leyeron {len(esperado)}: el cotejo no ve toda la tabla')
        return 2
    return 1 if mal else 0


if __name__ == '__main__':
    if len(sys.argv) != 4:
        print(__doc__)
        sys.exit(2)
    sys.exit(principal(*sys.argv[1:]))
