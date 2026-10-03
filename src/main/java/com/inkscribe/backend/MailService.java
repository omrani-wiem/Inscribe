package com.inkscribe.backend;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class MailService {
    private static final Logger log = LoggerFactory.getLogger(MailService.class);

    private final JavaMailSender sender;
    private final boolean configured;
    private final String from;

    public MailService(JavaMailSender sender,
                       @Value("${spring.mail.username:}") String user,
                       @Value("${app.mail.from:}") String from,
                       @Value("${app.mail.enabled:false}") boolean enabled) {
        this.sender = sender;
        this.configured = enabled && user != null && !user.isBlank();
        this.from = (from == null || from.isBlank()) ? user : from;
    }

    public void send(String to, String subject, String body) {
        if (!configured) {
            // Mode développement : le code s'affiche dans les logs
            log.warn("\n===== [MODE DEV, e-mail non configuré] =====\nÀ : {}\nSujet : {}\n{}\n=============================================", to, subject, body);
            return;
        }
        try {
            SimpleMailMessage m = new SimpleMailMessage();
            m.setFrom(from);
            m.setTo(to);
            m.setSubject(subject);
            m.setText(body);
            sender.send(m);
        } catch (Exception e) {
            log.error("Envoi d'e-mail échoué vers {}", to, e);
        }
    }
}