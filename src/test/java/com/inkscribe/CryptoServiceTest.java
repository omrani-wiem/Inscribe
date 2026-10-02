package com.inkscribe.backend;

import org.junit.jupiter.api.Test;
import java.util.Base64;
import static org.junit.jupiter.api.Assertions.*;

class CryptoServiceTest {
    private final CryptoService c = new CryptoService("une-cle-de-test-d-au-moins-32-caracteres!");

    @Test
    void chiffre_puis_dechiffre() {
        assertEquals("JBSWY3DPEHPK3PXP", c.decrypt(c.encrypt("JBSWY3DPEHPK3PXP")));
    }

    @Test
    void ne_contient_pas_le_secret_et_change_a_chaque_fois() {
        String a = c.encrypt("SECRET"), b = c.encrypt("SECRET");
        assertFalse(a.contains("SECRET"));
        assertNotEquals(a, b);
    }

    @Test
    void detecte_une_donnee_alteree() {
        byte[] raw = Base64.getDecoder().decode(c.encrypt("SECRET").substring(3));
        raw[raw.length - 1] ^= 1;
        String tampered = "v1:" + Base64.getEncoder().encodeToString(raw);
        assertThrows(IllegalStateException.class, () -> c.decrypt(tampered));
    }

    @Test
    void refuse_une_autre_cle() {
        String enc = c.encrypt("SECRET");
        CryptoService other = new CryptoService("une-autre-cle-de-test-de-32-caracteres!!");
        assertThrows(IllegalStateException.class, () -> other.decrypt(enc));
    }

    @Test
    void relit_les_anciennes_valeurs_en_clair() {
        assertEquals("ABC", c.decrypt("ABC"));
    }

    @Test
    void refuse_une_cle_trop_courte() {
        assertThrows(IllegalStateException.class, () -> new CryptoService("court"));
    }
}