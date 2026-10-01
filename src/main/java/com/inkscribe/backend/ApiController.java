package com.inkscribe.backend;

import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import java.time.Instant;
import java.util.*;

@RestController
@RequestMapping("/api")
public class ApiController {

    private final FeedbackRepository feedbackRepo;
    private final SettingsRepository settingsRepo;
    private final UserRepository users;

    public ApiController(FeedbackRepository f, SettingsRepository s, UserRepository u) {
        this.feedbackRepo = f;
        this.settingsRepo = s;
        this.users = u;
    }

    private static Long uid(Jwt jwt) { return Long.valueOf(jwt.getSubject()); }

    private static String newId() { return "FB-" + UUID.randomUUID().toString().substring(0, 8); }

    // ---- Avis du gérant connecté ----
    @GetMapping("/feedback")
    public List<FeedbackRecord> list(@AuthenticationPrincipal Jwt jwt) {
        return feedbackRepo.findByOwnerId(uid(jwt), Sort.by(Sort.Direction.DESC, "timestamp"));
    }

    @PostMapping("/feedback")
    public ResponseEntity<FeedbackRecord> create(@AuthenticationPrincipal Jwt jwt, @RequestBody FeedbackRecord r) {
        Long me = uid(jwt);
        if (r.id == null || r.id.isBlank()) {
            r.id = newId();
        } else {
            Optional<FeedbackRecord> existing = feedbackRepo.findById(r.id);
            if (existing.isPresent() && !me.equals(existing.get().ownerId))
                return ResponseEntity.status(409).build();
        }
        if (r.timestamp == null) r.timestamp = Instant.now();
        r.ownerId = me;
        return ResponseEntity.ok(feedbackRepo.save(r));
    }

    @PutMapping("/feedback/{id}")
    public ResponseEntity<FeedbackRecord> update(@AuthenticationPrincipal Jwt jwt,
                                                 @PathVariable String id, @RequestBody FeedbackRecord r) {
        Long me = uid(jwt);
        Optional<FeedbackRecord> existing = feedbackRepo.findById(id);
        if (existing.isEmpty() || !me.equals(existing.get().ownerId)) return ResponseEntity.notFound().build();
        r.id = id;
        r.ownerId = me;
        return ResponseEntity.ok(feedbackRepo.save(r));
    }

    @DeleteMapping("/feedback/{id}")
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
        Long me = uid(jwt);
        feedbackRepo.findById(id).filter(f -> me.equals(f.ownerId)).ifPresent(feedbackRepo::delete);
    }

    // ---- Formulaire public (QR code) : un lien par établissement ----
    public record PublicSubmission(String text, Integer rating, String name) {}

    @GetMapping("/public/shop/{shopId}")
    public ResponseEntity<?> shop(@PathVariable String shopId) {
        return users.findByShopId(shopId)
                .<ResponseEntity<?>>map(u -> ResponseEntity.ok(Map.of("name", u.shopName)))
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/public/feedback/{shopId}")
    public ResponseEntity<?> submit(@PathVariable String shopId, @RequestBody PublicSubmission s) {
        AppUser owner = users.findByShopId(shopId).orElse(null);
        if (owner == null) return ResponseEntity.status(404).body(Map.of("error", "Établissement inconnu"));
        if (s.text() == null || s.text().isBlank() || s.text().length() > 2000)
            return ResponseEntity.badRequest().body(Map.of("error", "Texte invalide"));
        if (s.rating() != null && (s.rating() < 1 || s.rating() > 5))
            return ResponseEntity.badRequest().body(Map.of("error", "Note invalide"));

        FeedbackRecord r = new FeedbackRecord();
        r.id = newId();
        r.ownerId = owner.id;
        r.timestamp = Instant.now();
        r.transcription = s.text().trim();
        r.sentiment = "neutral";
        r.rating = s.rating();
        r.summary = r.transcription.length() > 100 ? r.transcription.substring(0, 100) + "…" : r.transcription;
        r.confidence = "medium";
        r.sentimentReasoning = "Reçu via le formulaire public, pas encore analysé.";
        r.needsReview = true;
        r.source = "QR Form";
        if (s.name() != null && !s.name().isBlank()) r.respondent = Map.of("name", s.name().trim());
        feedbackRepo.save(r);
        return ResponseEntity.ok(Map.of("ok", true));
    }

    // ---- Réglages du gérant connecté ----
    @GetMapping("/settings")
    public Map<String, Object> getSettings(@AuthenticationPrincipal Jwt jwt) {
        return settingsRepo.findById(uid(jwt)).map(e -> e.data).orElse(Map.of());
    }

    @PutMapping("/settings")
    public Map<String, Object> putSettings(@AuthenticationPrincipal Jwt jwt, @RequestBody Map<String, Object> data) {
        Long me = uid(jwt);
        AppSettingsEntity e = settingsRepo.findById(me).orElseGet(() -> {
            AppSettingsEntity n = new AppSettingsEntity();
            n.id = me;
            return n;
        });
        e.data = data;
        return settingsRepo.save(e).data;
    }
}
