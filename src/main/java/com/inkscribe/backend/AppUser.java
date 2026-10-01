package com.inkscribe.backend;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "app_user")
public class AppUser {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;
    @Column(unique = true, nullable = false) public String email;
    @Column(nullable = false) public String passwordHash;
    public String shopName;
    @Column(unique = true, nullable = false) public String shopId;
    public Instant createdAt = Instant.now();

    // E-mail vérifié (true par défaut pour les comptes déjà existants)
    @Column(columnDefinition = "boolean default true not null")
    public boolean emailVerified = true;

    // Limitation de débit
    @Column(columnDefinition = "integer default 0 not null")
    public int failedAttempts = 0;
    public Instant lockedUntil;

    // Code e-mail en cours (vérification ou réinitialisation)
    public String codeHash;
    public String codePurpose;      // "VERIFY" ou "RESET"
    public Instant codeExpiresAt;
    @Column(columnDefinition = "integer default 0 not null")
    public int codeAttempts = 0;

    // Double authentification
    public String totpSecret;
    @Column(columnDefinition = "boolean default false not null")
    public boolean totpEnabled = false;
    @Column(columnDefinition = "bigint default 0 not null")
    public long lastTotpStep = 0;   // empêche de réutiliser un même code
}