"""
Validación independiente en Python – SGIEE (Equipos Estáticos)
Implementación independiente de ecuaciones normativas para verificación cruzada con la app web:
  1. ASME B31.3-2018 §304.1.2 (Tuberías de proceso – tramo recto)
  2. ASME VIII Div. 1-2019 UG-27(c)(1) + ASME II-D Tabla 1A (Recipientes – envolvente cilíndrica)
  3. API 650 12ª Ed. (2013) §5.6.3 & API 653 5ª Ed. (2014) §4.3.3 (Tanques – virolas del manto)
  4. API RP 580 (2016) / API RP 581 (2016) Parte 2 §4 (RBI cuantitativo por adelgazamiento generalizado)
"""
import math


def norm_cdf(x: float) -> float:
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))


def calc_b313(P_kPa: float, OD_mm: float, S_MPa: float, E: float = 1.0, W: float = 1.0,
              Y: float = 0.4, CA_mm: float = 0.0, mill_tol_pct: float = 12.5) -> dict:
    P = P_kPa / 1000.0
    t_req = (P * OD_mm) / (2.0 * (S_MPa * E * W + P * Y))
    t_m = t_req + CA_mm
    t_nom_req = t_m / (1.0 - mill_tol_pct / 100.0)
    return {
        "t_req_mm": t_req,
        "t_min_CA_mm": t_m,
        "t_nominal_req_mm": t_nom_req,
        "t_min_servicio_mm": t_req,
    }


def calc_viii_cylinder(P_kPa: float, ID_mm: float, S_MPa: float, E: float = 1.0, CA_mm: float = 0.0) -> dict:
    P = P_kPa / 1000.0
    R = ID_mm / 2.0
    t_req = (P * R) / (S_MPa * E - 0.6 * P)
    t_min_serv = max(t_req, 1.5)
    return {
        "t_req_mm": t_req,
        "t_min_CA_mm": t_req + CA_mm,
        "t_min_servicio_mm": t_min_serv,
    }


def calc_api650_653(D_m: float, H_m: float, G: float, S_d_MPa: float, S_t_MPa: float,
                    SMYS_MPa: float, UTS_MPa: float, virola: int = 1,
                    E_653: float = 0.85, CA_mm: float = 0.0) -> dict:
    t_d_sin_ca = (4.9 * D_m * (H_m - 0.3) * G) / S_d_MPa
    t_d_ca = t_d_sin_ca + CA_mm
    t_hydro = (4.9 * D_m * (H_m - 0.3)) / S_t_MPa
    t_const = 5.0 if D_m < 15 else (6.0 if D_m < 36 else (8.0 if D_m <= 60 else 10.0))
    t_req_650 = max(t_d_ca, t_hydro, t_const)

    S_653 = min(0.80 * SMYS_MPa, 0.429 * UTS_MPa) if virola <= 2 else min(0.88 * SMYS_MPa, 0.472 * UTS_MPa)
    t_653 = max((4.9 * D_m * (H_m - 0.3) * G) / (S_653 * E_653), 2.54)
    return {
        "t_d_sin_ca_mm": t_d_sin_ca,
        "t_req_650_mm": t_req_650,
        "S_653_MPa": S_653,
        "t_min_servicio_mm": t_653,
    }


def calc_rbi_581(t_trd_mm: float, t_min_mm: float, CR_mmpa: float, age_a: float,
                 S_MPa: float, E_joint: float, SMYS_MPa: float, UTS_MPa: float,
                 insp_eff: str, insp_count: int, gff: float, F_MS: float,
                 CA_m2: float, CE_val: float) -> dict:
    prior = [0.70, 0.20, 0.10]
    cond_map = {
        "A": [0.90, 0.09, 0.01],
        "B": [0.70, 0.20, 0.10],
        "C": [0.50, 0.30, 0.20],
        "D": [0.40, 0.33, 0.27],
        "E": [0.33, 0.33, 0.34],
    }
    n = 0 if insp_eff == "E" else max(0, min(6, insp_count))
    co = cond_map[insp_eff]
    I_vals = [prior[i] * (co[i] ** n) for i in range(3)]
    post = [v / sum(I_vals) for v in I_vals]

    Art = min(0.999, max(0.0, (CR_mmpa * age_a) / t_trd_mm))
    FS = ((SMYS_MPa + UTS_MPa) / 2.0) * 1.1
    SR = (S_MPa * E_joint / FS) * (t_min_mm / t_trd_mm)

    COV_dt, COV_Sf, COV_P = 0.20, 0.20, 0.05
    DS = [1.0, 2.0, 4.0]
    betas = []
    for ds in DS:
        num = 1.0 - ds * Art - SR
        den = math.sqrt((ds * Art * COV_dt) ** 2 + ((1.0 - ds * Art) * COV_Sf) ** 2 + (SR * COV_P) ** 2)
        betas.append(num / den)

    p_weighted = sum(post[i] * norm_cdf(-betas[i]) for i in range(3))
    Df = min(5000.0, max(0.1, p_weighted / 1.56e-4))
    f_F = min(1.0, gff * Df * F_MS)
    R_A = f_F * CA_m2
    R_E = f_F * CE_val
    return {
        "Art": Art,
        "FS_MPa": FS,
        "SR": SR,
        "post": post,
        "betas": betas,
        "Df": Df,
        "f_F": f_F,
        "R_A": R_A,
        "R_E": R_E,
    }
