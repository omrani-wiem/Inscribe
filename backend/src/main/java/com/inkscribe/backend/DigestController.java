package com.inkscribe.backend;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/digest")
public class DigestController {
    record Req(boolean enabled, String email) {}

    private final UserRepository users;
    private final DigestService digest;

    public DigestController(UserRepository users, DigestService digest) {
        this.users = users;
        this.digest = digest;
    }

    private AppUser me(Jwt jwt) {
        return users.findById(Long.valueOf(jwt.getSubject())).orElseThrow();
    }

    private static Map<String, Object> view(AppUser u) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("enabled", u.digestEnabled);
        m.put("email", u.digestEmail != null ? u.digestEmail : u.email);   // proposition par défaut
        m.put("lastSentAt", u.lastDigestAt == null ? null : u.lastDigestAt.toString());
        return m;
    }

    @GetMapping
    public Map<String, Object> get(@AuthenticationPrincipal Jwt jwt) {
        return view(me(jwt));
    }

    @PutMapping
    public ResponseEntity<?> save(@AuthenticationPrincipal Jwt jwt, @RequestBody Req r) {
        String email = r.email() == null ? "" : r.email().trim().toLowerCase();
        if (!email.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$"))
            return ResponseEntity.badRequest().body(Map.of("error", "Adresse e-mail invalide"));
        AppUser u = me(jwt);
        u.digestEnabled = r.enabled();
        u.digestEmail = email;
        users.save(u);
        return ResponseEntity.ok(view(u));
    }

    @PostMapping("/send")
    public ResponseEntity<?> sendNow(@AuthenticationPrincipal Jwt jwt) {
        AppUser u = me(jwt);
        if (u.digestEmail == null || u.digestEmail.isBlank())
            return ResponseEntity.badRequest().body(Map.of("error", "Enregistrez d'abord une adresse e-mail"));
        digest.send(u);
        return ResponseEntity.ok(view(u));
    }
}