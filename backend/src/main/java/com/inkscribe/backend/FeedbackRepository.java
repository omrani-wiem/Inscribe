package com.inkscribe.backend;

import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.time.Instant;

public interface FeedbackRepository extends JpaRepository<FeedbackRecord, String> {

    List<FeedbackRecord> findByOwnerId(Long ownerId, Sort sort);

    @Modifying
    @Transactional
    @Query("update FeedbackRecord f set f.ownerId = :id where f.ownerId is null")
    int claimOrphans(@Param("id") Long id);

    @Query("select f.sentiment as sentiment, f.needsReview as needsReview, f.themes as themes, "
         + "f.transcription as transcription, f.timestamp as timestamp "
         + "from FeedbackRecord f where f.ownerId = :id and f.timestamp > :since")
    List<DigestRow> digestRows(
        @Param("id") Long id,
        @Param("since") Instant since
    );
}