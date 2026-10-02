package com.inkscribe.backend;

import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;
import java.util.*;

/** Range les clés API chiffrées côté serveur ; le client ne reçoit qu'un masque. */
@Service
public class KeyStore {
    public static final List<String> NAMES = List.of("geminiApiKey", "mistralApiKey", "groqApiKey", "ocrSpaceApiKey");
    public static final String MASK = "********";

    private final CryptoService crypto;
    private final ObjectMapper mapper;

    public KeyStore(CryptoService crypto, ObjectMapper mapper) {
        this.crypto = crypto;
        this.mapper = mapper;
    }

    @SuppressWarnings("unchecked")
    public Map<String, String> load(AppSettingsEntity e) {
        if (e == null || e.keysEnc == null) return new HashMap<>();
        return mapper.readValue(crypto.decrypt(e.keysEnc), Map.class);
    }

    /** Sort les clés de `incoming`, les chiffre dans l'entité, et garde le reste dans e.data. */
    public void absorb(AppSettingsEntity e, Map<String, Object> incoming) {
        Map<String, String> keys = load(e);
        Map<String, Object> clean = new HashMap<>(incoming == null ? Map.of() : incoming);
        for (String n : NAMES) {
            if (!clean.containsKey(n)) continue;
            Object v = clean.remove(n);
            String s = v == null ? "" : v.toString().trim();
            if (s.startsWith("*")) continue;            // le masque renvoyé tel quel : on ne change rien
            if (s.isEmpty()) keys.remove(n); else keys.put(n, s);
        }
        e.keysEnc = keys.isEmpty() ? null : crypto.encrypt(mapper.writeValueAsString(keys));
        e.data = clean;
    }

    /** Réglages tels que le client les voit : clés remplacées par un masque. */
    public Map<String, Object> view(AppSettingsEntity e) {
        Map<String, Object> out = new HashMap<>(e.data == null ? Map.of() : e.data);
        Map<String, String> keys = load(e);
        for (String n : NAMES) out.put(n, keys.containsKey(n) ? MASK : "");
        return out;
    }
}