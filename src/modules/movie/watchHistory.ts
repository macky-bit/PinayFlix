import type { SupabaseClient } from "@supabase/supabase-js";

export async function recordWatchProgress(
  supabase: SupabaseClient,
  contentId: number,
  lastPlayback: number,
  profileId: number,
): Promise<void> {
  const { error } = await supabase.rpc("record_my_watch_progress", {
    selected_content_id: contentId,
    selected_last_playback: Math.max(0, Math.floor(lastPlayback)),
    selected_profile_id: profileId,
  });

  if (error) {
    throw error;
  }
}
