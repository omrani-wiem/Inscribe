package com.inkscribe.backend;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** Limite le nombre de requêtes par adresse IP (fenêtre glissante, en mémoire). */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private static final long AUTH_WINDOW = 10 * 60_000L;      // fenêtre de 10 minutes
    private static final long PUBLIC_WINDOW = 60 * 60_000L;    // fenêtre d'1 heure

    private final int authMax;
    private final int publicMax;
    private final Map<String, Deque<Long>> hits = new ConcurrentHashMap<>();

    public RateLimitFilter(@Value("${app.ratelimit.auth-max:30}") int authMax,
                           @Value("${app.ratelimit.public-max:10}") int publicMax) {
        this.authMax = authMax;
        this.publicMax = publicMax;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        if ("POST".equals(req.getMethod())) {
            String p = req.getRequestURI();
            boolean allowed = true;
            if (p.startsWith("/api/auth/"))
                allowed = allow("auth:" + req.getRemoteAddr(), authMax, AUTH_WINDOW);
            else if (p.startsWith("/api/public/feedback/"))
                allowed = allow("pub:" + req.getRemoteAddr(), publicMax, PUBLIC_WINDOW);
            else if (p.startsWith("/api/ai/"))
                allowed = allow("ai:" + req.getRemoteAddr(), 60, AUTH_WINDOW);
            else if (p.startsWith("/api/digest/"))
                allowed = allow("digest:" + req.getRemoteAddr(), 10, AUTH_WINDOW);
            if (!allowed) {
                res.setStatus(429);
                res.setContentType("application/json;charset=UTF-8");
                res.getWriter().write("{\"error\":\"Trop de requêtes. Réessayez dans quelques minutes.\"}");
                return;
            }
        }
        chain.doFilter(req, res);
    }

    private boolean allow(String key, int max, long windowMs) {
        long now = System.currentTimeMillis();
        if (hits.size() > 5000)   // nettoyage des IP inactives
            hits.values().removeIf(d -> { synchronized (d) { return d.isEmpty() || now - d.peekLast() > 3_600_000L; } });
        Deque<Long> q = hits.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (q) {
            while (!q.isEmpty() && now - q.peekFirst() > windowMs) q.pollFirst();
            if (q.size() >= max) return false;
            q.addLast(now);
            return true;
        }
    }
}