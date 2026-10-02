package com.inkscribe.backend;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.verify;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class AuthFlowTest {

    @Value("${local.server.port}") int port;
    @Autowired UserRepository users;
    @Autowired SettingsRepository settingsRepo;
    @MockitoBean MailService mail;   // on intercepte les e-mails pour lire les codes

    private final HttpClient client = HttpClient.newHttpClient();
    private static final String PW = "MotDePasse!123";

    // ---------- outils ----------
    private HttpResponse<String> call(String method, String path, String token, String json) throws Exception {
        HttpRequest.Builder b = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                .header("Content-Type", "application/json");
        if (token != null) b.header("Authorization", "Bearer " + token);
        b.method(method, json == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(json));
        return client.send(b.build(), HttpResponse.BodyHandlers.ofString());
    }

    private static String field(String json, String name) {
        Matcher m = Pattern.compile("\"" + name + "\"\\s*:\\s*\"([^\"]*)\"").matcher(json);
        return m.find() ? m.group(1) : null;
    }

    private static String newEmail() { return "t-" + UUID.randomUUID() + "@test.local"; }

    private static String credentials(String email, String password) {
        return "{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}";
    }

    private String lastCodeSentTo(String email) {
        ArgumentCaptor<String> body = ArgumentCaptor.forClass(String.class);
        verify(mail, atLeastOnce()).send(eq(email), anyString(), body.capture());
        List<String> all = body.getAllValues();
        Matcher m = Pattern.compile("\\b(\\d{6})\\b").matcher(all.get(all.size() - 1));
        assertTrue(m.find());
        return m.group(1);
    }

    private String register(String email) throws Exception {
        var r = call("POST", "/api/auth/register", null,
                "{\"email\":\"" + email + "\",\"password\":\"" + PW + "\",\"shopName\":\"Cafe Test\"}");
        assertEquals(200, r.statusCode());
        assertEquals("VERIFY_EMAIL", field(r.body(), "status"));
        return lastCodeSentTo(email);
    }

    /** Crée un compte vérifié et renvoie le corps de la session (token, shopId...). */
    private String verifiedAccount(String email) throws Exception {
        String code = register(email);
        var r = call("POST", "/api/auth/verify-email", null,
                "{\"email\":\"" + email + "\",\"code\":\"" + code + "\"}");
        assertEquals(200, r.statusCode());
        return r.body();
    }

    private static String feedbackJson(String id, String text) {
        return "{\"id\":\"" + id + "\",\"transcription\":\"" + text + "\",\"sentiment\":\"positive\","
             + "\"themes\":[],\"rating\":5,\"summary\":\"s\",\"confidence\":\"high\","
             + "\"sentimentReasoning\":\"r\",\"needsReview\":false}";
    }

    // ---------- tests ----------
    @Test
    void routes_protegees_refusent_sans_jeton() throws Exception {
        assertEquals(401, call("GET", "/api/feedback", null, null).statusCode());
        assertEquals(401, call("GET", "/api/settings", null, null).statusCode());
    }

    @Test
    void la_connexion_exige_la_verification_de_l_email() throws Exception {
        String email = newEmail();
        String code = register(email);

        var login = call("POST", "/api/auth/login", null, credentials(email, PW));
        assertEquals("VERIFY_EMAIL", field(login.body(), "status"));
        assertNull(field(login.body(), "token"));

        String wrong = "000000".equals(code) ? "111111" : "000000";
        assertEquals(400, call("POST", "/api/auth/verify-email", null,
                "{\"email\":\"" + email + "\",\"code\":\"" + wrong + "\"}").statusCode());

        var ok = call("POST", "/api/auth/verify-email", null,
                "{\"email\":\"" + email + "\",\"code\":\"" + code + "\"}");
        assertEquals(200, ok.statusCode());
        assertNotNull(field(ok.body(), "token"));
    }

    @Test
    void le_compte_est_bloque_apres_5_echecs() throws Exception {
        String email = newEmail();
        verifiedAccount(email);
        String wrong = credentials(email, "mauvais-mot-de-passe");
        for (int i = 1; i <= 4; i++) assertEquals(401, call("POST", "/api/auth/login", null, wrong).statusCode());
        assertEquals(429, call("POST", "/api/auth/login", null, wrong).statusCode());
        // même avec le bon mot de passe, le compte reste bloqué
        assertEquals(429, call("POST", "/api/auth/login", null, credentials(email, PW)).statusCode());
    }

    @Test
    void chaque_compte_ne_voit_que_ses_donnees() throws Exception {
        String a = field(verifiedAccount(newEmail()), "token");
        String b = field(verifiedAccount(newEmail()), "token");
        String id = "T-" + UUID.randomUUID();

        assertEquals(200, call("POST", "/api/feedback", a, feedbackJson(id, "Avis prive de A")).statusCode());
        assertTrue(call("GET", "/api/feedback", a, null).body().contains(id));
        assertFalse(call("GET", "/api/feedback", b, null).body().contains(id));

        // B ne peut ni modifier, ni écraser, ni supprimer l'avis de A
        assertEquals(404, call("PUT", "/api/feedback/" + id, b, feedbackJson(id, "pirate")).statusCode());
        assertEquals(409, call("POST", "/api/feedback", b, feedbackJson(id, "pirate")).statusCode());
        call("DELETE", "/api/feedback/" + id, b, null);
        assertTrue(call("GET", "/api/feedback", a, null).body().contains(id));

        // les réglages (clés API) sont isolés aussi
        call("PUT", "/api/settings", a, "{\"geminiApiKey\":\"cle-secrete-de-A\"}");
        assertFalse(call("GET", "/api/settings", b, null).body().contains("cle-secrete-de-A"));
    }

    @Test
    void formulaire_public_sans_connexion_rattache_au_bon_compte() throws Exception {
        String session = verifiedAccount(newEmail());
        String token = field(session, "token"), shopId = field(session, "shopId");

        assertEquals(200, call("GET", "/api/public/shop/" + shopId, null, null).statusCode());
        var sent = call("POST", "/api/public/feedback/" + shopId, null,
                "{\"text\":\"Excellent service\",\"rating\":5,\"name\":\"Sami\"}");
        assertEquals(200, sent.statusCode());
        assertTrue(call("GET", "/api/feedback", token, null).body().contains("Excellent service"));

        assertEquals(400, call("POST", "/api/public/feedback/" + shopId, null,
                "{\"text\":\"ok\",\"rating\":9}").statusCode());
        assertEquals(404, call("POST", "/api/public/feedback/inconnu", null,
                "{\"text\":\"ok\",\"rating\":5}").statusCode());
    }

    @Test
    void reinitialisation_du_mot_de_passe() throws Exception {
        String email = newEmail();
        verifiedAccount(email);

        // même réponse que le compte existe ou non (pas d'énumération)
        assertEquals(200, call("POST", "/api/auth/forgot", null, "{\"email\":\"inconnu@test.local\"}").statusCode());
        assertEquals(200, call("POST", "/api/auth/forgot", null, "{\"email\":\"" + email + "\"}").statusCode());

        String code = lastCodeSentTo(email);
        assertEquals(200, call("POST", "/api/auth/reset", null,
                "{\"email\":\"" + email + "\",\"code\":\"" + code + "\",\"newPassword\":\"NouveauMdp!456\"}").statusCode());

        assertEquals(401, call("POST", "/api/auth/login", null, credentials(email, PW)).statusCode());
        var ok = call("POST", "/api/auth/login", null, credentials(email, "NouveauMdp!456"));
        assertEquals("OK", field(ok.body(), "status"));
    }

    @Test
    void double_authentification_secret_chiffre_anti_rejeu_et_jeton_mfa_limite() throws Exception {
        String email = newEmail();
        String token = field(verifiedAccount(email), "token");

        String secret = field(call("POST", "/api/auth/2fa/setup", token, null).body(), "secret");
        long now = System.currentTimeMillis() / 1000;
        String code = Totp.codeAt(secret, now);
        assertEquals(200, call("POST", "/api/auth/2fa/enable", token, "{\"code\":\"" + code + "\"}").statusCode());

        // le secret n'est pas stocké en clair en base
        String stored = users.findByEmail(email).orElseThrow().totpSecret;
        assertTrue(stored.startsWith("v1:"));
        assertNotEquals(secret, stored);

        // la connexion exige maintenant le second facteur
        var login = call("POST", "/api/auth/login", null, credentials(email, PW));
        assertEquals("MFA_REQUIRED", field(login.body(), "status"));
        String mfaToken = field(login.body(), "mfaToken");

        // le jeton temporaire n'ouvre aucune route protégée
        assertEquals(401, call("GET", "/api/feedback", mfaToken, null).statusCode());

        // rejeu : le code déjà utilisé est refusé, celui du pas suivant est accepté
        String body = "{\"mfaToken\":\"" + mfaToken + "\",\"code\":\"";
        assertEquals(401, call("POST", "/api/auth/login/2fa", null, body + code + "\"}").statusCode());
        var ok = call("POST", "/api/auth/login/2fa", null, body + Totp.codeAt(secret, now + 30) + "\"}");
        assertEquals(200, ok.statusCode());
        assertNotNull(field(ok.body(), "token"));
    }
    @Test
    void les_cles_api_sont_chiffrees_et_jamais_renvoyees() throws Exception {
        String email = newEmail();
        String token = field(verifiedAccount(email), "token");
        call("PUT", "/api/settings", token, "{\"geminiApiKey\":\"cle-secrete-123\",\"darkMode\":true}");

        String body = call("GET", "/api/settings", token, null).body();
        assertFalse(body.contains("cle-secrete-123"));   // jamais renvoyée au client
        assertTrue(body.contains("********"));           // seulement un masque

        AppSettingsEntity e = settingsRepo.findById(users.findByEmail(email).orElseThrow().id).orElseThrow();
        assertTrue(e.keysEnc.startsWith("v1:"));         // chiffrée en base
        assertFalse(e.keysEnc.contains("cle-secrete-123"));
        assertFalse(e.data.containsKey("geminiApiKey")); // absente du JSON des réglages
    }
}