BEGIN;

DROP POLICY IF EXISTS authenticated_can_read_title_subtitles
  ON storage.objects;

CREATE POLICY authenticated_can_read_title_subtitles
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'subtitle');

WITH subtitle_assets (title, subtitle_path) AS (
  VALUES
    ('Spider-Man: Brand New Day', 'SpidermanBrandNewDay2026-en.srt'),
    ('Resident Evil', 'ResidentEvil2026-en.srt'),
    ('The End of Oak Street', 'TheEndofOakStreet2026-en.srt'),
    ('The Odyssey', 'TheOdyssey2026-en.srt'),
    ('The Love Hypothesis', 'TheLoveHypothesis2026-en.srt'),
    ('Coyote vs. Acme', 'CoyoteVSAcme2026-en.srt'),
    ('The Mongoose', 'TheMongoose2026-en.srt'),
    ('The Fix', 'TheFix2026-en.srt'),
    ('Mutiny', 'Mutiny2026-en.srt'),
    ('Colony', 'Colony2026-en.srt'),
    ('Toy Story 5', 'ToyStory52026-en.srt'),
    ('Heart of the Beast', 'HeartOfTheBeast2026-en.srt'),
    ('One Last Shot', 'OneLastShot2026-en.srt')
)
UPDATE public.content AS content
SET subtitle = subtitle_assets.subtitle_path
FROM subtitle_assets
JOIN public.category AS category
  ON category.category_name = 'Movie'
WHERE content.title = subtitle_assets.title
  AND content.category_id = category.category_id
  AND (content.subtitle IS NULL OR btrim(content.subtitle) = '');

COMMIT;
