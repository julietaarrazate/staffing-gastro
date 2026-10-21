"""Hash de contraseñas con bcrypt directo (2026-10-21, reemplazo de passlib).

Los hashes de abajo los generó passlib 1.7.4 con bcrypt 4.2.1, como los que
ya están guardados en la base: tienen que seguir verificando.
"""

from app.core.security import hash_password, verify_password

PASSLIB_HASH = "$2b$12$w9CvdnQM9ku3F6RjKGsMe.QB0X2w2VGVzFAIOh2YOGyDxp2YiLpxq"
PASSLIB_HASH_LARGA = "$2b$12$m8QWAQeAdUPepx8c3uwLxuji.SmN.1PJbKDxKTLcKO.VyJaY/MMG6"
LARGA = "ñ" * 50  # 100 bytes en UTF-8, más que los 72 que mira bcrypt


def test_hashes_viejos_de_passlib_siguen_verificando():
    assert verify_password("Clave-de-prueba-1", PASSLIB_HASH)
    assert not verify_password("Clave-de-prueba-2", PASSLIB_HASH)


def test_contrasena_larga_guardada_con_passlib_sigue_verificando():
    # passlib cortaba en 72 bytes sin avisar; bcrypt 5 da error si no se corta.
    assert verify_password(LARGA, PASSLIB_HASH_LARGA)


def test_hash_nuevo_es_bcrypt_y_verifica():
    hashed = hash_password("Otra-clave-segura")
    assert hashed.startswith("$2b$12$")
    assert verify_password("Otra-clave-segura", hashed)
    assert not verify_password("otra-clave-segura", hashed)


def test_contrasena_de_128_caracteres_no_rompe():
    largo = "a" * 128
    assert verify_password(largo, hash_password(largo))


def test_hash_invalido_no_verifica_en_vez_de_romper():
    assert not verify_password("lo-que-sea", "no-es-un-hash")
