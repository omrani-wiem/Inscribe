package com.inkscribe.backend;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.util.Map;

@Entity
@Table(name = "app_settings")
public class AppSettingsEntity {
    @Id public Long id = 1L;
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition = "jsonb")
    public Map<String, Object> data;
    @Column(columnDefinition = "text") public String keysEnc;
}