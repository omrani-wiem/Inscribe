package com.inkscribe.backend;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import javax.crypto.spec.SecretKeySpec;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    record RegisterReq(String email, String password, String shopName) {}
    record LoginReq(String email, String password) {}
    record EmailReq(String email) {}
    record EmailCodeReq(String email, String code) {}
    record ResetReq(String email, String code, String newPassword) {}
    record MfaLoginReq(String mfaToken, String code) {}
    record CodeReq(String code) {}
    record DisableReq(String password, String code) {}

    private static final int MAX_FAILS = 5;
    private static final Duration LOCK = Duration.ofMinutes(15);
    private static final Duration CODE_TTL = Duration.ofMinutes(15);
    private static final int MAX_CODE_TRIES = 5;
    private static final int RESEND_SECONDS = 60;
    private static final SecureRandom RNG = new SecureRandom();

    private final UserRepository users;
    private final FeedbackRepository feedbackRepo;
    private final PasswordEncoder encoder;
    private final JwtEncoder jwtEncoder;
    private final NimbusJwtDecoder mfaDecoder;   // décode aussi les jetons "mfa" (réservés à /login/2fa)
    private final MailService mail;
    private final String dummyHash;     
    private final CryptoService crypto;         // pour répondre aussi lentement si l'e-mail n'existe pas

    public AuthController(UserRepository users, FeedbackRepository feedbackRepo, PasswordEncoder encoder,
                          JwtEncoder jwtEncoder, MailService mail, CryptoService crypto,
                          @Value("${app.jwt.secret}") String secret) {
        this.crypto = crypto;
        this.users = users;
        this.feedbackRepo = feedbackRepo;
        this.encoder = encoder;
        this.jwtEncoder = jwtEncoder;
        this.mail = mail;
        this.mfaDecoder = NimbusJwtDecoder
                .withSecretKey(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"))
                .macAlgorithm(MacAlgorithm.HS256).build();
        this.dummyHash = encoder.encode("mot-de-passe-factice");
    }

    // ---------- utilitaires ----------
    private static String norm(String e) { return e == null ? "" : e.trim().toLowerCase(); }

    private static ResponseEntity<?> err(int status, String msg) {
        return ResponseEntity.status(status).body(Map.of("error", msg));
    }

    private String encode(JwtClaimsSet claims) {
        return jwtEncoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims))
                .getTokenValue();
    }

    private Map<String, Object> session(AppUser u) {
        Instant now = Instant.now();
        String token = encode(JwtClaimsSet.builder()
                .subject(String.valueOf(u.id)).issuedAt(now).expiresAt(now.plus(7, ChronoUnit.DAYS)).build());
        return Map.of("status", "OK", "token", token, "email", u.email,
                "shopName", u.shopName, "shopId", u.shopId);
    }

    private String mfaToken(AppUser u) {
        Instant now = Instant.now();
        return encode(JwtClaimsSet.builder().subject(String.valueOf(u.id)).claim("purpose", "mfa")
                .issuedAt(now).expiresAt(now.plus(5, ChronoUnit.MINUTES)).build());
    }

    private AppUser current(Jwt jwt) {
        return users.findById(Long.valueOf(jwt.getSubject()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
    }

    // ---------- blocage après échecs ----------
    private static boolean isLocked(AppUser u) {
        return u.lockedUntil != null && u.lockedUntil.isAfter(Instant.now());
    }

    private static String lockMsg(AppUser u) {
        long min = Math.max(1, Duration.between(Instant.now(), u.lockedUntil).toMinutes() + 1);
        return "Trop de tentatives. Compte bloqué, réessayez dans " + min + " min.";
    }

    private ResponseEntity<?> failure(AppUser u, String msg) {
        u.failedAttempts++;
        if (u.failedAttempts >= MAX_FAILS) {
            u.lockedUntil = Instant.now().plus(LOCK);
            u.failedAttempts = 0;
        }
        users.save(u);
        return isLocked(u) ? err(429, lockMsg(u)) : err(401, msg);
    }

    private void success(AppUser u) {
        u.failedAttempts = 0;
        u.lockedUntil = null;
        users.save(u);
    }

    // ---------- codes envoyés par e-mail ----------
    private void sendCode(AppUser u, String purpose) {
        Instant now = Instant.now();
        // 1 e-mail par minute maximum (anti-spam)
        if (u.codeExpiresAt != null && u.codeExpiresAt.minus(CODE_TTL).plusSeconds(RESEND_SECONDS).isAfter(now)) return;
        String code = String.format("%06d", RNG.nextInt(1_000_000));
        u.codeHash = encoder.encode(code);
        u.codePurpose = purpose;
        u.codeExpiresAt = now.plus(CODE_TTL);
        u.codeAttempts = 0;
        users.save(u);
        String what = "VERIFY".equals(purpose) ? "vérification de votre e-mail" : "réinitialisation de votre mot de passe";
        mail.send(u.email, "InkScribe AI : votre code (" + code + ")",
                "Votre code pour la " + what + " : " + code + "\n\n"
                + "Il est valable 15 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.");
    }

    /** Vérifie le code ; s'il est bon, il est consommé (l'appelant doit sauvegarder). */
    private boolean checkCode(AppUser u, String purpose, String code) {
        if (u.codeHash == null || !purpose.equals(u.codePurpose)
                || u.codeExpiresAt == null || u.codeExpiresAt.isBefore(Instant.now())
                || u.codeAttempts >= MAX_CODE_TRIES || code == null) return false;
        if (!encoder.matches(code.trim(), u.codeHash)) {
            u.codeAttempts++;
            users.save(u);
            return false;
        }
        u.codeHash = null;
        u.codePurpose = null;
        u.codeExpiresAt = null;
        u.codeAttempts = 0;
        return true;
    }

    // ---------- inscription / vérification ----------
    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody RegisterReq req) {
        String email = norm(req.email());
        if (!email.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) return err(400, "E-mail invalide");
        if (req.password() == null || req.password().length() < 8)
            return err(400, "Mot de passe : 8 caractères minimum");
        if (req.shopName() == null || req.shopName().isBlank())
            return err(400, "Nom de l'établissement requis");

        AppUser u = users.findByEmail(email).orElse(null);
        if (u != null && u.emailVerified) return err(409, "Cet e-mail est déjà utilisé");

        if (u == null) {
            boolean first = users.count() == 0;
            u = new AppUser();
            u.email = email;
            u.shopId = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
            u.emailVerified = false;
            u.passwordHash = encoder.encode(req.password());
            u.shopName = req.shopName().trim();
            users.save(u);
            if (first) feedbackRepo.claimOrphans(u.id);
        } else {
            // Compte jamais vérifié : on le reprend avec les nouvelles informations
            u.passwordHash = encoder.encode(req.password());
            u.shopName = req.shopName().trim();
            users.save(u);
        }
        sendCode(u, "VERIFY");
        return ResponseEntity.ok(Map.of("status", "VERIFY_EMAIL", "email", email));
    }

    @PostMapping("/verify-email")
    public ResponseEntity<?> verifyEmail(@RequestBody EmailCodeReq req) {
        AppUser u = users.findByEmail(norm(req.email())).orElse(null);
        if (u == null || u.emailVerified || !checkCode(u, "VERIFY", req.code()))
            return err(400, "Code invalide ou expiré");
        u.emailVerified = true;
        users.save(u);
        return ResponseEntity.ok(session(u));
    }

    @PostMapping("/resend-code")
    public ResponseEntity<?> resend(@RequestBody EmailReq req) {
        users.findByEmail(norm(req.email())).filter(u -> !u.emailVerified).ifPresent(u -> sendCode(u, "VERIFY"));
        return ResponseEntity.ok(Map.of("ok", true));
    }

    // ---------- connexion ----------
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginReq req) {
        AppUser u = users.findByEmail(norm(req.email())).orElse(null);
        String pw = req.password() == null ? "" : req.password();
        if (u == null) {
            encoder.matches(pw, dummyHash);
            return err(401, "Identifiants incorrects");
        }
        if (isLocked(u)) return err(429, lockMsg(u));
        if (!encoder.matches(pw, u.passwordHash)) return failure(u, "Identifiants incorrects");

        if (!u.emailVerified) {
            sendCode(u, "VERIFY");
            return ResponseEntity.ok(Map.of("status", "VERIFY_EMAIL", "email", u.email));
        }
        if (u.totpEnabled)   // le compteur d'échecs n'est remis à zéro qu'après le code 2FA
            return ResponseEntity.ok(Map.of("status", "MFA_REQUIRED", "mfaToken", mfaToken(u)));

        success(u);
        return ResponseEntity.ok(session(u));
    }

    @PostMapping("/login/2fa")
    public ResponseEntity<?> login2fa(@RequestBody MfaLoginReq req) {
        Jwt jwt;
        try {
            jwt = mfaDecoder.decode(req.mfaToken() == null ? "" : req.mfaToken());
        } catch (Exception e) {
            return err(401, "Session expirée, reconnectez-vous.");
        }
        if (!"mfa".equals(jwt.getClaimAsString("purpose"))) return err(401, "Session invalide.");
        AppUser u = users.findById(Long.valueOf(jwt.getSubject())).orElse(null);
        if (u == null || !u.totpEnabled) return err(401, "Session invalide.");
        if (isLocked(u)) return err(429, lockMsg(u));

        long step = Totp.verify(crypto.decrypt(u.totpSecret), req.code());
        if (step < 0 || step <= u.lastTotpStep) return failure(u, "Code incorrect");
        u.lastTotpStep = step;
        success(u);
        return ResponseEntity.ok(session(u));
    }

    // ---------- mot de passe oublié ----------
    @PostMapping("/forgot")
    public ResponseEntity<?> forgot(@RequestBody EmailReq req) {
        // Même réponse que le compte existe ou non (pas d'énumération)
        users.findByEmail(norm(req.email())).ifPresent(u -> sendCode(u, "RESET"));
        return ResponseEntity.ok(Map.of("ok", true));
    }

    @PostMapping("/reset")
    public ResponseEntity<?> reset(@RequestBody ResetReq req) {
        if (req.newPassword() == null || req.newPassword().length() < 8)
            return err(400, "Mot de passe : 8 caractères minimum");
        AppUser u = users.findByEmail(norm(req.email())).orElse(null);
        if (u == null || !checkCode(u, "RESET", req.code())) return err(400, "Code invalide ou expiré");
        u.passwordHash = encoder.encode(req.newPassword());
        u.emailVerified = true;   // recevoir le code prouve la propriété de l'e-mail
        u.failedAttempts = 0;
        u.lockedUntil = null;
        users.save(u);
        return ResponseEntity.ok(Map.of("ok", true));
    }

    // ---------- profil et gestion de la 2FA (connecté) ----------
    @GetMapping("/me")
    public ResponseEntity<?> me(@AuthenticationPrincipal Jwt jwt) {
        AppUser u = current(jwt);
        return ResponseEntity.ok(Map.of("email", u.email, "shopName", u.shopName,
                "shopId", u.shopId, "totpEnabled", u.totpEnabled));
    }

        @PostMapping("/2fa/setup")
    public ResponseEntity<?> setup(@AuthenticationPrincipal Jwt jwt) {
        AppUser u = current(jwt);
        if (u.totpEnabled) return err(400, "La double authentification est déjà activée");
        String secret = Totp.newSecret();
        u.totpSecret = crypto.encrypt(secret);   // stocké chiffré
        u.lastTotpStep = 0;
        users.save(u);
        String issuer = "InkScribe AI";
        String label = URLEncoder.encode(issuer + ":" + u.email, StandardCharsets.UTF_8).replace("+", "%20");
        String uri = "otpauth://totp/" + label + "?secret=" + secret
                + "&issuer=" + URLEncoder.encode(issuer, StandardCharsets.UTF_8).replace("+", "%20");
        return ResponseEntity.ok(Map.of("secret", secret, "otpauthUri", uri));
    }

    @PostMapping("/2fa/enable")
    public ResponseEntity<?> enable(@AuthenticationPrincipal Jwt jwt, @RequestBody CodeReq req) {
        AppUser u = current(jwt);
        if (u.totpEnabled || u.totpSecret == null) return err(400, "Lancez d'abord la configuration");
        long step = Totp.verify(crypto.decrypt(u.totpSecret), req.code());
        if (step < 0) return err(400, "Code incorrect");
        u.totpEnabled = true;
        u.lastTotpStep = step;
        users.save(u);
        return ResponseEntity.ok(Map.of("ok", true));
    }

    @PostMapping("/2fa/disable")
    public ResponseEntity<?> disable(@AuthenticationPrincipal Jwt jwt, @RequestBody DisableReq req) {
        AppUser u = current(jwt);
        if (!u.totpEnabled) return err(400, "La double authentification n'est pas activée");
        if (isLocked(u)) return err(429, lockMsg(u));
        long step = Totp.verify(crypto.decrypt(u.totpSecret), req.code());
        boolean okPassword = req.password() != null && encoder.matches(req.password(), u.passwordHash);
        if (!okPassword || step < 0 || step <= u.lastTotpStep) {
            ResponseEntity<?> r = failure(u, "x");
            return isLocked(u) ? r : err(400, "Mot de passe ou code incorrect");
        }
        u.totpEnabled = false;
        u.totpSecret = null;
        u.lastTotpStep = 0;
        success(u);
        return ResponseEntity.ok(Map.of("ok", true));
    }
}