import assert from "node:assert/strict"

import { readFileSync } from "node:fs"

import test from "node:test"

import {
  COMMENT_MAX_LENGTH,
  categoryMatchesMedia,
  isCommentVisible,
  normalizeComment,
  optimisticReaction,
  persistReaction,
  requireAuthenticatedUserId,
} from "../src/modules/movie/engagement.ts"

import { createEmptyReactionCounts } from "../src/shared/reactions.ts"

import { selectBestLyricsMatch } from "../src/modules/movie/lyrics.ts"

import {
  PLAYBACK_SOURCE_BY_QUALITY,
  playbackQualitiesForPlan,
  preferredPlaybackQuality,
} from "../src/modules/movie/playbackQuality.ts"

import { getMemberDestination } from "../src/lib/authRouting.ts"

import {
  MAX_SEARCH_LENGTH,
  normalizeSearchQuery,
} from "../src/modules/dashboard/search.ts"

import {
  MAX_PROFILE_NAME_LENGTH,
  normalizeProfileName,
} from "../src/modules/profile/profileName.ts"

import {
  MAX_FEEDBACK_DESCRIPTION_LENGTH,
  MAX_FEEDBACK_IMAGE_BYTES,
  MAX_FEEDBACK_SUBJECT_LENGTH,
  validateFeedbackImage,
  validateFeedbackText,
} from "../src/modules/help/feedback.ts"

test("admin last-login timestamps are synchronized from Supabase Auth", () => {
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/20261010234500_sync_admin_last_login.sql",

      import.meta.url,
    ),

    "utf8",
  )

  assert.match(migration, /after update of last_sign_in_at on auth\.users/i)

  assert.match(migration, /last_login = new\.last_sign_in_at/i)

  assert.match(migration, /auth_user\.last_sign_in_at/i)
})

test("creates a reaction optimistically", async () => {
  const result = optimisticReaction(createEmptyReactionCounts(), null, "love")

  assert.equal(result.myReaction, "love")

  assert.equal(result.counts.love, 1)

  const calls: string[] = []

  await persistReaction(
    {
      remove: async () => {
        calls.push("remove")
      },

      insert: async (reaction) => {
        calls.push(`insert:${reaction}`)
      },
    },

    "user-1",

    null,

    "love",
  )

  assert.deepEqual(calls, ["insert:love"])
})

test("subscription plans expose only their entitled playback qualities", () => {
  assert.deepEqual(playbackQualitiesForPlan("Basic"), [480])

  assert.deepEqual(playbackQualitiesForPlan("Standard"), [480, 720])

  assert.deepEqual(playbackQualitiesForPlan("Premium"), [480, 720, 1080])

  assert.deepEqual(playbackQualitiesForPlan(null), [480])

  assert.equal(preferredPlaybackQuality("Basic"), 480)

  assert.equal(preferredPlaybackQuality("Standard"), 720)

  assert.equal(preferredPlaybackQuality("Premium"), 1080)
})

test("each playback quality resolves to its matching local video asset", () => {
  assert.match(PLAYBACK_SOURCE_BY_QUALITY[480], /480MovieStudioLogo\.mp4$/)

  assert.match(PLAYBACK_SOURCE_BY_QUALITY[720], /720MovieStudioLogo\.mp4$/)

  assert.match(PLAYBACK_SOURCE_BY_QUALITY[1080], /1080MovieStudioLogo\.mp4$/)
})

test("studio clip completion returns to artwork without stopping the movie timer", () => {
  const playerSource = readFileSync(
    new URL("../src/modules/movie/fixedscreen/movie.tsx", import.meta.url),

    "utf8",
  )

  assert.match(
    playerSource,

    /onEnded=\{\(\) => \{[\s\S]*setClipEnded\(true\)[\s\S]*setPlaying\(true\)/,
  )

  assert.match(
    playerSource,

    /!clipStarted \|\| clipEnded \? styles\.playerVideoHidden/,
  )
})

test("subscribed members choose a profile after login", () => {
  assert.equal(getMemberDestination(true), "profileSelect")

  assert.equal(getMemberDestination(false), "subscription")

  assert.equal(getMemberDestination(null), "subscription")

  assert.equal(getMemberDestination(undefined), "subscription")
})

test("dashboard search normalizes and limits user queries", () => {
  assert.equal(MAX_SEARCH_LENGTH, 25)

  assert.equal(normalizeSearchQuery("  star   wars  "), "star wars")

  assert.equal(normalizeSearchQuery("x".repeat(120)).length, MAX_SEARCH_LENGTH)
})

test("profile names are trimmed, normalized, and limited", () => {
  assert.equal(normalizeProfileName("  Movie   Night  "), "Movie Night")

  assert.throws(() => normalizeProfileName("   "), /Enter a profile name/)

  assert.throws(
    () => normalizeProfileName("x".repeat(MAX_PROFILE_NAME_LENGTH + 1)),

    /50 characters or fewer/,
  )
})

test("changes a reaction without changing the aggregate total", async () => {
  const counts = createEmptyReactionCounts()

  counts.love = 1

  const result = optimisticReaction(counts, "love", "funny")

  assert.equal(result.counts.love, 0)

  assert.equal(result.counts.funny, 1)

  assert.equal(
    Object.values(result.counts).reduce((sum, count) => sum + count, 0),

    1,
  )

  const calls: string[] = []

  await persistReaction(
    {
      remove: async () => {
        calls.push("remove")
      },

      insert: async (reaction) => {
        calls.push(`insert:${reaction}`)
      },
    },

    "user-1",

    "love",

    "funny",
  )

  assert.deepEqual(calls, ["remove", "insert:funny"])
})

test("removes the current reaction", async () => {
  const counts = createEmptyReactionCounts()

  counts.upvote = 1

  const result = optimisticReaction(counts, "upvote", null)

  assert.equal(result.myReaction, null)

  assert.equal(result.counts.upvote, 0)

  const calls: string[] = []

  await persistReaction(
    {
      remove: async () => {
        calls.push("remove")
      },

      insert: async (reaction) => {
        calls.push(`insert:${reaction}`)
      },
    },

    "user-1",

    "upvote",

    null,
  )

  assert.deepEqual(calls, ["remove"])
})

test("rejects mutations without an authenticated app user", async () => {
  assert.throws(() => requireAuthenticatedUserId(null), /Sign in/)

  assert.equal(requireAuthenticatedUserId("user-1"), "user-1")

  await assert.rejects(
    () =>
      persistReaction(
        { remove: async () => undefined, insert: async () => undefined },

        null,

        null,

        "love",
      ),

    /Sign in/,
  )
})

test("trims comment submissions and rejects empty posts", () => {
  assert.equal(normalizeComment("  Great ending!  "), "Great ending!")

  assert.throws(() => normalizeComment("  \n "), /before posting/)
})

test("accepts long comments through the supported character limit", () => {
  const longComment = "x".repeat(501)

  assert.equal(normalizeComment(longComment), longComment)

  assert.throws(
    () => normalizeComment("x".repeat(COMMENT_MAX_LENGTH + 1)),

    /limited to/i,
  )
})

test("hides moderated comments from public views while preserving admin visibility", () => {
  assert.equal(isCommentVisible("Active"), true)

  assert.equal(isCommentVisible("Hidden"), false)

  assert.equal(isCommentVisible("Hidden", true), true)
})

test("resolves the production Movie and TV Series category names", () => {
  assert.equal(categoryMatchesMedia("Movie", false), true)

  assert.equal(categoryMatchesMedia("Movies", false), true)

  assert.equal(categoryMatchesMedia("TV Series", true), true)

  assert.equal(categoryMatchesMedia("TV Shows", true), true)

  assert.equal(categoryMatchesMedia("Movie", true), false)
})

test("migration preserves owner and moderator authorization policies", () => {
  const sql = readFileSync(
    new URL(
      "../supabase/migrations/20261007090000_connect_watch_engagement.sql",

      import.meta.url,
    ),

    "utf8",
  )

  assert.match(sql, /reaction_owner_insert/i)

  assert.match(sql, /reaction_owner_delete/i)

  assert.match(sql, /comment_manager_can_delete_reactions/i)

  assert.match(sql, /reaction_content_user_unique/i)

  assert.match(sql, /reaction_admin_update/i)

  assert.match(sql, /reaction_status_check/i)

  assert.match(
    sql,

    /grant execute on function public\.is_admin_role\(varchar\) to anon/i,
  )

  assert.match(sql, /content_comment_owner_insert/i)

  assert.match(sql, /content_comment_owner_or_admin_delete/i)

  assert.match(sql, /content_comment_admin_update/i)

  assert.match(sql, /lower\(status\) = 'active'/i)

  assert.match(sql, /is_admin_role\('commentManager'/i)
})

test("comment owners can edit without overriding moderation status", () => {
  const sql = readFileSync(
    new URL(
      "../supabase/migrations/20261007103000_allow_owner_manage_content_comments.sql",

      import.meta.url,
    ),

    "utf8",
  )

  assert.match(sql, /content_comment_owner_update/i)

  assert.match(sql, /protect_content_comment_moderation_fields/i)

  assert.match(sql, /Only community moderators can change comment status/i)
})

test("content comments preserve and safely expose their author profile", () => {
  const sql = readFileSync(
    new URL(
      "../supabase/migrations/20261009194500_connect_comment_author_profiles.sql",

      import.meta.url,
    ),

    "utf8",
  )

  assert.match(sql, /add column if not exists member_profile_id bigint/i)

  assert.match(sql, /profile\.user_id = content_comment\.user_id/i)

  assert.match(sql, /Comment authorship cannot be changed/i)

  assert.match(sql, /get_content_comments_with_authors/i)

  assert.match(sql, /lower\(comment\.status\) = 'active'/i)
})

test("opening video runs after a profile card is clicked instead of login", () => {
  const appSource = readFileSync(
    new URL("../src/App.tsx", import.meta.url),

    "utf8",
  )

  const loginSource = readFileSync(
    new URL("../src/modules/login/LoginPage.tsx", import.meta.url),

    "utf8",
  )

  const profileSelectSource = readFileSync(
    new URL(
      "../src/modules/profileSelect/ProfileSelectPage.tsx",

      import.meta.url,
    ),

    "utf8",
  )

  assert.match(appSource, /setActiveProfile\(profile\)[\s\S]*beginOpening\(\)/)

  assert.match(appSource, /page === "opening"[\s\S]*<OpeningVideo/)

  assert.doesNotMatch(loginSource, /requestOpeningVideo|onAuthenticated/)

  assert.match(profileSelectSource, /onClick=\{\(\) => onSelect\(profile\)\}/)

  assert.doesNotMatch(
    profileSelectSource,

    /Choose a profile|continueBtn|setSelected/,
  )
})

test("dashboard requires the viewer profile selected for the current session", () => {
  const appSource = readFileSync(
    new URL("../src/App.tsx", import.meta.url),

    "utf8",
  )

  assert.match(
    appSource,

    /page === "dashboard" && activeProfile === null[\s\S]*setPage\("profileSelect"\)/,
  )

  assert.match(appSource, /page === "dashboard" && activeProfile &&/)

  assert.match(
    appSource,

    /onBack=\{\(\) => setPage\(activeProfile \? "dashboard" : "profileSelect"\)\}/,
  )
})

test("opening video uses the landscape desktop media asset", () => {
  const openingStyles = readFileSync(
    new URL("../src/modules/auth/openingVideo.module.css", import.meta.url),

    "utf8",
  )

  const openingSource = readFileSync(
    new URL("../src/modules/auth/OpeningVideo.tsx", import.meta.url),

    "utf8",
  )

  assert.match(openingSource, /OPENING_VIDEO_BUCKET = "streamflix-media"/)

  assert.match(
    openingSource,

    /OPENING_VIDEO_PATH = "opening\/streamflix-opening-desktop\.mp4"/,
  )

  assert.match(openingSource, /\.getPublicUrl\(OPENING_VIDEO_PATH\)/)

  assert.match(openingStyles, /\.video\s*\{[\s\S]*object-fit:\s*contain/i)

  assert.match(openingStyles, /\.video\s*\{[\s\S]*width:\s*100%/i)

  assert.match(openingStyles, /\.video\s*\{[\s\S]*height:\s*auto/i)
})

test("help feedback validates image attachments", () => {
  assert.doesNotThrow(() =>
    validateFeedbackImage({ type: "image/png", size: 1024 } as File),
  )

  assert.throws(
    () =>
      validateFeedbackImage({ type: "application/pdf", size: 1024 } as File),

    /PNG, JPG, WebP, or GIF/,
  )

  assert.throws(
    () =>
      validateFeedbackImage({
        type: "image/jpeg",

        size: MAX_FEEDBACK_IMAGE_BYTES + 1,
      } as File),

    /5 MB or smaller/,
  )
})

test("help feedback enforces subject and description character limits", () => {
  assert.doesNotThrow(() =>
    validateFeedbackText(
      "S".repeat(MAX_FEEDBACK_SUBJECT_LENGTH),

      "D".repeat(MAX_FEEDBACK_DESCRIPTION_LENGTH),
    ),
  )

  assert.throws(
    () =>
      validateFeedbackText(
        "S".repeat(MAX_FEEDBACK_SUBJECT_LENGTH + 1),

        "Issue",
      ),

    /Subject must be 50 characters or fewer/,
  )

  assert.throws(
    () =>
      validateFeedbackText(
        "Issue",

        "D".repeat(MAX_FEEDBACK_DESCRIPTION_LENGTH + 1),
      ),

    /Description must be 200 characters or fewer/,
  )
})

test("help feedback migration creates a private owner-scoped attachment bucket", () => {
  const sql = readFileSync(
    new URL(
      "../supabase/migrations/20261007120000_connect_help_feedback_attachments.sql",

      import.meta.url,
    ),

    "utf8",
  )

  assert.match(sql, /'feedback-attachments'[\s\S]*false/i)

  assert.match(sql, /feedback_owner_upload_attachments/i)

  assert.match(sql, /feedback_owner_delete_attachments/i)

  assert.match(sql, /feedback_attachment_admin_read/i)

  assert.match(sql, /user_can_insert_own_feedback/i)

  assert.match(sql, /is_admin_role\('feedbackManager'/i)
})

test("subscription profile flow uses only active subscription records", () => {
  const sql = readFileSync(
    new URL(
      "../supabase/migrations/20261007130000_align_active_subscription_profile_flow.sql",

      import.meta.url,
    ),

    "utf8",
  )

  assert.match(sql, /get_my_subscription_state/i)

  assert.match(sql, /get_my_member_profile_context/i)

  assert.match(sql, /create_my_member_profile/i)

  assert.match(sql, /lower\(membership\.status\) = 'active'/i)

  assert.match(
    sql,

    /membership\.ends_at is null or membership\.ends_at > now\(\)/i,
  )

  assert.match(sql, /plan\.max_user/i)
})

test("Stripe billing is webhook-authoritative and idempotent", () => {
  const sql = readFileSync(
    new URL(
      "../supabase/migrations/20261009090000_connect_stripe_billing.sql",

      import.meta.url,
    ),

    "utf8",
  )

  assert.match(sql, /stripe_webhook_event/i)

  assert.match(sql, /on conflict \(event_id\) do nothing/i)

  assert.match(sql, /process_stripe_billing_event/i)

  assert.match(sql, /subscription_stripe_price_unique/i)

  assert.match(
    sql,

    /revoke execute on function public\.select_subscription_plan/i,
  )

  assert.match(sql, /from public, anon, authenticated/i)
})

test("Stripe webhook verifies signatures before mutating billing records", () => {
  const source = readFileSync(
    new URL("../supabase/functions/stripe-webhook/index.ts", import.meta.url),

    "utf8",
  )

  assert.match(source, /constructEventAsync/i)

  assert.match(source, /Stripe-Signature/i)

  assert.match(source, /STRIPE_WEBHOOK_SIGNING_SECRET/i)

  assert.match(source, /process_stripe_billing_event/i)
})

test("Checkout sessions use server-owned recurring prices and authenticated users", () => {
  const source = readFileSync(
    new URL(
      "../supabase/functions/create-checkout-session/index.ts",

      import.meta.url,
    ),

    "utf8",
  )

  assert.match(source, /serviceClient\.auth\.getUser/i)

  assert.match(source, /STRIPE_PRICE_BASIC/i)

  assert.match(source, /STRIPE_PRICE_STANDARD/i)

  assert.match(source, /STRIPE_PRICE_PREMIUM/i)

  assert.match(source, /mode: "subscription"/i)

  assert.doesNotMatch(source, /selected_subscription_id/)
})

test("active Stripe subscriptions can replace their plan without a duplicate checkout", () => {
  const checkoutSource = readFileSync(
    new URL(
      "../supabase/functions/create-checkout-session/index.ts",

      import.meta.url,
    ),

    "utf8",
  )

  const webhookSource = readFileSync(
    new URL("../supabase/functions/stripe-webhook/index.ts", import.meta.url),

    "utf8",
  )

  const syncSql = readFileSync(
    new URL(
      "../supabase/migrations/20261010220000_manage_stripe_subscription.sql",

      import.meta.url,
    ),

    "utf8",
  )

  assert.match(checkoutSource, /stripe\.subscriptions\.update/)

  assert.match(checkoutSource, /id: subscription\.items\.data\[0\]\.id/)

  assert.match(checkoutSource, /price: selectedPrice/)

  assert.match(checkoutSource, /proration_behavior: "none"/)

  assert.match(checkoutSource, /cancel_at_period_end: false/)

  assert.doesNotMatch(checkoutSource, /An active subscription already exists/)

  assert.match(webhookSource, /sync_stripe_subscription_plan/)

  assert.match(syncSql, /SET subscription_id = selected_plan_id/i)

  assert.match(syncSql, /FROM PUBLIC, anon, authenticated/i)
})

test("membership cancellation is authenticated, immediate, and returns to subscribe", () => {
  const cancelSource = readFileSync(
    new URL(
      "../supabase/functions/cancel-subscription/index.ts",

      import.meta.url,
    ),

    "utf8",
  )

  const accountSource = readFileSync(
    new URL("../src/modules/account/components.tsx", import.meta.url),

    "utf8",
  )

  const appSource = readFileSync(
    new URL("../src/App.tsx", import.meta.url),
    "utf8",
  )

  assert.match(cancelSource, /serviceClient\.auth\.getUser/)

  assert.match(cancelSource, /stripe\.subscriptions\.cancel/)

  assert.match(cancelSource, /invoice_now: false, prorate: false/)

  assert.match(accountSource, /functions\.invoke\("cancel-subscription"/)

  assert.match(accountSource, /onSubscriptionCancelled\(\)/)

  assert.match(appSource, /setPlan\(null\)/)

  assert.match(appSource, /setPage\("subscription"\)/)
})

test("movie soundtrack uses database audio and lyrics instead of placeholders", () => {
  const playerSource = readFileSync(
    new URL("../src/modules/movie/fixedscreen/movie.tsx", import.meta.url),

    "utf8",
  )

  const soundtrackSource = readFileSync(
    new URL("../src/modules/movie/soundtrack.ts", import.meta.url),

    "utf8",
  )

  assert.match(playerSource, /ref=\{soundtrackAudioRef\}/)

  assert.match(playerSource, /audio\.src = track\.audioUrl/)

  assert.match(playerSource, /toggleSoundtrackPlayback\(track\)/)

  assert.match(playerSource, /`Pause \$\{track\.title\}`/)

  assert.doesNotMatch(playerSource, /Open \$\{track\.title\} on YouTube/)

  assert.match(playerSource, /lyricsTrack\.lyrics/)

  assert.doesNotMatch(
    playerSource,

    /Main Theme|Featured Track|Soundtrack source pending/,
  )

  assert.match(soundtrackSource, /\.from\("soundtrack"\)/)

  assert.match(soundtrackSource, /stream_link/)

  assert.match(soundtrackSource, /createSignedUrl/)

  assert.match(soundtrackSource, /SPIDER_MAN_SOUNDTRACK_OBJECT/)

  assert.match(soundtrackSource, /lyrics_instrumental/)

  assert.match(soundtrackSource, /lyrics_source_url/)

  assert.match(playerSource, /track\.instrumental/)
})

test("soundtrack lyrics are cached in a private provenance-aware bucket", () => {
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/20261010231500_store_soundtrack_lyrics.sql",

      import.meta.url,
    ),

    "utf8",
  )

  const syncSource = readFileSync(
    new URL("../scripts/sync-soundtrack-lyrics.mjs", import.meta.url),

    "utf8",
  )

  assert.match(migration, /'soundtrack-lyrics'/)

  assert.match(migration, /false,\s*524288/)

  assert.match(
    migration,
    /TO authenticated[\s\S]*FOR SELECT|FOR SELECT[\s\S]*TO authenticated/i,
  )

  assert.match(migration, /lyrics_source_url text/i)

  assert.match(syncSource, /loadTrackLyrics/)

  assert.match(syncSource, /lyrics\.txt/)

  assert.match(syncSource, /lyrics\.lrc/)

  assert.match(syncSource, /\$\{rangeStart\}-\$\{rangeEnd\}_content/)

  assert.match(syncSource, /\$\{contentId\}-\$\{slugify\(title\)\}/)

  assert.match(syncSource, /SUPABASE_SERVICE_ROLE_KEY/)

  assert.doesNotMatch(syncSource, /VITE_SUPABASE_SERVICE/)
})

test("movie refresher resolves and caches verified Wikipedia content", () => {
  const movieSource = readFileSync(
    new URL("../src/modules/movie/fixedscreen/movie.tsx", import.meta.url),

    "utf8",
  )

  const clientSource = readFileSync(
    new URL("../src/modules/movie/refresher.ts", import.meta.url),

    "utf8",
  )

  const functionSource = readFileSync(
    new URL(
      "../supabase/functions/wikipedia-refresher/index.ts",

      import.meta.url,
    ),

    "utf8",
  )

  const migration = readFileSync(
    new URL(
      "../supabase/migrations/20261010224500_add_wikipedia_refresher_cache.sql",

      import.meta.url,
    ),

    "utf8",
  )

  assert.match(clientSource, /wikipedia-refresher/)

  assert.match(movieSource, /loadWikipediaRefresher/)

  assert.match(movieSource, /Source: \{refresherState\.result\.sourceName\}/)

  assert.doesNotMatch(movieSource, /waiting for a verified refresher source/i)

  assert.match(functionSource, /\.from\("content"\)/)

  assert.match(
    functionSource,
    /en\.wikipedia\.org\/w\/rest\.php\/v1\/search\/page/,
  )

  assert.match(functionSource, /previous_film_refresher/)

  assert.match(migration, /source_url text/i)

  assert.match(migration, /key_events jsonb/i)
})

test("refresher video hands off to the selected studio clip without advancing movie progress", () => {
  const movieSource = readFileSync(
    new URL("../src/modules/movie/fixedscreen/movie.tsx", import.meta.url),

    "utf8",
  )

  const videoSource = readFileSync(
    new URL("../src/modules/movie/refresherVideo.ts", import.meta.url),

    "utf8",
  )

  const storagePolicy = readFileSync(
    new URL(
      "../supabase/migrations/20261010230000_allow_authenticated_refresher_video_read.sql",

      import.meta.url,
    ),

    "utf8",
  )

  assert.match(videoSource, /refresher_video_url/)

  assert.match(videoSource, /refresher_all\.mp4/)

  assert.match(videoSource, /createSignedUrl/)

  assert.match(movieSource, /Play Refresher/)

  assert.match(movieSource, />\s*Skip Refresher\s*</)

  assert.match(movieSource, /if \(!playing \|\| refresherVideoPlaying\) return/)

  assert.match(movieSource, /finishRefresherVideo\(\)/)

  assert.match(
    movieSource,

    /const finishRefresherVideo[\s\S]*setRefresherVideoPlaying\(false\)[\s\S]*setClipEnded\(false\)[\s\S]*setPlaying\(true\)/,
  )

  assert.match(storagePolicy, /TO authenticated/i)

  assert.match(storagePolicy, /bucket_id = 'refresher_video_url'/i)
})

test("lyrics lookup accepts an exact title and artist match", () => {
  const match = selectBestLyricsMatch(
    "Breaking Bad Main Title Theme",

    "Dave Porter - Topic",

    [
      {
        id: 1,

        trackName: "Breaking Bad Main Title Theme",

        artistName: "Dave Porter",

        albumName: "Breaking Bad",

        instrumental: true,

        plainLyrics: null,

        syncedLyrics: null,
      },
    ],
  )

  assert.equal(match?.id, 1)
})

test("lyrics lookup rejects generic-title matches from unrelated artists", () => {
  const match = selectBestLyricsMatch("Opening", "SonySoundtracksVEVO", [
    {
      id: 2,

      trackName: "Opening",

      artistName: "Unrelated Artist",

      albumName: "Different Film",

      instrumental: false,

      plainLyrics: "Wrong lyrics",

      syncedLyrics: null,
    },
  ])

  assert.equal(match, null)
})

test("Help Center renders at true 100 percent while preserving all actions", () => {
  const pageSource = readFileSync(
    new URL("../src/modules/help/HelpPage.tsx", import.meta.url),

    "utf8",
  )

  const viewSource = readFileSync(
    new URL("../src/modules/help/components.tsx", import.meta.url),

    "utf8",
  )

  assert.match(pageSource, /style\.setProperty\("zoom", "1"\)/)

  assert.match(pageSource, /style\.removeProperty\("zoom"\)/)

  assert.match(viewSource, />\s*Back to StreamFlix\s*</)

  assert.match(viewSource, />\s*Contact Us\s*</)
})

test("profile PINs are persisted and gate locked profile selection", () => {
  const profileSource = readFileSync(
    new URL("../src/modules/profile/components.tsx", import.meta.url),

    "utf8",
  )

  const selectorSource = readFileSync(
    new URL(
      "../src/modules/profileSelect/ProfileSelectPage.tsx",

      import.meta.url,
    ),

    "utf8",
  )

  assert.match(profileSource, /set_my_member_profile_pin/)

  assert.match(profileSource, /selected_pin:\s*selectedPin/)

  assert.match(profileSource, /Remove PIN/)

  assert.match(selectorSource, /row\.has_pin/)

  assert.match(selectorSource, /if \(profile\.hasPin\)/)

  assert.match(selectorSource, /verify_my_member_profile_pin/)

  assert.match(selectorSource, /if \(result\?\.is_verified\)/)
})

test("profile PIN verification is owner-scoped, hashed, and rate limited", () => {
  const sql = readFileSync(
    new URL(
      "../supabase/migrations/20261010103000_secure_member_profile_pin_flow.sql",

      import.meta.url,
    ),

    "utf8",
  )

  assert.match(sql, /profile\.pin_hash is not null as has_pin/i)

  assert.match(sql, /account\.auth_user_id = \(select auth\.uid\(\)\)/i)

  assert.match(sql, /for update of profile/i)

  assert.match(
    sql,

    /extensions\.crypt\(selected_pin, stored_pin_hash\) = stored_pin_hash/i,
  )

  assert.match(sql, /next_failed_attempts >= 5/i)

  assert.match(sql, /interval '15 minutes'/i)

  assert.match(
    sql,

    /revoke all on function public\.verify_my_member_profile_pin/i,
  )

  assert.match(sql, /to authenticated, postgres, service_role/i)
})

test("normal movie playback records watch history and the profile loads it", () => {
  const appSource = readFileSync(
    new URL("../src/App.tsx", import.meta.url),
    "utf8",
  )

  const movieSource = readFileSync(
    new URL("../src/modules/movie/fixedscreen/movie.tsx", import.meta.url),

    "utf8",
  )

  const profileSource = readFileSync(
    new URL("../src/modules/profile/components.tsx", import.meta.url),

    "utf8",
  )

  assert.match(movieSource, /recordWatchProgress\(/)

  assert.match(movieSource, /playbackSeconds - previousSync\.playbackSeconds/)

  assert.match(appSource, /onProgress=\{\(progress\) => addOrUpdateContinue/)

  assert.match(profileSource, /get_my_watch_history/)

  assert.match(profileSource, /delete_my_watch_history_entry/)

  assert.match(profileSource, /useContinueWatching\(null\)/)

  assert.doesNotMatch(profileSource, /const HISTORY_ITEMS/)
})

test("watch history RPCs are authenticated and owner scoped", () => {
  const sql = readFileSync(
    new URL(
      "../supabase/migrations/20261010201500_watch_history_profile_integration.sql",

      import.meta.url,
    ),

    "utf8",
  )

  assert.match(sql, /security definer/gi)

  assert.match(sql, /account\.auth_user_id = auth\.uid\(\)/i)

  assert.match(
    sql,
    /grant execute on function public\.record_my_watch_progress/i,
  )

  assert.match(sql, /grant execute on function public\.get_my_watch_history/i)

  assert.match(
    sql,

    /grant execute on function public\.delete_my_watch_history_entry/i,
  )
})

test("profile menu routes every account action through one handler", () => {
  const dashboardSource = readFileSync(
    new URL("../src/modules/dashboard/components.tsx", import.meta.url),

    "utf8",
  )

  assert.match(dashboardSource, /label: "Profile", page: "profile"/)

  assert.match(dashboardSource, /label: "Account", page: "account"/)

  assert.match(dashboardSource, /label: "Settings", page: "settings"/)

  assert.match(dashboardSource, /label: "Help Center", page: "help"/)

  assert.match(
    dashboardSource,

    /onClick=\{\(\) => navigateFromAccountMenu\(item\.page\)\}/,
  )

  assert.match(
    dashboardSource,

    /onClick=\{\(\) => navigateFromAccountMenu\("account"\)\}/,
  )
})

test("Account and Settings share the Settings-style toggle switch", () => {
  const accountSource = readFileSync(
    new URL("../src/modules/account/components.tsx", import.meta.url),

    "utf8",
  )

  const settingsSource = readFileSync(
    new URL("../src/modules/settings/SettingsPage.tsx", import.meta.url),

    "utf8",
  )

  const toggleSource = readFileSync(
    new URL("../src/components/ToggleSwitch.tsx", import.meta.url),

    "utf8",
  )

  assert.match(accountSource, /ToggleSwitch/)

  assert.match(settingsSource, /ToggleSwitch/)

  assert.doesNotMatch(accountSource, /className="relative w-10 h-5/)

  assert.match(toggleSource, /role="switch"/)

  assert.match(toggleSource, /styles\.toggleThumbOn/)
})

test("Profile no longer duplicates autoplay settings", () => {
  const profileSource = readFileSync(
    new URL("../src/modules/profile/components.tsx", import.meta.url),

    "utf8",
  )

  assert.doesNotMatch(profileSource, /Autoplay Next Episode/)

  assert.doesNotMatch(profileSource, /Autoplay Previews/)

  assert.doesNotMatch(profileSource, /function Toggle\(/)

  assert.doesNotMatch(profileSource, /Subtitle Appearance/)

  assert.doesNotMatch(profileSource, /function SubtitleIcon/)
})

test("kids profiles do not render maturity rating controls", () => {
  const profileSource = readFileSync(
    new URL("../src/modules/profile/components.tsx", import.meta.url),

    "utf8",
  )

  assert.match(profileSource, /!profile\.isKids &&/)

  assert.match(
    profileSource,

    /profileIdentity && !profileIdentity\.isKids &&/,
  )
})

test("profile settings delete the selected owned profile safely", () => {
  const appSource = readFileSync(
    new URL("../src/App.tsx", import.meta.url),
    "utf8",
  )

  const profileSource = readFileSync(
    new URL("../src/modules/profile/components.tsx", import.meta.url),

    "utf8",
  )

  const sql = readFileSync(
    new URL(
      "../supabase/migrations/20261010213000_delete_my_member_profile.sql",

      import.meta.url,
    ),

    "utf8",
  )

  assert.match(profileSource, /delete_my_member_profile/)

  assert.match(profileSource, /Enter the profile name below to confirm/)

  assert.match(profileSource, /placeholder=\{profile\.name\}/)

  assert.match(appSource, /onProfileDeleted=\{\(\) => \{/)

  assert.match(appSource, /setPage\("profileSelect"\)/)

  assert.match(sql, /account\.auth_user_id = auth\.uid\(\)/i)

  assert.match(sql, /profile\.user_id = current_user_id/i)

  assert.match(sql, /active_profile_count <= 1/i)

  assert.match(sql, /is_active = false/i)

  assert.match(sql, /revoke all on function public\.delete_my_member_profile/i)
})

test("profile preferences persist and enable Save for non-name changes", () => {
  const profileSource = readFileSync(
    new URL("../src/modules/profile/components.tsx", import.meta.url),

    "utf8",
  )

  assert.match(profileSource, /PROFILE_PREFERENCES_KEY/)

  assert.match(profileSource, /writeProfilePreferences\(profile\.id/)

  assert.match(profileSource, /lang !== initialPreferences\.language/)

  assert.match(profileSource, /maturity !== initialPreferences\.maturity/)

  assert.match(profileSource, /\.from\("avatar"\)\s*\.list/)

  assert.match(profileSource, /supabase\.rpc\("update_my_member_profile"/)

  assert.match(profileSource, /avatarPath !== profile\.avatarPath/)

  assert.match(profileSource, /aria-pressed=\{avatarPath === avatar\.path\}/)

  assert.match(profileSource, /aria-labelledby="choose-avatar-title"/)

  assert.match(profileSource, /aria-haspopup="dialog"/)
})

test("Clear History removes remote history and local continue-watching data", () => {
  const settingsSource = readFileSync(
    new URL("../src/modules/settings/SettingsPage.tsx", import.meta.url),

    "utf8",
  )

  const storeSource = readFileSync(
    new URL(
      "../src/modules/dashboard/continueWatchingStore.ts",

      import.meta.url,
    ),

    "utf8",
  )

  const sql = readFileSync(
    new URL(
      "../supabase/migrations/20261011095000_clear_my_watch_history.sql",

      import.meta.url,
    ),

    "utf8",
  )

  assert.match(settingsSource, /supabase\.rpc\("clear_my_watch_history"\)/)

  assert.match(settingsSource, /role="alertdialog"/)

  assert.match(settingsSource, /aria-modal="true"/)

  assert.match(settingsSource, /Yes, clear history/)

  assert.match(settingsSource, /clearContinueWatching\(\)/)

  assert.match(
    settingsSource,
    /window\.alert\("Your watch history has been cleared\."\)/,
  )

  assert.match(storeSource, /export function clearContinueWatching\(\)/)

  assert.match(sql, /delete from public\.watch_history/i)

  assert.match(sql, /account\.auth_user_id = auth\.uid\(\)/i)

  assert.match(sql, /grant execute.*authenticated/is)
})

test("kids profiles require Standard or Premium subscriptions", () => {
  const profileSelectSource = readFileSync(
    new URL(
      "../src/modules/profileSelect/ProfileSelectPage.tsx",

      import.meta.url,
    ),

    "utf8",
  )

  const sql = readFileSync(
    new URL(
      "../supabase/migrations/20261010214500_standard_premium_kids_profiles.sql",

      import.meta.url,
    ),

    "utf8",
  )

  assert.match(sql, /lower\(plan\.plan_name\) IN \('standard', 'premium'\)/i)

  assert.match(
    sql,

    /lower\(plan_row\.plan_name\) NOT IN \('standard', 'premium'\)/i,
  )

  assert.match(sql, /Kids profiles require a Standard or Premium plan/i)

  assert.doesNotMatch(sql, /\('basic', 'premium'\)/i)

  assert.match(profileSelectSource, /context\?\.allows_kids \?\? false/)

  assert.match(profileSelectSource, /allowsKidsProfiles &&/)
})

test("subscription downgrades disable overflow profiles without deleting them", () => {
  const profileSelectSource = readFileSync(
    new URL(
      "../src/modules/profileSelect/ProfileSelectPage.tsx",

      import.meta.url,
    ),

    "utf8",
  )

  const profileSettingsSource = readFileSync(
    new URL("../src/modules/profile/components.tsx", import.meta.url),

    "utf8",
  )

  const sql = readFileSync(
    new URL(
      "../supabase/migrations/20261010223000_disable_profiles_beyond_plan_limit.sql",

      import.meta.url,
    ),

    "utf8",
  )

  assert.match(sql, /row_number\(\) OVER/i)

  assert.match(
    sql,
    /ORDER BY profile\.display_order, profile\.member_profile_id/i,
  )

  assert.match(sql, /<= COALESCE\(entitlement\.max_user, 0\) AS is_entitled/i)

  assert.match(sql, /AND profile\.is_active/i)

  assert.match(profileSelectSource, /disabled=\{!profile\.isEntitled\}/)

  assert.match(profileSelectSource, /Unavailable on this plan/)

  assert.match(profileSettingsSource, /Disabled by current plan/)

  assert.match(profileSettingsSource, /delete_my_member_profile/)
})

test("admin subscription records are view-only", () => {
  const userManagerSource = readFileSync(
    new URL(
      "../src/modules/admin/userManager/UserManagerView.tsx",

      import.meta.url,
    ),

    "utf8",
  )

  const masterAdminSource = readFileSync(
    new URL(
      "../src/modules/admin/masterAdmin/pages/UsersPage.tsx",

      import.meta.url,
    ),

    "utf8",
  )

  const subscriptionsTab = userManagerSource.slice(
    userManagerSource.indexOf("function SubscriptionsTab"),

    userManagerSource.indexOf("function PlansTab"),
  )

  assert.match(subscriptionsTab, /action="view"/)

  assert.doesNotMatch(subscriptionsTab, /action="edit"/)

  assert.doesNotMatch(subscriptionsTab, /Edit Subscription/)

  assert.doesNotMatch(subscriptionsTab, /subscriptionState\.update/)

  assert.doesNotMatch(masterAdminSource, /Cancel subscription\?/)

  assert.doesNotMatch(masterAdminSource, /setCancelSubId/)
})

test("admin user-management navigation does not expose watch history", () => {
  const userManagerSource = readFileSync(
    new URL(
      "../src/modules/admin/userManager/UserManagerView.tsx",

      import.meta.url,
    ),

    "utf8",
  )

  const masterAdminSource = readFileSync(
    new URL(
      "../src/modules/admin/masterAdmin/pages/UsersPage.tsx",

      import.meta.url,
    ),

    "utf8",
  )

  const userManagerRoot = userManagerSource.slice(
    userManagerSource.indexOf("export default function UserManagerView"),
  )

  const masterTabs = masterAdminSource.slice(
    masterAdminSource.indexOf("const TABS"),

    masterAdminSource.indexOf("const paginatedSubscribers"),
  )

  assert.doesNotMatch(userManagerRoot, /label: "Watch History"/)

  assert.doesNotMatch(userManagerRoot, /tab === "watch"/)

  assert.doesNotMatch(masterTabs, /label: "Watch History"/)
})

test("content management ranks Supabase stream totals in a filterable top ten", () => {
  const contentManagerSource = readFileSync(
    new URL(
      "../src/modules/admin/contentManager/ContentManagerView.tsx",

      import.meta.url,
    ),

    "utf8",
  )

  const repositorySource = readFileSync(
    new URL(
      "../src/modules/admin/data/supabaseAdminRepository.ts",

      import.meta.url,
    ),

    "utf8",
  )

  const seedMigration = readFileSync(
    new URL(
      "../supabase/migrations/20261010233000_seed_dashboard_top_stream_counts.sql",

      import.meta.url,
    ),

    "utf8",
  )

  assert.match(contentManagerSource, /Top 10 streamed titles/)

  assert.match(contentManagerSource, /right\.totalStreams - left\.totalStreams/)

  assert.match(contentManagerSource, /\.slice\(0, 10\)/)

  assert.match(contentManagerSource, /\["movies", "Movies"\]/)

  assert.match(contentManagerSource, /\["tv", "TV Series"\]/)

  assert.match(
    repositorySource,
    /totalStreams: number\(row\.total_streams_count\)/,
  )

  assert.match(seedMigration, /row_number\(\) OVER/i)

  assert.match(
    seedMigration,
    /SET total_streams_count = seeded_counts\.stream_count/i,
  )
})

test("dashboard footer keeps only support and legal links", () => {
  const componentsSource = readFileSync(
    new URL("../src/modules/dashboard/components.tsx", import.meta.url),

    "utf8",
  )

  const dashboardSource = readFileSync(
    new URL("../src/modules/dashboard/Dashboard.tsx", import.meta.url),

    "utf8",
  )

  for (const label of [
    "Help Center",

    "Terms of Use",

    "Privacy",

    "Cookie Preferences",

    "Contact Us",
  ]) {
    assert.match(componentsSource, new RegExp(`"${label}"`))
  }

  for (const removedLabel of [
    "Audio Description",

    "Gift Cards",

    "Media Centre",

    "Investor Relations",

    "Jobs",

    "Corporate Information",
  ]) {
    assert.doesNotMatch(componentsSource, new RegExp(`"${removedLabel}"`))
  }

  assert.match(componentsSource, /onNavigateHelp/)

  assert.match(
    dashboardSource,
    /onNavigateHelp=\{\(\) => onNavigate\("help"\)\}/,
  )
})

test("TMDB search disables titles outside the available Supabase catalog", () => {
  const searchSource = readFileSync(
    new URL("../src/modules/dashboard/SearchResultsPage.tsx", import.meta.url),

    "utf8",
  )

  const cardSource = readFileSync(
    new URL("../src/modules/dashboard/components.tsx", import.meta.url),

    "utf8",
  )

  assert.match(searchSource, /\.from\("content"\)/)

  assert.match(searchSource, /\.eq\("availability_status", "available"\)/)

  assert.match(searchSource, /\.in\("tmdb_id", tmdbIds\)/)

  assert.match(searchSource, /availabilityKey\(show\.id, show\.mediaType/)

  assert.match(searchSource, /unavailable=\{!show\.available\}/)

  assert.match(cardSource, /aria-disabled=\{unavailable \|\| undefined\}/)

  assert.match(cardSource, /onClick=\{unavailable \? undefined/)

  assert.match(cardSource, />Unavailable</)
})

test("dashboard search does not render a close button", () => {
  const dashboardSource = readFileSync(
    new URL("../src/modules/dashboard/components.tsx", import.meta.url),

    "utf8",
  )

  assert.doesNotMatch(dashboardSource, /aria-label="Close search"/)

  assert.match(dashboardSource, /if \(event\.key === "Escape"\)/)
})

test("movie carousels use mirrored arrowhead SVG controls", () => {
  const dashboardSource = readFileSync(
    new URL("../src/modules/dashboard/components.tsx", import.meta.url),

    "utf8",
  )

  assert.match(dashboardSource, /function CarouselArrowIcon/)

  assert.match(dashboardSource, /direction="left"/)

  assert.match(dashboardSource, /direction="right"/)

  assert.match(dashboardSource, /translate\(512 0\) scale\(-1 1\)/)

  assert.doesNotMatch(dashboardSource, /styles\.scrollArrow\}>‹/)

  assert.doesNotMatch(dashboardSource, /styles\.scrollArrow\}>›/)
})
