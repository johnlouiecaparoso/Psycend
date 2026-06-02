-- ============================================
-- DASHBOARD QUERIES FOR PSYCEND APPLICATION
-- ============================================
-- Run these queries in Supabase SQL Editor to test dashboard functionality
-- Replace 'YOUR_USER_ID' with actual user UUID from auth.users table

-- ============================================
-- 1. STUDENT STATISTICS QUERY
-- Gets total exams, average score, and basic stats
-- ============================================
SELECT 
    COUNT(*) as total_exams,
    ROUND(AVG(score), 2) as average_score,
    COUNT(*) * 45 as total_time_minutes -- Assuming 45 mins per exam
FROM exam_attempts 
WHERE student_id = 'YOUR_USER_ID' 
    AND submitted_at IS NOT NULL;

-- ============================================
-- 2. PERFORMANCE DATA QUERY (for charts)
-- Gets subject-wise average scores
-- ============================================
SELECT 
    s.name as subject,
    ROUND(AVG(ea.score), 2) as score
FROM exam_attempts ea
JOIN mock_exams me ON ea.mock_exam_id = me.id
JOIN subjects s ON me.subject_id = s.id
WHERE ea.student_id = 'YOUR_USER_ID' 
    AND ea.submitted_at IS NOT NULL
GROUP BY s.name
ORDER BY score DESC;

-- ============================================
-- 3. WEAK TOPICS QUERY
-- Identifies topics with lowest accuracy
-- ============================================
SELECT 
    t.name as topic,
    ROUND(
        (COUNT(CASE WHEN ea.is_correct = true THEN 1 END) * 100.0 / COUNT(*)), 
        2
    ) as accuracy
FROM exam_answers ea
JOIN exam_questions eq ON ea.question_id = eq.id
JOIN topics t ON eq.topic_id = t.id
JOIN exam_attempts att ON ea.attempt_id = att.id
WHERE att.student_id = 'YOUR_USER_ID' 
    AND att.submitted_at IS NOT NULL
GROUP BY t.name
HAVING COUNT(*) >= 3 -- Only show topics with at least 3 questions
ORDER BY accuracy ASC
LIMIT 4;

-- ============================================
-- 4. RECENT EXAMS QUERY
-- Gets last 5 exam attempts
-- ============================================
SELECT 
    ea.id,
    me.title,
    ROUND(ea.score) as score,
    ea.submitted_at::date as exam_date
FROM exam_attempts ea
JOIN mock_exams me ON ea.mock_exam_id = me.id
WHERE ea.student_id = 'YOUR_USER_ID' 
    AND ea.submitted_at IS NOT NULL
ORDER BY ea.submitted_at DESC
LIMIT 5;

-- ============================================
-- 5. STUDY STREAK QUERY
-- Calculates consecutive study days
-- ============================================
WITH distinct_dates AS (
    SELECT DISTINCT DATE(submitted_at) as study_date
    FROM exam_attempts
    WHERE student_id = 'YOUR_USER_ID' 
        AND submitted_at IS NOT NULL
    ORDER BY study_date DESC
),
streak_calculation AS (
    SELECT 
        study_date,
        study_date - (ROW_NUMBER() OVER (ORDER BY study_date) || ' days')::INTERVAL as group_base
    FROM distinct_dates
)
SELECT COUNT(*) as study_streak_days
FROM streak_calculation
WHERE group_base = (SELECT group_base FROM streak_calculation LIMIT 1);

-- ============================================
-- 6. READINESS SCORE QUERY
-- Comprehensive readiness calculation
-- ============================================
WITH subject_performance AS (
    SELECT 
        s.name as subject,
        AVG(ea.score) as avg_score
    FROM exam_attempts ea
    JOIN mock_exams me ON ea.mock_exam_id = me.id
    JOIN subjects s ON me.subject_id = s.id
    WHERE ea.student_id = 'YOUR_USER_ID' 
        AND ea.submitted_at IS NOT NULL
    GROUP BY s.name
),
weak_topics AS (
    SELECT 
        t.name as topic,
        ROUND(
            (COUNT(CASE WHEN ea.is_correct = true THEN 1 END) * 100.0 / COUNT(*)), 
            2
        ) as accuracy
    FROM exam_answers ea
    JOIN exam_questions eq ON ea.question_id = eq.id
    JOIN topics t ON eq.topic_id = t.id
    JOIN exam_attempts att ON ea.attempt_id = att.id
    WHERE att.student_id = 'YOUR_USER_ID' 
        AND att.submitted_at IS NOT NULL
    GROUP BY t.name
    HAVING COUNT(*) >= 3
),
overall_performance AS (
    SELECT COALESCE(AVG(avg_score), 0) as overall_avg_score
    FROM subject_performance
),
weak_areas_count AS (
    SELECT COUNT(*) as weak_count
    FROM weak_topics 
    WHERE accuracy < 70
)
SELECT 
    LEAST(100, ROUND(
        (op.overall_avg_score * 0.7) + 
        ((100 - (wc.weak_count * 10)) * 0.3)
    )) as readiness_score,
    op.overall_avg_score as average_performance,
    wc.weak_count as weak_areas_count
FROM overall_performance op, weak_areas_count wc;

-- ============================================
-- 7. DASHBOARD OVERVIEW (All in one query)
-- Complete dashboard data in single query
-- ============================================
WITH student_stats AS (
    SELECT 
        COUNT(*) as total_exams,
        ROUND(AVG(score), 2) as average_score
    FROM exam_attempts 
    WHERE student_id = 'YOUR_USER_ID' 
        AND submitted_at IS NOT NULL
),
performance_data AS (
    SELECT 
        s.name as subject,
        ROUND(AVG(ea.score), 2) as score
    FROM exam_attempts ea
    JOIN mock_exams me ON ea.mock_exam_id = me.id
    JOIN subjects s ON me.subject_id = s.id
    WHERE ea.student_id = 'YOUR_USER_ID' 
        AND ea.submitted_at IS NOT NULL
    GROUP BY s.name
),
weak_topics_data AS (
    SELECT 
        t.name as topic,
        ROUND(
            (COUNT(CASE WHEN ea.is_correct = true THEN 1 END) * 100.0 / COUNT(*)), 
            2
        ) as accuracy
    FROM exam_answers ea
    JOIN exam_questions eq ON ea.question_id = eq.id
    JOIN topics t ON eq.topic_id = t.id
    JOIN exam_attempts att ON ea.attempt_id = att.id
    WHERE att.student_id = 'YOUR_USER_ID' 
        AND att.submitted_at IS NOT NULL
    GROUP BY t.name
    HAVING COUNT(*) >= 3
    ORDER BY accuracy ASC
    LIMIT 4
),
recent_exams_data AS (
    SELECT 
        ea.id,
        me.title,
        ROUND(ea.score) as score,
        ea.submitted_at::date as exam_date
    FROM exam_attempts ea
    JOIN mock_exams me ON ea.mock_exam_id = me.id
    WHERE ea.student_id = 'YOUR_USER_ID' 
        AND ea.submitted_at IS NOT NULL
    ORDER BY ea.submitted_at DESC
    LIMIT 5
),
readiness_calc AS (
    SELECT 
        LEAST(100, ROUND(
            (COALESCE(AVG(avg_score), 0) * 0.7) + 
            ((100 - (COALESCE(COUNT(CASE WHEN accuracy < 70 THEN 1 END), 0) * 10)) * 0.3)
        )) as readiness_score
    FROM (
        SELECT AVG(ea.score) as avg_score
        FROM exam_attempts ea
        JOIN mock_exams me ON ea.mock_exam_id = me.id
        WHERE ea.student_id = 'YOUR_USER_ID' 
            AND ea.submitted_at IS NOT NULL
    ) performance,
    weak_topics_data
)
SELECT 
    'student_stats' as data_type,
    json_build_object(
        'total_exams', COALESCE(ss.total_exams, 0),
        'average_score', COALESCE(ss.average_score, 0),
        'study_streak', 0, -- Would need separate calculation
        'total_time', COALESCE(ss.total_exams, 0) * 45
    ) as data
FROM student_stats ss

UNION ALL

SELECT 
    'performance_data' as data_type,
    json_agg(
        json_build_object(
            'subject', subject,
            'score', score
        )
    ) as data
FROM performance_data

UNION ALL

SELECT 
    'weak_topics' as data_type,
    json_agg(
        json_build_object(
            'topic', topic,
            'accuracy', accuracy
        )
    ) as data
FROM weak_topics_data

UNION ALL

SELECT 
    'recent_exams' as data_type,
    json_agg(
        json_build_object(
            'id', id,
            'title', title,
            'score', score,
            'date', exam_date
        )
    ) as data
FROM recent_exams_data

UNION ALL

SELECT 
    'readiness_score' as data_type,
    json_build_object(
        'score', COALESCE(rc.readiness_score, 0),
        'weak_areas', ARRAY(SELECT topic FROM weak_topics_data WHERE accuracy < 70)
    ) as data
FROM readiness_calc rc;

-- ============================================
-- USAGE INSTRUCTIONS:
-- 1. Replace 'YOUR_USER_ID' with actual user UUID
-- 2. Run individual queries or the complete overview
-- 3. Use these to verify TypeScript queries work correctly
-- 4. Test with different user IDs to ensure data accuracy
-- ============================================
