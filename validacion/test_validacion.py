"""
Suite de validación independiente para SGIEE.
Compatible con pytest (`pytest validacion/test_validacion.py`)
y con la biblioteca estándar (`python validacion/test_validacion.py`).
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(__file__))
from calculos_referencia import calc_b313, calc_viii_cylinder, calc_api650_653, calc_rbi_581


class TestValidacionSGIEE(unittest.TestCase):

    def test_caso_1_tuberia_asme_b313(self):
        # P-201A: P=4500 kPa, OD=168.3 mm, API 5L Gr.B @ 90°C (S=138 MPa), E=1.0, W=1.0, Y=0.4, CA=1.5 mm, tol=12.5%
        r = calc_b313(P_kPa=4500, OD_mm=168.3, S_MPa=138.0, E=1.0, W=1.0, Y=0.4, CA_mm=1.5, mill_tol_pct=12.5)
        self.assertAlmostEqual(r["t_req_mm"], 2.708691, places=4)
        self.assertAlmostEqual(r["t_min_CA_mm"], 4.208691, places=4)
        self.assertAlmostEqual(r["t_nominal_req_mm"], 4.809933, places=4)

    def test_caso_2_recipiente_asme_viii(self):
        # V-101: P=2500 kPa, ID=1200 mm, SA-516-70 @ 120°C (S=138 MPa), E=1.0, CA=3.0 mm
        r = calc_viii_cylinder(P_kPa=2500, ID_mm=1200, S_MPa=138.0, E=1.0, CA_mm=3.0)
        self.assertAlmostEqual(r["t_req_mm"], 10.989011, places=4)
        self.assertAlmostEqual(r["t_min_CA_mm"], 13.989011, places=4)
        self.assertAlmostEqual(r["t_min_servicio_mm"], 10.989011, places=4)

    def test_caso_3_tanque_api650_api653(self):
        # TK-401 Virola 1: D=18 m, H=11.5 m, G=0.88, ASTM A36 (Sd=160, St=171, SMYS=250, UTS=400), E=0.85, CA=1.5 mm
        r = calc_api650_653(D_m=18.0, H_m=11.5, G=0.88, S_d_MPa=160.0, S_t_MPa=171.0,
                            SMYS_MPa=250.0, UTS_MPa=400.0, virola=1, E_653=0.85, CA_mm=1.5)
        self.assertAlmostEqual(r["t_d_sin_ca_mm"], 5.433120, places=4)
        self.assertAlmostEqual(r["t_req_650_mm"], 6.933120, places=4)
        self.assertAlmostEqual(r["S_653_MPa"], 171.6, places=2)
        self.assertAlmostEqual(r["t_min_servicio_mm"], 5.959819, places=4)

    def test_caso_4_rbi_api581_adelgazamiento(self):
        # V-101: t_trd=13.90, t_min=10.99, CR=0.40 mm/a, age=2.0 a, Eff=B, N=2, gff=3.06e-5, CA=185 m2, CE=450000 USD
        r = calc_rbi_581(
            t_trd_mm=13.90, t_min_mm=10.99, CR_mmpa=0.40, age_a=2.0,
            S_MPa=138.0, E_joint=1.0, SMYS_MPa=260.0, UTS_MPa=485.0,
            insp_eff="B", insp_count=2, gff=3.06e-5, F_MS=1.0,
            CA_m2=185.0, CE_val=450000.0,
        )
        # Verificar que una inspección adicional reduce Df pero mantiene Art idéntico
        r_mas_insp = calc_rbi_581(
            t_trd_mm=13.90, t_min_mm=10.99, CR_mmpa=0.40, age_a=2.0,
            S_MPa=138.0, E_joint=1.0, SMYS_MPa=260.0, UTS_MPa=485.0,
            insp_eff="B", insp_count=3, gff=3.06e-5, F_MS=1.0,
            CA_m2=185.0, CE_val=450000.0,
        )
        self.assertAlmostEqual(r["Art"], r_mas_insp["Art"], places=6)
        self.assertLess(r_mas_insp["Df"], r["Df"])
        # Verificar valor numérico exacto de referencia
        self.assertAlmostEqual(r["Df"], 1.163700, places=4)
        self.assertAlmostEqual(r["f_F"], 3.560922e-5, places=8)
        # Verificar consistencia RA = f_F * CA y RE = f_F * CE
        self.assertAlmostEqual(r["R_A"], r["f_F"] * 185.0, places=8)
        self.assertAlmostEqual(r["R_E"], r["f_F"] * 450000.0, places=6)


if __name__ == "__main__":
    r4 = calc_rbi_581(13.90, 10.99, 0.40, 2.0, 138.0, 1.0, 260.0, 485.0, "B", 2, 3.06e-5, 1.0, 185.0, 450000.0)
    print(f"[Ref RBI Caso 4] Art={r4['Art']:.6f}, SR={r4['SR']:.6f}, Df={r4['Df']:.6f}, f_F={r4['f_F']:.6e}, R_A={r4['R_A']:.6e}, R_E={r4['R_E']:.4f}")
    unittest.main(verbosity=2)
