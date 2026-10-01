package com.inkscribe.backend;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.web.bind.annotation.*;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    record RegisterReq(String email, String password, String shopName) {}
    record LoginReq(String email, String password) {}

    private final UserRepository users;
    private final FeedbackRepository feedbackRepo;
    private final PasswordEncoder encoder;
    private final JwtEncoder jwtEncoder;

    public AuthController(UserRepository users, FeedbackRepository feedbackRepo,
                          PasswordEncoder encoder, JwtEncoder jwtEncoder) {
        this.users = users;
        this.feedbackRepo = feedbackRepo;
        this.encoder = encoder;
        this.jwtEncoder = jwtEncoder;
    }

    private Map<String, Object> session(AppUser u) {
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .subject(String.valueOf(u.id))
                .issuedAt(now)
                .expiresAt(now.plus(7, ChronoUnit.DAYS))
                .build();
        String token = jwtEncoder.encode(
                JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims)
        ).getTokenValue();
        return Map.of("token", token, "email", u.email, "shopName", u.shopName, "shopId", u.shopId);
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody RegisterReq req) {
        String email = req.email() == null ? "" : req.email().trim().toLowerCase();
        if (!email.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$"))
            return ResponseEntity.badRequest().body(Map.of("error", "E-mail invalide"));
        if (req.password() == null || req.password().length() < 8)
            return ResponseEntity.badRequest().body(Map.of("error", "Mot de passe : 8 caractères minimum"));
        if (req.shopName() == null || req.shopName().isBlank())
            return ResponseEntity.badRequest().body(Map.of("error", "Nom de l'établissement requis"));
        if (users.existsByEmail(email))
            return ResponseEntity.status(409).body(Map.of("error", "Cet e-mail est déjà utilisé"));

        boolean first = users.count() == 0;
        AppUser u = new AppUser();
        u.email = email;
        u.passwordHash = encoder.encode(req.password());
        u.shopName = req.shopName().trim();
        u.shopId = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        users.save(u);

        // Le tout premier compte récupère les avis déjà présents (sans propriétaire)
        if (first) feedbackRepo.claimOrphans(u.id);

        return ResponseEntity.ok(session(u));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginReq req) {
        String email = req.email() == null ? "" : req.email().trim().toLowerCase();
        AppUser u = users.findByEmail(email).orElse(null);
        if (u == null || req.password() == null || !encoder.matches(req.password(), u.passwordHash))
            return ResponseEntity.status(401).body(Map.of("error", "Identifiants incorrects"));
        return ResponseEntity.ok(session(u));
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(@AuthenticationPrincipal Jwt jwt) {
        return users.findById(Long.valueOf(jwt.getSubject()))
                .<ResponseEntity<?>>map(u -> ResponseEntity.ok(
                        Map.of("email", u.email, "shopName", u.shopName, "shopId", u.shopId)))
                .orElse(ResponseEntity.status(401).build());
    }
}