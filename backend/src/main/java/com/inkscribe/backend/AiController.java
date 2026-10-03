package com.inkscribe.backend;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/ai")
public class AiController {
    record TextReq(String text) {}
    record ImageReq(String image) {}
    record ReplyReq(String text, String sentiment) {}

    private static final int MAX_IMAGE_CHARS = 12_000_000;   // ~9 Mo en base64

    private final AiService ai;
    public AiController(AiService ai) { this.ai = ai;  }

    private static Long uid(Jwt jwt) { return Long.valueOf(jwt.getSubject()); }
    private static ResponseEntity<?> err(int s, String m) { return ResponseEntity.status(s).body(Map.of("error", m)); }

    @PostMapping("/analyze-text")
    public ResponseEntity<?> text(@AuthenticationPrincipal Jwt jwt, @RequestBody TextReq r) {
        if (r.text() == null || r.text().isBlank() || r.text().length() > 10_000) return err(400, "Texte invalide");
        try { return ResponseEntity.ok(ai.analyzeText(uid(jwt), r.text())); }
        catch (AiService.AiException e) { return err(502, e.getMessage()); }
    }

    @PostMapping("/analyze-image")
    public ResponseEntity<?> image(@AuthenticationPrincipal Jwt jwt, @RequestBody ImageReq r) {
        String img = r.image();
        if (img == null || !img.matches("(?s)^data:image/(jpeg|jpg|png|webp);base64,.+") || img.length() > MAX_IMAGE_CHARS)
            return err(400, "Image invalide ou trop lourde");
        try { return ResponseEntity.ok(ai.analyzeImage(uid(jwt), img)); }
        catch (AiService.AiException e) { return err(502, e.getMessage()); }
    }

    @PostMapping("/reply")
    public ResponseEntity<?> reply(@AuthenticationPrincipal Jwt jwt, @RequestBody ReplyReq r) {
        if (r.text() == null || r.text().isBlank()) return err(400, "Texte invalide");
        try { return ResponseEntity.ok(Map.of("reply", ai.reply(uid(jwt), r.text(), r.sentiment() == null ? "neutral" : r.sentiment()))); }
        catch (AiService.AiException e) { return err(502, e.getMessage()); }
    }
}