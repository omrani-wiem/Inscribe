package com.inkscribe.backend;

import org.springframework.data.jpa.repository.JpaRepository;

public interface SettingsRepository extends JpaRepository<AppSettingsEntity, Long> {}