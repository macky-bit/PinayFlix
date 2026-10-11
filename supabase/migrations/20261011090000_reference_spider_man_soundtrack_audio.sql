UPDATE public.soundtrack
SET stream_link = 'https://qmzjtijlmcwojwxbrvuj.supabase.co/storage/v1/object/public/stream_link/Suite%20New%20Day%20from%20Spider-Man%20Brand%20New%20Day%20Soundtrack.mp3'
WHERE content_id = 1
  AND lower(trim(song_title)) = 'suite new day';

UPDATE storage.buckets
SET public = true
WHERE id = 'stream_link';

DROP POLICY IF EXISTS soundtrack_stream_authenticated_read ON storage.objects;
CREATE POLICY soundtrack_stream_authenticated_read
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'stream_link');
