-- 03_test_queries.sql

SET search_path TO videoclub;

-- 1. Members registered in the video club
SELECT
    m.member_number,
    dt.name AS document_type,
    m.document_number,
    m.first_name,
    m.last_name_1,
    m.last_name_2,
    m.birth_date,
    m.phone
FROM member m
JOIN document_type dt
    ON m.document_type_id = dt.document_type_id
ORDER BY m.member_number;

-- 2. Members and their correspondence address
SELECT
    m.member_number,
    m.first_name,
    m.last_name_1,
    m.last_name_2,
    ma.postal_code,
    ma.street,
    ma.street_number,
    ma.floor,
    ma.letter
FROM member m
LEFT JOIN member_address ma
    ON m.member_id = ma.member_id
ORDER BY m.member_number;

-- 3. Movie catalog with genre, director and synopsis
SELECT
    mv.title,
    g.name AS genre,
    CONCAT(d.first_name, ' ', d.last_name) AS director,
    mv.synopsis
FROM movie mv
JOIN genre g
    ON mv.genre_id = g.genre_id
JOIN director d
    ON mv.director_id = d.director_id
ORDER BY mv.title;

-- 4. Rental history: who rented each copy and when
SELECT
    r.rental_id,
    mv.title,
    mc.copy_number,
    m.member_number,
    CONCAT(m.first_name, ' ', m.last_name_1) AS member_name,
    r.rental_date,
    r.return_date
FROM rental r
JOIN movie_copy mc
    ON r.copy_id = mc.copy_id
JOIN movie mv
    ON mc.movie_id = mv.movie_id
JOIN member m
    ON r.member_id = m.member_id
ORDER BY r.rental_date DESC, r.rental_id DESC;

-- 5. Movies available for rent right now
SELECT
    mv.title,
    COUNT(mc.copy_id) AS available_copies
FROM movie mv
JOIN movie_copy mc
    ON mv.movie_id = mc.movie_id
LEFT JOIN rental r
    ON mc.copy_id = r.copy_id
   AND r.return_date IS NULL
WHERE r.rental_id IS NULL
GROUP BY mv.movie_id, mv.title
ORDER BY mv.title;
