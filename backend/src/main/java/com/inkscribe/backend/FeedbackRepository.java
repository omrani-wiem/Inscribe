package com.inkscribe.backend;

import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

public interface FeedbackRepository extends JpaRepository<FeedbackRecord, String> {
    List<FeedbackRecord> findByOwnerId(Long ownerId, Sort sort);

    @Modifying
    @Transactional
    @Query("update FeedbackRecord f set f.ownerId = :id where f.ownerId is null")
    int claimOrphans(@Param("id") Long id);

        List<FeedbackRecord> findByOwnerIdAndTimestampAfter(Long ownerId, java.time.Instant since);
}