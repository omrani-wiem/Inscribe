package com.inkscribe.backend;

import java.time.Instant;
import java.util.List;

/** Les seuls champs dont le rapport a besoin (pas d'image). */
public interface DigestRow {
    String getSentiment();
    Boolean getNeedsReview();
    List<String> getThemes();
    String getTranscription();
    Instant getTimestamp();
}