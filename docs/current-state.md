# DAE Current State

Last updated: March 26, 2026

This file is the practical handoff summary for the repo as it exists now.

Use this with:
- [docs/current-roadmap.md](D:/Codex%20DAE/dae/docs/current-roadmap.md) for short-term intent
- [docs/adaptive-marinating-porcupine.md](D:/Codex%20DAE/dae/docs/adaptive-marinating-porcupine.md) for the older broad vision / PRD

If those docs conflict, treat this file as the source of truth for what has actually been built.

## Product Direction

DAE is no longer just a tiny `submit once -> maybe get one chat` experiment.

The product now behaves more like:

1. See an idea or topic
2. Add your version of it
3. Get auto-matched or rescued into the right room
4. Return asynchronously
5. Keep rooms healthy and anonymous

The emerging product shape is:
- topic-led
- anonymous per room
- room-based conversations
- high-trust auto-match plus lower-trust rescue paths

## Live Environment

- Production domain: [https://dae-seven-lovat.vercel.app](https://dae-seven-lovat.vercel.app)
- Stack: Next.js 16 App Router, React 19, Tailwind 4, Supabase auth/db/realtime, OpenAI embeddings, Resend
- Vercel is linked and deployable from this workspace
- Supabase and Resend are live

## Current Navigation

The main signed-in shell currently centers around:

- `Now`
- `Submit`
- `Place` (canonical route is now `/place`; `/review` remains as a compatibility path)
- `Chats`
- `Topics`
- `Activity`
- `Settings`

Founder-only surfaces:
- `/metrics`
- `/moderation`

## Auth

### What is live

- Magic-link auth uses a server-side flow:
  - [app/api/auth/magic-link/route.ts](D:/Codex%20DAE/dae/app/api/auth/magic-link/route.ts)
  - [app/auth/callback/route.ts](D:/Codex%20DAE/dae/app/auth/callback/route.ts)
- `proxy.ts` handles session refresh and redirect cleanup
- Signed-in users landing on `/` should route into the app instead of seeing the login screen again
- There is a founder/tester account switcher for known test accounts:
  - [app/api/auth/test-switch/route.ts](D:/Codex%20DAE/dae/app/api/auth/test-switch/route.ts)

### Important behavior

- Real users still use magic links
- Founder/test switcher is a convenience layer, not the primary auth model
- Same browser/profile should preserve session

## Matching and Placement

### Automatic match

- Core DAE-to-DAE auto-match uses embeddings plus lexical score:
  - [lib/matching.ts](D:/Codex%20DAE/dae/lib/matching.ts)
- Automatic match threshold is currently `0.8` in:
  - [app/api/embed-and-match/route.ts](D:/Codex%20DAE/dae/app/api/embed-and-match/route.ts)
- Auto-match creates a new thread per matched DAE pair
- The same two users can have multiple separate rooms if they matched on different DAEs

### Near-match / rescue flow

- When a DAE does not auto-match, the app returns:
  - near rooms
  - near topics
- The main UI surface is:
  - [components/SubmitForm.tsx](D:/Codex%20DAE/dae/components/SubmitForm.tsx)
  - [app/place/page.tsx](D:/Codex%20DAE/dae/app/place/page.tsx)
- `/place` is now the canonical user-facing route
- `/review` still exists as a legacy compatibility path

### Join policy

Room rescue uses a separate composite fit score. It is not a pure “percent similarity” in the usual sense.

Current rule:
- auto-join if fit score `>= 0.5`
- otherwise request admission

Rule source:
- [lib/thread-join-policy.ts](D:/Codex%20DAE/dae/lib/thread-join-policy.ts)

### Current placement behavior

After posting a DAE, users can now:
- join a strong-fit room immediately
- request to join a weaker-fit room
- open `Place`
- open a topic hub
- keep the DAE waiting in the pool

## Topics, Browse, and Discovery

### Discovery surface

Topics are now the main discovery surface.

Current discovery principles:
- searchable by keywords
- shows topic summaries and example DAEs
- does not expose room messages
- actual chat content stays private to room members

Main files:
- [app/topics/page.tsx](D:/Codex%20DAE/dae/app/topics/page.tsx)
- [components/TopicCatalog.tsx](D:/Codex%20DAE/dae/components/TopicCatalog.tsx)

Compatibility note:
- `/browse` now forwards into `/topics`

### Topic hubs

Topics are now one of the main product backbones.

Current topic behavior:
- topic list at `/topics`
- topic hub pages at `/topics/[topicKey]`
- AI-assisted label / summary generation
- subthemes
- “why now” copy
- example DAEs
- counts for ideas, people, rooms, and waiting prompts
- follow/unfollow
- founder curation: pin, hide, alias/merge

Main files:
- [app/topics/page.tsx](D:/Codex%20DAE/dae/app/topics/page.tsx)
- [app/topics/[topicKey]/page.tsx](D:/Codex%20DAE/dae/app/topics/%5BtopicKey%5D/page.tsx)
- [lib/topic-intelligence.ts](D:/Codex%20DAE/dae/lib/topic-intelligence.ts)
- [lib/topic-registry.ts](D:/Codex%20DAE/dae/lib/topic-registry.ts)
- [lib/topic-hubs.ts](D:/Codex%20DAE/dae/lib/topic-hubs.ts)

### Important privacy boundary

Current intended rule:
- topic surfaces show ideas and counts
- room surfaces show conversation
- only room members should see room content

## Rooms and Chat

### Current chat model

- Every room has per-room anonymous handles
- Users should not carry the same handle across all rooms
- Rooms show the DAEs that brought people there
- Chat messages are private to room members

Key files:
- [app/threads/[matchId]/page.tsx](D:/Codex%20DAE/dae/app/threads/%5BmatchId%5D/page.tsx)
- [components/ChatThread.tsx](D:/Codex%20DAE/dae/components/ChatThread.tsx)
- [app/api/messages/route.ts](D:/Codex%20DAE/dae/app/api/messages/route.ts)

### Current async return loop

Live today:
- unread state
- jump to unread
- “since you were away” recap
- thread memory summary
- activity feed
- reply email nudges

Key files:
- [app/now/page.tsx](D:/Codex%20DAE/dae/app/now/page.tsx)
- [lib/activity.ts](D:/Codex%20DAE/dae/lib/activity.ts)
- [lib/message-notifications.ts](D:/Codex%20DAE/dae/lib/message-notifications.ts)
- [lib/thread-recap.ts](D:/Codex%20DAE/dae/lib/thread-recap.ts)
- [lib/thread-memory.ts](D:/Codex%20DAE/dae/lib/thread-memory.ts)

### Realtime note

Chat persistence is good.

Realtime has fallback refresh behavior and is usable, but it should still be thought of as “good enough and watched,” not “perfectly battle-hardened.”

## Room Governance and Trust

### Current protections

- block relationships prevent matching and joining
- join requests for weaker rescue fits
- leave chat
- detach DAE and leave
- detach removes that user’s messages from the room for everyone
- mute
- hide room
- report room
- founder moderation queue
- vote-to-remove flow exists

Key files:
- [app/api/blocks/route.ts](D:/Codex%20DAE/dae/app/api/blocks/route.ts)
- [app/api/thread-join-requests/route.ts](D:/Codex%20DAE/dae/app/api/thread-join-requests/route.ts)
- [app/api/thread-removal-votes/route.ts](D:/Codex%20DAE/dae/app/api/thread-removal-votes/route.ts)
- [components/ThreadExitControls.tsx](D:/Codex%20DAE/dae/components/ThreadExitControls.tsx)
- [app/moderation/page.tsx](D:/Codex%20DAE/dae/app/moderation/page.tsx)
- [lib/moderation.ts](D:/Codex%20DAE/dae/lib/moderation.ts)

### Founder moderation

Founder moderation now includes:
- report review
- room hide / restore
- join lock / unlock
- trust watchlist with higher-risk rooms

## Metrics and Analytics

### Current instrumentation

The app tracks:
- auth completion
- DAE waiting / matched
- near-match options shown
- topic follows
- topic hub opens
- room opens
- first messages
- reply nudges
- room signals
- moderation and trust actions

Main surface:
- [app/metrics/page.tsx](D:/Codex%20DAE/dae/app/metrics/page.tsx)

### SQL / state notes

There is analytics and governance state support in the repo, including SQL files, but the app also has fallback behavior in some places so local/dev and production do not hard-fail if a newer table is missing.

Relevant files:
- [supabase-analytics.sql](D:/Codex%20DAE/dae/supabase-analytics.sql)
- [supabase-governance-state.sql](D:/Codex%20DAE/dae/supabase-governance-state.sql)
- [lib/supabase-fallback.ts](D:/Codex%20DAE/dae/lib/supabase-fallback.ts)

## UX Direction That Has Already Shifted

The older “friends test only” roadmap note is now too narrow to describe the actual product.

The app has already expanded beyond that into:
- Browse
- Topics
- Place / rescue flow
- Activity / inbox
- Settings
- Follow system
- Founder moderation
- Topic curation
- Invite/onboarding flows

That is okay. The product is still coherent.

The important thing is to keep deepening the same spine:

`topic -> your DAE -> right room -> return -> trust`

## Known Rough Edges

These are the main things to keep in mind for future work:

- `Place` is now canonical, but `/review` still exists as a legacy path
- Rescue fit score is composite; user-facing “percent” language can be misleading
- Realtime chat is good but should still be treated as something to watch
- Topic intelligence is stronger now, but still partly generated/computed rather than fully persisted
- The product has several overlapping entry surfaces now, so continued IA cleanup will matter

## Suggested Near-Term Priorities

If continuing from here, likely high-value next moves are:

1. Turn post-submit into one true placement screen instead of a waiting state plus extra navigation
2. Make topics even more first-class and stable in the data model
3. Improve async return loop quality further
4. Keep refining trust/governance UX as the room model grows
5. Continue reducing surface duplication and route naming confusion

## Recommended New-Window Prompt Seed

Use something like:

“Read [docs/current-state.md](D:/Codex%20DAE/dae/docs/current-state.md) and [docs/current-roadmap.md](D:/Codex%20DAE/dae/docs/current-roadmap.md) first, then continue from the current implemented state instead of re-solving old problems.”
