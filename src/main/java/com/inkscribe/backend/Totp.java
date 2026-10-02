package com.inkscribe.backend;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.security.MessageDigest;
import java.security.SecureRandom;

/** TOTP (RFC 6238) : codes à 6 chiffres, pas de 30 s, HMAC-SHA1. */
public final class Totp {
    private static final String ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    private Totp() {}

    public static String newSecret() {
        byte[] b = new byte[20];
        new SecureRandom().nextBytes(b);
        return base32(b);
    }

    private static String base32(byte[] data) {
        StringBuilder sb = new StringBuilder();
        int buffer = 0, bits = 0;
        for (byte x : data) {
            buffer = (buffer << 8) | (x & 0xff);
            bits += 8;
            while (bits >= 5) {
                sb.append(ALPHABET.charAt((buffer >> (bits - 5)) & 31));
                bits -= 5;
            }
        }
        if (bits > 0) sb.append(ALPHABET.charAt((buffer << (5 - bits)) & 31));
        return sb.toString();
    }

    private static byte[] decode(String s) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        int buffer = 0, bits = 0;
        for (char c : s.toUpperCase().toCharArray()) {
            int v = ALPHABET.indexOf(c);
            if (v < 0) continue;
            buffer = (buffer << 5) | v;
            bits += 5;
            if (bits >= 8) {
                out.write((buffer >> (bits - 8)) & 0xff);
                bits -= 8;
            }
        }
        return out.toByteArray();
    }

    private static int code(byte[] key, long step) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA1");
        mac.init(new SecretKeySpec(key, "HmacSHA1"));
        byte[] h = mac.doFinal(ByteBuffer.allocate(8).putLong(step).array());
        int off = h[h.length - 1] & 0x0f;
        int bin = ((h[off] & 0x7f) << 24) | ((h[off + 1] & 0xff) << 16)
                | ((h[off + 2] & 0xff) << 8) | (h[off + 3] & 0xff);
        return bin % 1_000_000;
    }

    /** Renvoie le pas de temps validé, ou -1 si le code est faux. Tolère ±30 s d'écart d'horloge. */
    public static long verify(String secret, String input) {
        if (secret == null || input == null) return -1;
        String c = input.replaceAll("\\s", "");
        if (!c.matches("\\d{6}")) return -1;
        try {
            byte[] key = decode(secret);
            long now = System.currentTimeMillis() / 30000;
            for (long s = now - 1; s <= now + 1; s++) {
                String expected = String.format("%06d", code(key, s));
                if (MessageDigest.isEqual(expected.getBytes(), c.getBytes())) return s;
            }
        } catch (Exception ignored) { }
        return -1;
    }

        /** Code TOTP à un instant donné (utile pour les tests). */
    public static String codeAt(String secret, long epochSeconds) {
        try {
            return String.format("%06d", code(decode(secret), epochSeconds / 30));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}