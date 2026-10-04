package com.inkscribe.backend;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class DigestService {
    private static final Logger log = LoggerFactory.getLogger(DigestService.class);
    private static final DateTimeFormatter DAY =
            DateTimeFormatter.ofPattern("dd/MM/yyyy").withZone(ZoneId.of("Africa/Tunis"));

    private final UserRepository users;
    private final FeedbackRepository feedbackRepo;
    private final MailService mail;

    public DigestService(UserRepository users, FeedbackRepository feedbackRepo, MailService mail) {
        this.users = users;
        this.feedbackRepo = feedbackRepo;
        this.mail = mail;
    }

    /** Chaque lundi à 8h (heure de Tunis) : envoie le rapport aux comptes qui l'ont activé. */
    @Scheduled(cron = "0 0 8 * * MON", zone = "Africa/Tunis")
    public void weekly() {
        Instant now = Instant.now();
        for (AppUser u : users.findByDigestEnabledTrue()) {
            if (u.digestEmail == null || u.digestEmail.isBlank()) continue;
            if (u.lastDigestAt != null && u.lastDigestAt.isAfter(now.minus(6, ChronoUnit.DAYS))) continue;
            try { send(u); }
            catch (Exception e) { log.warn("Rapport hebdomadaire non envoyé pour l'utilisateur {} : {}", u.id, e.getMessage()); }
        }
    }

    public void send(AppUser u) {
        Instant now = Instant.now();
        Instant since = now.minus(7, ChronoUnit.DAYS);
        List<FeedbackRecord> week = feedbackRepo.findByOwnerIdAndTimestampAfter(u.id, since);

        long pos = week.stream().filter(f -> "positive".equals(f.sentiment)).count();
        long neu = week.stream().filter(f -> "neutral".equals(f.sentiment)).count();
        long neg = week.stream().filter(f -> "negative".equals(f.sentiment)).count();
        long review = week.stream().filter(f -> f.needsReview).count();
        long pct = week.isEmpty() ? 0 : Math.round(100.0 * neg / week.size());

        String themes = week.stream()
                .filter(f -> f.themes != null)
                .flatMap(f -> f.themes.stream())
                .collect(Collectors.groupingBy(t -> t, Collectors.counting()))
                .entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .limit(5)
                .map(e -> e.getKey() + " (" + e.getValue() + ")")
                .collect(Collectors.joining(", "));

        String negatives = week.stream()
                .filter(f -> "negative".equals(f.sentiment))
                .sorted(Comparator.comparing((FeedbackRecord f) -> f.timestamp).reversed())
                .limit(3)
                .map(f -> "  - " + shorten(f.transcription, 140))
                .collect(Collectors.joining("\n"));

        StringBuilder b = new StringBuilder();
        b.append("Résumé de la semaine pour ").append(u.shopName)
         .append(" (du ").append(DAY.format(since)).append(" au ").append(DAY.format(now)).append(")\n\n")
         .append("Total : ").append(week.size()).append(" avis\n")
         .append("Positifs : ").append(pos).append("\n")
         .append("Neutres : ").append(neu).append("\n")
         .append("Négatifs : ").append(neg).append(" (").append(pct).append(" %)\n")
         .append("À vérifier : ").append(review).append("\n")
         .append("Thèmes principaux : ").append(themes.isBlank() ? "aucun" : themes).append("\n");
        if (!negatives.isBlank()) b.append("\nDerniers avis négatifs :\n").append(negatives).append("\n");
        if (week.isEmpty()) b.append("\nAucun avis reçu cette semaine.\n");
        b.append("\nCe rapport est envoyé automatiquement chaque lundi. Vous pouvez le désactiver dans InkScribe AI, page Collecte & Import.");

        mail.send(u.digestEmail, "InkScribe AI : votre résumé hebdomadaire (" + week.size() + " avis)", b.toString());
        u.lastDigestAt = now;
        users.save(u);
    }

    private static String shorten(String s, int n) {
        if (s == null) return "";
        String t = s.replaceAll("\\s+", " ").trim();
        return t.length() > n ? t.substring(0, n) + "…" : t;
    }
}