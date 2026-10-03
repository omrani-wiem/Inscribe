package com.inkscribe.backend;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import static org.junit.jupiter.api.Assertions.*;

class TotpTest {
    // "12345678901234567890" en Base32 : le secret des vecteurs de test de la RFC 6238
    private static final String RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

    @ParameterizedTest
    @CsvSource({"59,287082", "1111111109,081804", "1111111111,050471",
                "1234567890,005924", "2000000000,279037", "20000000000,353130"})
    void vecteurs_officiels_rfc6238(long time, String expected) {
        assertEquals(expected, Totp.codeAt(RFC_SECRET, time));
    }

    @Test
    void le_secret_genere_est_du_base32_de_32_caracteres() {
        assertTrue(Totp.newSecret().matches("[A-Z2-7]{32}"));
    }

    @Test
    void accepte_le_code_courant_et_refuse_un_faux_ou_trop_ancien() {
        String s = Totp.newSecret();
        long now = System.currentTimeMillis() / 1000;
        String good = Totp.codeAt(s, now);
        assertTrue(Totp.verify(s, good) > 0);
        assertEquals(-1, Totp.verify(s, good.equals("123456") ? "654321" : "123456"));
        assertEquals(-1, Totp.verify(s, Totp.codeAt(s, now - 300)));
    }

    @Test
    void refuse_les_formats_invalides() {
        String s = Totp.newSecret();
        assertEquals(-1, Totp.verify(s, "abc"));
        assertEquals(-1, Totp.verify(s, null));
        assertEquals(-1, Totp.verify(null, "123456"));
    }
}