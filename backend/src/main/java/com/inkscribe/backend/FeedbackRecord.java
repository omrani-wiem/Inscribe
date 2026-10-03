package com.inkscribe.backend;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.Instant;
import java.util.*;
import com.fasterxml.jackson.annotation.JsonIgnore;

@Entity
@Table(name = "feedback")
public class FeedbackRecord {
    @Id public String id;
    @Column(name = "created_at") public Instant timestamp;
    @Column(columnDefinition = "text") public String transcription;
    public String sentiment;
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition = "jsonb")
    public List<String> themes = new ArrayList<>();
    public Integer rating;
    @Column(columnDefinition = "text") public String summary;
    public String confidence;
    @Column(columnDefinition = "text") public String sentimentReasoning;
    public boolean needsReview;
    public String source;
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition = "jsonb")
    public Map<String, Object> respondent;
    public Boolean reviewedAndEdited;
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition = "jsonb")
    public List<String> tags;
    public String duplicateOf;
    @Column(columnDefinition = "text") public String autoReplyDraft;
    public String language;
    @Column(columnDefinition = "text") public String scannedImage;
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition = "jsonb")
    public Map<String, List<String>> keywords;
        @JsonIgnore @Column(name = "owner_id") public Long ownerId;
}