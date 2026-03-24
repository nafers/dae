# DAE Current Roadmap

## Current Phase

DAE is in the stripped-down friends-test phase.

The goal right now is not to build the full long-term product. The goal is to prove the core loop with real people:

1. Sign in
2. Submit a DAE
3. Match with someone similar
4. Get the email
5. Open the thread
6. Chat

Success in this phase means the match feels meaningful enough that friends actually reply and keep using it.

## What Is In Scope Now

- Magic-link auth that works reliably
- DAE submission
- Semantic matching
- Match notification email
- Anonymous 1:1 thread
- Chat that is good enough for friend testing
- Small UX fixes that reduce confusion during testing

## What We Have Already Reached

- Auth flow is working with server-side magic-link handling
- Matching is live
- Email notifications are live
- Threads open correctly
- Chat messages persist correctly
- Fallback refresh is in place for chat
- Each matched DAE pair gets its own thread, even for the same two users

## What We Are Not Doing Yet

These belong to the later PRD, not the current validation phase:

- Native mobile app
- Discovery feed
- Kindreds / persistent relationships
- Weekly digest
- Full moderation pipeline
- Time-limited thread lifecycle
- Premium features
- Public-launch infrastructure

## Next Product Questions

Once the friend test is stable, the next questions are product questions, not mainly engineering questions:

- Do people feel a real "someone else does this too" moment?
- Do matched pairs actually send messages?
- Do people come back and submit again?
- Where does confusion still happen in the flow?

## Next Likely Build Priorities

If the core loop feels real in testing, the next round should focus on lightweight polish and validation support:

- Reduce remaining thread/chat confusion
- Add basic instrumentation for friend testing
- Clean up any rough edges in submit -> match -> thread
- Decide what minimum safety/legal layer is needed before a wider beta

## Source Of Truth

- `docs/adaptive-marinating-porcupine.md` is the broad vision and long-term PRD
- `docs/current-roadmap.md` is the short-term working target for this repo

When deciding what to build next, default to this document unless the goal has explicitly changed.
