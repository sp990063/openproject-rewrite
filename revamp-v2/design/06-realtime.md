# Realtime & Collaboration — OpenProject Rewrite v2

**Document:** `06-realtime.md`
**Author:** Senior Realtime & Collaboration Expert (WebSocket / SSE / CRDT)
**Status:** v2.0 — Architectural Specification
**Target audience:** Frontend engineers, backend engineers, SRE, product
**Scope:** Transport selection, event system, presence, optimistic concurrency, live editing, CRDT strategy, UI patterns, scaling, testing, migration
**Stack baseline (existing):** Next.js 15.5.15 (Pages Router), Upstash Redis (`@upstash/redis@1.37.0`), `ioredis@5.10.1`, NextAuth v4.24.14, TanStack Query 5.99.0, Zustand 5.0.12, Prisma 7.7.0

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Audit of Current Realtime Implementation](#2-audit-of-current-realtime-implementation)
3. [Goals, Non-Goals & Success Criteria](#3-goals-non-goals--success-criteria)
4. [Transport Layer Decision](#4-transport-layer-decision)
5. [Event System Architecture](#5-event-system-architecture)
6. [Channel / Room Model](#6-channel--room-model)
7. [Redis Pub/Sub Strategy](#7-redis-pubsub-strategy)
8. [Reconnection, Backpressure & Reliability](#8-reconnection-backpressure--reliability)
9. [Presence System](#9-presence-system)
10. [Optimistic Concurrency (lockVersion)](#10-optimistic-concurrency-lockversion)
11. [Live Editing Strategy](#11-live-editing-strategy)
12. [Realtime UI Patterns](#12-realtime-ui-patterns)
13. [Conflict Resolution UX](#13-conflict-resolution-ux)
14. [Server Code Patterns](#14-server-code-patterns)
15. [Client Hook Patterns](#15-client-hook-patterns)
16. [Typed Event Bus](#16-typed-event-bus)
17. [Optimistic Update with Rollback](#17-optimistic-update-with-rollback)
18. [WebRTC Considerations (Optional)](#18-webrtc-considerations-optional)
19. [Scaling — From Redis to Streams to NATS/Kafka](#19-scaling--from-redis-to-streams-to-natskafka)
20. [Testing Realtime](#20-testing-realtime)
21. [Observability, Security & Rate Limiting](#21-observability-security--rate-limiting)
22. [Migration Plan — SSE-only → Hybrid SSE+WS](#22-migration-plan--sse-only--hybrid-ssews)
23. [Comparison with Original OpenProject (ActionCable)](#23-comparison-with-original-openproject-actioncable)
24. [Roadmap & Phased Rollout](#24-roadmap--phased-rollout)
25. [Top 10 Realtime Improvements vs Current](#25-top-10-realtime-improvements-vs-current)
26. [Appendices — Reference Code, Tables, Diagrams](#26-appendices--reference-code-tables-diagrams)

---

## 1. Executive Summary

OpenProject Rewrite today ships a **SSE-only** realtime layer: a single `EventSource` per authenticated user, fed by a Redis pub/sub channel keyed `sse:<userId>`, broadcasting a narrow set of `work_package.*` and `notification.*` events. It works, but it leaves significant value on the table:

- It is **one-way** (server → client). The client cannot declare presence, request a live edit lock, or push cursor positions.
- It has **no channel model** (just per-user), so a project page cannot subscribe to the project room.
- It has **no presence system** (who else is on this page?).
- It has **no concurrency control** beyond "last writer wins, hope for the best".
- It cannot power **live editing** of wikis / meeting minutes at the level users now expect (Figma/Notion-grade collab).
- It has **no event versioning**, so a payload change can break deployed clients silently.
- It has **no replay**, so a flaky mobile network costs the user state.

This document designs a **hybrid transport** — **SSE for one-way fan-out (notifications, activity, work-package changes) and a lightweight WebSocket gateway (native `ws` — *not* Socket.io) for bidirectional flows (presence, edit locks, CRDT sync, live cursors)** — running on top of the same **Upstash Redis** that is already a dependency, with a **typed event bus** based on TypeScript discriminated unions, **optimistic concurrency** via `lockVersion` + `If-Match` ETag, **presence** with idle detection, and **CRDT-based live editing** via Yjs (and Hocuspocus where self-hosting a sync server is acceptable).

**Key decisions (TL;DR):**

| Decision | Choice | Rationale |
|---|---|---|
| One-way events | **SSE** (keep existing `/api/sse`) | Already wired, serverless-friendly, no new infra |
| Bidirectional / presence / live edit | **Native `ws` WebSocket gateway** at `/api/ws` (route upgrade on Pages Router via custom server, or a separate Node service) | Lighter than Socket.io, fewer dependencies, predictable binary frame handling for Yjs |
| CRDT | **Yjs + y-websocket protocol** (Hocuspocus or self-hosted `y-websocket` server) | De-facto standard, used by Notion-class tools, rich ecosystem |
| Pub/Sub backbone | **Upstash Redis Pub/Sub** for fan-out, **Redis Streams** (`XADD/XREAD`) for persistent event log + replay | Already in deps; Streams add durability without new infra |
| Channel model | Hierarchical: `user:<id>`, `project:<id>`, `wp:<id>`, `doc:<id>`, `board:<id>` | Matches the natural graph of OP |
| Presence | Server-side tracking with TTL keys in Redis; periodic heartbeat from client; idle after 5 min | Robust across reconnects and serverless cold starts |
| Optimistic concurrency | `lockVersion` integer on every mutable resource; `If-Match: "<n>"` header; 409 on mismatch; per-field merge UI for text fields | Familiar REST pattern, works with REST clients too |
| Live editing | Wiki/Forum = **pessimistic lock**; Meeting minutes / Document = **Yjs CRDT**; Work-package description = **optimistic + last-write-wins + conflict UI** | Matches user mental model + complexity tier |
| Horizontal scaling | Pub/Sub + sharded WebSocket gateway; later NATS or Kafka if scale demands | Stepwise, don't over-engineer |
| Auth | Reuse NextAuth JWT for SSE; signed short-lived token for WS upgrade | Single source of truth for identity |

**Estimated impact:**

- Perceived "liveness" of the app: 1–2 s → **<200 ms** for in-project updates.
- Stale data conflicts: dramatically reduced via `If-Match` 409 path + merge UI.
- New capabilities: presence, live cursors on board, real-time wiki co-editing — all unlocked by the same transport.
- Backwards compatible: existing SSE clients keep working during migration.

---

## 2. Audit of Current Realtime Implementation

### 2.1 Files reviewed

| Path | Lines | Purpose |
|---|---|---|
| `lib/notifications/realtime.ts` | 76 | Redis pub/sub fan-out helpers (`broadcastToUser`, `broadcastToProject`, `broadcastWorkPackageUpdate`, `broadcastNotification`) |
| `lib/realtime.ts` | 119 | **Duplicate** of the above (legacy) — `broadcastToUser`/`broadcastToProject`/`broadcastWorkPackageUpdate`. Suggests drift. |
| `hooks/useSSE.ts` | 56 | Client `EventSource` hook. Parses events, calls `queryClient.invalidateQueries` for `work-packages`, `notifications`, `unread-count`. |
| `pages/api/sse/index.ts` | 60 | Server SSE handler: `getServerSession` auth → `res.write` SSE frames from `subscriber.on('message')` → 25 s heartbeat → `req.socket.on('close')` cleanup. |
| Wiki spec | – | Phase 6 §2 documents the same SSE approach (the "C1" critical fix: shared Redis instead of in-memory Map). |

### 2.2 What's good

- **Serverless-safe pub/sub**: Uses Upstash Redis rather than an in-memory Map, which is the right call for Vercel.
- **Auth at the edge**: SSE handler authenticates via `getServerSession` before subscribing.
- **Heartbeat**: 25-second `: heartbeat\n\n` keeps the connection alive past typical proxy idle timeouts (nginx 30 s).
- **Cleanup on disconnect**: `req.socket.on('close')` unsubscribes and quits the Redis subscriber.
- **TanStack Query integration**: Invalidation is the right primitive — keeps the client cache as the source of truth.

### 2.3 What's missing

| Gap | Impact | Severity |
|---|---|---|
| No channel model (only `sse:<userId>`) | Cannot broadcast "project #42 changed" without enumerating members on every call | High |
| `broadcastToProject` re-fans out to N personal channels (O(N) `redis.publish` calls per event) | Latency grows with project size; one missed channel = silent loss | High |
| No client → server channel (one-way only) | Presence, live cursors, edit locks all impossible | High |
| No event versioning | A deployed client crashes if payload shape changes | High |
| No `If-Match` / `lockVersion` on updates | Last-write-wins, users overwrite each other | High |
| No presence | "Who's online" not shown; concurrent edits surprise users | Medium |
| No replay / last-event-id support | Mobile users lose events on flaky networks | Medium |
| No typed events (`type: string` in `useSSE`) | All events funnel through `console.log` for unknown types | Medium |
| No backpressure | Slow client = memory growth in Node | Medium |
| Duplicate implementation (`lib/realtime.ts` vs `lib/notifications/realtime.ts`) | Confusing for new contributors, drift inevitable | Medium |
| No testing harness | Regressions land silently | Medium |
| No WebSocket gateway at all | No path to Yjs, presence, edit locks | High |

### 2.4 Wire shape today

```
GET /api/sse?userId=<id>
→ 401 if no session
→ 200 text/event-stream
  data: {"type":"connected","timestamp":1700000000000}\n\n
  data: {"type":"work_package.updated","payload":{"id":"wp_123", ...},"timestamp":...,"projectId":"p_42"}\n\n
  data: {"type":"notification.new","payload":{"id":"n_5"},"timestamp":...}\n\n
  : heartbeat\n\n    (every 25s)
```

A typical `useSSE` consumer only reacts to known event types; everything else logs to console.

---

## 3. Goals, Non-Goals & Success Criteria

### 3.1 Goals

1. **Push the right thing, fast.** Work-package mutations, new comments, project membership changes, and notifications must reach interested clients within **<300 ms p95** of the DB commit.
2. **Bidirectional where it matters.** Presence pings, edit-lock acquire/release, and CRDT sync must work over a persistent socket.
3. **Cooperative editing.** Wiki pages, meeting minutes, and rich-text documents must support **two or more** users editing simultaneously without data loss.
4. **Conflict-free optimistic updates.** When users edit the same work package from different tabs, the system must detect the race and present a **merge UI** — never silently overwrite.
5. **Resilient to network flakes.** Disconnect/reconnect must not lose events; client must catch up via **last-event-id** replay.
6. **Observable.** Every connection, every event, every conflict must be traceable via Sentry + structured logs + Prometheus.
7. **Serverless-friendly.** No long-lived in-process state; all state lives in Redis (or Postgres). Cold starts are cheap.
8. **Backwards compatible.** Existing `/api/sse` consumers keep working during the migration.

### 3.2 Non-Goals (v2 scope)

- **WebRTC peer-to-peer** (only the case for true mesh collaboration, which we don't need for OP). Reserved for future audio/video calls.
- **End-to-end encryption** of realtime payloads. (Transport is HTTPS/WSS; payload encryption is a future compliance task.)
- **Mobile native push** (APNs/FCM). Defer to existing email + in-app notifications.
- **Server-Sent Events for binary data.** Binary frames go over WebSocket only.

### 3.3 Success criteria

| Metric | Target |
|---|---|
| p95 fan-out latency (DB commit → SSE frame received) | <300 ms |
| WebSocket connect time (cold) | <500 ms |
| Reconnect & replay window | Last 100 events (5 min) via Redis Streams |
| Conflict rate (work-package updates) | <1 % of writes |
| 409 → merge UI rendered | <100 ms |
| Presence accuracy | ±10 s |
| Concurrent SSE connections per serverless instance | ≥ 1 000 (load test) |
| Memory per SSE connection | < 8 KB |

---

## 4. Transport Layer Decision

### 4.1 The three real contenders

| Property | SSE (`EventSource`) | WebSocket (`ws`) | WebRTC (RTCDataChannel) |
|---|---|---|---|
| Direction | Server → client | Bidirectional | Bidirectional, peer-to-peer |
| Protocol | HTTP/1.1, HTTP/2 | HTTP upgrade (RFC 6455) | UDP + ICE/STUN/TURN |
| Reconnect | Browser automatic, with `Last-Event-ID` | Manual (we implement) | Manual |
| Server load per connection | Low (just keep socket open) | Low–medium (frame parse) | High (signalling + TURN) |
| Binary frames | No (UTF-8 only) | Yes | Yes |
| Proxy/CDN friendliness | Excellent (plain HTTP) | Good (some WAFs choke) | Poor (UDP blocked) |
| Serverless support | Excellent (Vercel, Cloudflare) | Possible but awkward (no long-lived connections on Lambda) | Poor |
| Browser API | `EventSource` (one-liner) | `WebSocket` (one-liner) | Complex, signalling needed |
| Use case fit | Notifications, activity, broadcast | Chat, presence, CRDT, edit locks | Audio/video, mesh data |

### 4.2 Recommendation: **Hybrid SSE + WebSocket**

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              Browser                                       │
│                                                                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────────────┐  │
│  │  useSSE()       │  │  useRealtime()  │  │  useLiveEdit()           │  │
│  │  notifications  │  │  presence +     │  │  Yjs provider,           │  │
│  │  activity feed  │  │  cursors, locks │  │  awareness, lock acquire │  │
│  └────────┬────────┘  └────────┬────────┘  └────────────┬─────────────┘  │
│           │                     │                          │                │
└───────────│─────────────────────│──────────────────────────│────────────────┘
            │                     │                          │
            │ EventSource         │ WebSocket (JSON)         │ WebSocket (binary)
            ▼                     ▼                          ▼
   ┌─────────────────┐   ┌────────────────────┐    ┌──────────────────────┐
   │ /api/sse        │   │ /api/ws (gateway)  │    │ /api/yjs/<docId>     │
   │ Redis subscriber│   │ JSON RPC + presence│    │ Hocuspocus /         │
   │ Heartbeat 25s   │   │ Auth via JWT       │    │ y-websocket protocol │
   └────────┬────────┘   └────────┬───────────┘    └──────────┬───────────┘
            │                     │                            │
            │     pub/sub on shared channels                   │
            ▼                     ▼                            ▼
   ┌────────────────────────────────────────────────────────────────┐
   │                  Upstash Redis (Pub/Sub + Streams + KV)         │
   │  Channels: user:<id>, project:<id>, wp:<id>, doc:<id>, board:<id>│
   └────────────────────────────────────────────────────────────────┘
```

**Why hybrid (and not pure WebSocket)?**

- SSE is the lowest-friction way to ship a one-way stream. The browser handles reconnect automatically and respects `Last-Event-ID`. The server code is 30 lines.
- WebSocket is the only practical substrate for Yjs (binary frames, low latency, bidirectional). Pushing Yjs over SSE would be 10× the work.
- We do **not** add Socket.io. It's a large dependency (300 KB+ minified) and we don't need its room abstractions or fallbacks (we control the server). The native `ws` package is 50 KB.
- We do **not** start with WebRTC. OP is a project-management app, not Figma. Voice/video and P2P mesh are future work.

### 4.3 When to use which

| Use case | Transport | Why |
|---|---|---|
| Notification to user | SSE | One-way, low frequency, auto-reconnect |
| Activity feed push | SSE | One-way, fan-out to many |
| Work-package change broadcast | SSE | One-way, recipients are subscribers to project channel |
| "User X is online" badge | WebSocket | Requires heartbeat, bidirectional presence pings |
| "User X is viewing project Y" | WebSocket | Per-channel presence room |
| "User X is editing WP #123" | WebSocket | Locks require bidirectional handshake |
| Live cursor in board view | WebSocket | High-frequency, small JSON frames |
| Yjs wiki co-edit | WebSocket (binary) | CRDT sync protocol |
| Voice/video call (future) | WebRTC | n/a in v2 |

### 4.4 Why not Socket.io?

- Adds **fallback transports** (long-polling, XHR) we don't need.
- Custom wire format (Socket.io frames wrap our frames), so debugging is harder.
- Built-in rooms/recovery we already implement ourselves on top of `ws`.
- Bundle weight: Socket.io-client is ~120 KB gzipped; native `WebSocket` is 0 KB.

---

## 5. Event System Architecture

### 5.1 The bus in one diagram

```
 ┌──────────────┐  emit("work_package.updated", {id, ...})
 │  Producer    │─────────────────────────────────────┐
 │  (API route) │                                     │
 └──────────────┘                                     ▼
                                            ┌──────────────────────┐
                                            │  EventBus.publish()  │
                                            │  • assign event_id   │
                                            │  • attach timestamp  │
                                            │  • schema validate   │
                                            │  • XADD to stream    │
                                            │  • publish to chan   │
                                            └────┬──────────┬──────┘
                                                 │          │
                                       pub/sub (fire)  stream (persist)
                                                 │          │
                                                 ▼          ▼
                                    ┌──────────────────┐  ┌──────────────────┐
                                    │  SSE subscribers │  │  Redis Streams   │
                                    │  (per-channel)   │  │  (replay buffer) │
                                    └────────┬─────────┘  └────────┬─────────┘
                                             │                     │
                                             ▼                     ▼
                                    ┌──────────────────┐  ┌──────────────────┐
                                    │  Browser EventSrc│  │  Replay client   │
                                    │  (live fan-out)  │  │  (Last-Event-ID) │
                                    └──────────────────┘  └──────────────────┘
```

### 5.2 Naming convention

`<domain>.<verb>[.qualifier]`

| Event | Payload (typed) | Trigger |
|---|---|---|
| `work_package.created` | `WorkPackageRef` | POST `/api/v3/work_packages` |
| `work_package.updated` | `{ id, changes, lockVersion }` | PATCH `/api/v3/work_packages/:id` |
| `work_package.deleted` | `{ id }` | DELETE `/api/v3/work_packages/:id` |
| `work_package.moved` | `{ id, fromPosition, toPosition, columnId }` | Board drag-drop |
| `work_package.commented` | `{ id, commentId, authorId }` | New comment |
| `work_package.assigned` | `{ id, assigneeId, previousAssigneeId }` | Assignment change |
| `comment.added` | `CommentRef` | New comment anywhere |
| `comment.updated` | `CommentRef` | Edit comment |
| `comment.deleted` | `{ id, parentType, parentId }` | Delete comment |
| `project.member_added` | `{ projectId, userId, role }` | Add member |
| `project.member_removed` | `{ projectId, userId }` | Remove member |
| `project.created` | `ProjectRef` | Create project |
| `project.updated` | `{ id, changes }` | Update project |
| `notification.created` | `NotificationRef` | Any notification generator |
| `activity.created` | `ActivityRef` | Activity feed entry |
| `presence.joined` | `{ userId, channel }` | User subscribes to channel via WS |
| `presence.left` | `{ userId, channel }` | User disconnects |
| `presence.idle` | `{ userId, channel }` | 5 min of inactivity |
| `presence.cursor` | `{ userId, channel, x, y, selectionId? }` | Board view cursor move |
| `lock.acquired` | `{ resourceType, resourceId, userId, expiresAt }` | Edit lock |
| `lock.released` | `{ resourceType, resourceId, userId }` | Lock released |
| `lock.denied` | `{ resourceType, resourceId, heldBy }` | Lock refused |
| `doc.update` (Yjs binary) | `Uint8Array` | Yjs update frame |
| `doc.awareness` (Yjs) | `Uint8Array` | Cursor / presence in Yjs doc |

### 5.3 Event envelope (wire schema)

All events use a single envelope so clients have one parser.

```typescript
// types/realtime.ts
export interface EventEnvelope<TPayload = unknown> {
  /** ULID/KSUID, monotonic, used as Last-Event-ID */
  id: string;
  /** Event type, dotted namespace */
  type: string;
  /** Schema version of `type` (integer; bumped on breaking change) */
  version: number;
  /** Originating channel/room key */
  channel: string;
  /** Producer (API node, region) — for debugging */
  origin: string;
  /** Wall-clock ms when the producer committed the change */
  timestamp: number;
  /** Optional correlation ID for tracing */
  correlationId?: string;
  /** Producer user id (for audit) */
  actorId?: string;
  /** Actual payload, typed via the discriminated union (see §16) */
  payload: TPayload;
  /** True if this is a replay from Redis Streams (Last-Event-ID) */
  replay?: boolean;
}
```

### 5.4 Versioning rules

- `version: 1` is the initial contract.
- **Additive** changes (new optional field) → no bump.
- **Breaking** changes (rename, remove, type change) → bump to `2`.
- Producers always emit the **highest version they support**; consumers **pin to a major version** in their subscription.
- During a transition window, producers can dual-publish `v1` and `v2` to the same channel if a migration is in flight (see §22).

### 5.5 Producer code path (server)

```typescript
// lib/realtime/event-bus.ts
import { Redis } from '@upstash/redis';
import { ulid } from 'ulid';

const EVENT_SCHEMA_VERSION: Record<string, number> = {
  'work_package.updated': 1,
  'work_package.created': 1,
  // ...
};

export async function publish<T>(args: {
  type: string;
  channel: string;
  payload: T;
  actorId?: string;
  correlationId?: string;
}): Promise<string> {
  const id = ulid();
  const envelope: EventEnvelope<T> = {
    id,
    type: args.type,
    version: EVENT_SCHEMA_VERSION[args.type] ?? 1,
    channel: args.channel,
    origin: process.env.HOSTNAME ?? 'unknown',
    timestamp: Date.now(),
    correlationId: args.correlationId,
    actorId: args.actorId,
    payload: args.payload,
  };

  // Validate against Zod schema (see §16.3)
  assertValidEvent(envelope);

  const redis = getRedisPublisher();
  const message = JSON.stringify(envelope);

  // 1. Persist to Redis Streams (durable, replayable) — fire and forget
  redis.xadd(`stream:${args.channel}`, '*', { id, type: args.type, msg: message })
    .catch((e) => log.error({ err: e }, 'xadd failed'));

  // 2. Fan-out via pub/sub (transient, fast)
  await redis.publish(args.channel, message);

  // 3. Fan-out to interested users' personal channels (SSE compatibility)
  //    This is a project→user expansion; in v2 we let the SSE handler
  //    subscribe to BOTH the user channel and the project channel directly.

  return id;
}
```

---

## 6. Channel / Room Model

### 6.1 Channel types

| Channel pattern | Purpose | Who subscribes | Backed by |
|---|---|---|---|
| `user:<userId>` | Personal notifications, unread count, account events | The user themselves (1 SSE/WS) | Redis pub/sub |
| `project:<projectId>` | Project-scoped events (WP changes, new members) | All users viewing the project | Redis pub/sub |
| `wp:<workPackageId>` | Per-WP events (status change, comment, presence) | Users viewing the WP, presence trackers | Redis pub/sub + presence |
| `doc:<documentId>` | Yjs doc sync + awareness | Users editing the doc | Redis pub/sub + Yjs broadcast |
| `board:<boardId>` | Board view live cursors + WP moves | Users viewing the board | Redis pub/sub (high freq) |
| `forum:<forumId>` | New threads | Subscribers | Redis pub/sub |
| `wiki:<pageId>` | Wiki edits | Subscribers | Redis pub/sub |
| `announcement:<id>` | System-wide | All online users | Redis pub/sub (rare) |

### 6.2 Subscription rules

- A client **subscribes** by sending `{op:"subscribe", channels:["project:42","wp:123"]}` over WebSocket.
- The server **authorizes** the subscription by checking the user's `Member` records (project 42) and `WorkPackage.watcher` records (wp 123). Unauthorized subscriptions are rejected.
- A client may subscribe to **N channels** per WS connection. The server tracks `(connectionId, channel)` and unsubscribes on disconnect.
- A user can also be in a channel for **presence only** (e.g., `presence:project:42`) without receiving the project broadcast traffic. We use a **prefix namespace** to distinguish:

```
project:42          → full event stream for project 42
presence:project:42 → presence-only events for project 42
```

### 6.3 Hierarchical expansion

Some events are emitted on a parent channel but should also reach subscribers of child channels. Example: `work_package.updated` for `wp:123` should reach subscribers of `project:42` (where wp 123 lives). We do **not** re-emit; the client subscribes explicitly to the channels it needs.

Server-side fan-out decision:

```typescript
// In the PATCH /api/v3/work_packages/:id route
await publish({
  type: 'work_package.updated',
  channel: `wp:${wp.id}`,            // primary — fans out to wp subscribers
  payload: { id: wp.id, changes, lockVersion: wp.lockVersion },
  actorId: session.user.id,
});
await publish({
  type: 'work_package.updated',
  channel: `project:${wp.projectId}`, // secondary — fans out to project view subscribers
  payload: { id: wp.id, changes, lockVersion: wp.lockVersion },
  actorId: session.user.id,
});
```

This keeps producers simple and clients explicit. We accept the duplicate frame in clients that subscribe to both channels; the client **deduplicates by `envelope.id`**.

### 6.4 Presence channels (separate namespace)

Presence is **state**, not events. The server keeps a `presence:user:<id> -> { channels: Set<string>, lastSeen: ts, status: 'active'|'idle' }` structure in Redis, with a TTL.

Channels for presence broadcast:

- `presence:user:<id>` — "user X is now online / offline / idle" (subscribed by people who can see X)
- `presence:project:<id>` — "user X joined/left/is viewing project Y" (subscribed by people viewing Y)
- `presence:wp:<id>` — "user X is editing WP #Z" (subscribed by people viewing Z)

This decoupling means heavy presence traffic (cursors, idle pings) doesn't pollute the event stream of the same name.

---

## 7. Redis Pub/Sub Strategy

### 7.1 Why Redis Pub/Sub (not direct)

- We are on **Vercel serverless**. There is no long-running process to keep a `WebSocket` server alive; we have many short-lived API route invocations.
- Pub/Sub is the standard pattern for "I have an event, who cares?" — perfect for fan-out across serverless instances.
- Upstash Redis is **already a dependency** (`@upstash/redis@1.37.0`). No new infra.

### 7.2 Channel naming convention (server-side Redis channels)

Redis pub/sub channel names are **flat strings**; we encode the channel hierarchy in the name:

```
op:user:<userId>                   # personal (notifications, account)
op:project:<projectId>             # project events
op:wp:<workPackageId>              # per-WP
op:doc:<documentId>                # per-doc Yjs
op:board:<boardId>                 # per-board cursor
op:forum:<forumId>
op:wiki:<pageId>
op:announcement:<id>
op:presence:user:<userId>
op:presence:project:<projectId>
op:presence:wp:<workPackageId>
op:lock:<resourceType>:<resourceId>
op:stream:<channelKey>             # Redis Stream mirror (durable log)
```

The `op:` prefix lets us share a Redis instance with other apps cleanly.

### 7.3 Message format on the wire

Same envelope as §5.3. JSON-encoded, UTF-8. For Yjs binary we use a **different transport** (WebSocket binary frames directly, not pub/sub) — see §11.

### 7.4 Publish path (server)

```typescript
// lib/realtime/publish.ts
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
});

export async function publish(channel: string, message: object): Promise<void> {
  const payload = JSON.stringify(message);
  // Pub/Sub for live
  await redis.publish(channel, payload);
  // Stream for replay
  await redis.xadd(`op:stream:${channel}`, 'MAXLEN', '~', 10000, '*', { msg: payload });
}
```

### 7.5 Subscribe path (SSE handler)

```typescript
// pages/api/sse/index.ts
const subscriber = redis.duplicate();
const userChannels = [`op:user:${userId}`, ...subscribedProjectChannels];

for (const ch of userChannels) {
  await subscriber.subscribe(ch);
}

subscriber.on('message', (ch, message) => {
  const envelope = JSON.parse(message) as EventEnvelope;
  res.write(`id: ${envelope.id}\n`);
  res.write(`event: ${envelope.type}\n`);
  res.write(`data: ${message}\n\n`);
});
```

### 7.6 Reconnection & Last-Event-ID

- Browser's `EventSource` automatically reconnects.
- On reconnect, the browser sends `Last-Event-ID: <id>` header.
- The server **reads `Last-Event-ID`**, looks up the user's subscribed channels, and replays any missing events from the Redis Stream:

```typescript
const lastId = req.headers['last-event-id'];
if (lastId) {
  for (const ch of userChannels) {
    const streamKey = `op:stream:${ch}`;
    const entries = await redis.xread(streamKey, lastId, 'COUNT', 100);
    for (const [, , fields] of entries ?? []) {
      const msg = fields.msg;
      res.write(`id: <replayed-id>\ndata: ${msg}\n\n`);
    }
  }
}
```

The replay is bounded (`COUNT 100`, `MAXLEN 10 000` on streams) so memory + bandwidth stay bounded.

### 7.7 Backpressure

Slow clients are the silent killer of fan-out systems. Defenses:

1. **Per-connection write buffer cap.** Node's `res.write` returns `false` when the kernel buffer is full. We `pause()` the Redis subscriber and `resume()` it on `res.drain`.
2. **Stream length cap.** Streams are `MAXLEN ~ 10000`, so the replay set is bounded.
3. **Disconnect policy.** If the client's socket is unwritable for **30 s**, we close the SSE connection; the browser auto-reconnects and replays from `Last-Event-ID`.
4. **Critical vs best-effort.** Notification events are critical (don't drop). Cursor events are best-effort (drop after 5 frames queued).

```typescript
// Backpressure-aware write
function safeWrite(res: NextApiResponse, frame: string): boolean {
  if (!res.writable || res.writableEnded) return false;
  const ok = res.write(frame);
  if (!ok) {
    res.once('drain', () => resumeSubscription());
    pauseSubscription();
  }
  return ok;
}
```

### 7.8 Limits and quotas

- Per user: **max 50 channel subscriptions** across SSE + WS.
- Per project channel: `MAXLEN 10 000` (≈ 5 min at 30 ev/s, plenty).
- Per user channel: `MAXLEN 1 000`.

---

## 8. Reconnection, Backpressure & Reliability

### 8.1 Client-side reconnect

- **SSE:** browser handles it. We add `withCredentials` so cookies ride along; we expose `useSSE({ onOpen, onError, onMessage })`.
- **WebSocket:** we implement an exponential-backoff reconnect:

```typescript
class ReconnectingWebSocket {
  private ws?: WebSocket;
  private attempt = 0;

  connect() {
    this.ws = new WebSocket(this.url);
    this.ws.onopen = () => { this.attempt = 0; this.flushQueue(); };
    this.ws.onmessage = (e) => this.handle(e);
    this.ws.onclose = () => this.scheduleReconnect();
    this.ws.onerror = () => this.ws?.close();
  }

  private scheduleReconnect() {
    const delay = Math.min(30_000, 500 * 2 ** this.attempt++) + Math.random() * 500;
    setTimeout(() => this.connect(), delay);
  }
}
```

- On WS reconnect, client **re-sends** its subscription list so the server can reattach to Redis channels.
- On WS reconnect, client requests a **state snapshot** of the channels it cares about (e.g., presence list, current lock holder).

### 8.2 Server-side cleanup

- WS handler tracks `(connectionId, channels)` in a Redis hash.
- On `close`, it removes the connection from each channel's subscriber set and emits `presence.left` for each channel the connection was in.
- A sweeper job (Inngest cron, every 1 min) deletes Redis keys whose TTL expired.

### 8.3 Idempotency

- All event ids are ULIDs (sortable, 26 chars). Clients deduplicate.
- All WS messages have a `msgId`; servers can ignore duplicates (rare, but possible on reconnect storms).

### 8.4 At-least-once vs at-most-once

- SSE + Pub/Sub = **at-most-once**. If a subscriber is disconnected when an event is published, the event is lost. Replay via Streams closes the gap (effectively **at-least-once** with a small window).
- For business-critical events (status change, comment add), the server **also writes the event to Postgres** (outbox pattern), so a future "events since X" query is always possible.

### 8.5 The outbox pattern (one-liner)

We piggyback on Prisma's transactions: any business write that needs to emit an event does so **in the same DB transaction** as the outbox row. A background worker (Inngest) flushes the outbox to Redis pub/sub + Streams. This guarantees we never publish an event for a transaction that rolled back, and vice versa.

```typescript
await prisma.$transaction(async (tx) => {
  const wp = await tx.workPackage.update({ where: { id }, data });
  await tx.outboxEvent.create({
    data: {
      id: ulid(),
      type: 'work_package.updated',
      channel: `wp:${wp.id}`,
      payload: { id: wp.id, changes, lockVersion: wp.lockVersion },
      publishedAt: null,
    },
  });
});
```

A periodic Inngest function (every 1 s, or triggered by a "wake" ping from the route) reads un-published outbox rows, publishes them, and stamps `publishedAt`. This is the **gold standard** for reliable realtime; we adopt it from day one.

---

## 9. Presence System

### 9.1 Three layers of presence

| Layer | Granularity | Where tracked | TTL |
|---|---|---|---|
| **User online** | "Is user X online anywhere in OP?" | `presence:user:<id>` Redis hash | 60 s, refreshed by WS heartbeat |
| **User in scope** | "Is user X viewing project Y?" | `presence:scope:project:<id>` Redis set of userIds | 90 s, refreshed by channel heartbeat |
| **User editing** | "Is user X editing WP Z?" | `presence:scope:wp:<id>` Redis hash `{ userId -> { startedAt, lastBeat } }` | 60 s |

### 9.2 Lifecycle

```
WS connect
  → join user:<id> channel       (server records connectionId → userId)
  → emit presence.joined         on op:user:<id> and op:presence:user:<id>

WS subscribe to project:42
  → SADD presence:scope:project:42 <userId>
  → EXPIRE presence:scope:project:42 90
  → emit presence.joined on op:presence:project:42

WS heartbeat (every 20s)
  → SET presence:user:<id> ... EX 60
  → refresh scope TTLs

WS disconnect
  → SMEMBERS presence:scope:* (the ones we joined)
  → SREM for each
  → emit presence.left on each

Idle detection (5 min no input, client sends {"op":"idle"} or sends last user event timestamp)
  → emit presence.idle on op:presence:user:<id> and project scopes
  → show user as idle in UI (gray dot + "idle")
```

### 9.3 Idle detection on the client

```typescript
// hooks/useIdleDetector.ts
import { useEffect, useRef } from 'react';

export function useIdleDetector(idleMs = 5 * 60 * 1000, onIdle: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const reset = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(onIdle, idleMs);
    };
    ['mousemove','keydown','scroll','click','touchstart'].forEach((ev) =>
      window.addEventListener(ev, reset, { passive: true })
    );
    reset();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      ['mousemove','keydown','scroll','click','touchstart'].forEach((ev) =>
        window.removeEventListener(ev, reset)
      );
    };
  }, [idleMs, onIdle]);
}
```

### 9.4 Last seen

- On WS disconnect, we record `lastSeen:<userId> = Date.now()` in a Redis string with no TTL.
- UI shows "last seen 3 min ago" when a user is offline.

### 9.5 The presence cache (for offline reads)

A single Redis key per user:

```
HSET presence:user:<userId>
  status "online|idle|offline"
  lastSeen <ms>
  scopes "<json-array>"
```

Periodic sweeper removes entries with `lastSeen < now - 5min` and emits `presence.left` for cleanup consistency.

---

## 10. Optimistic Concurrency (lockVersion)

### 10.1 The contract

Every mutable resource gets a `lockVersion Int @default(0)` column. The Prisma schema is amended to add this to WorkPackage, Comment, Document, WikiPage, Meeting, Project, etc.

```prisma
model WorkPackage {
  id          String   @id @default(cuid())
  // ... fields ...
  lockVersion Int      @default(0)
  updatedAt   DateTime @updatedAt
}
```

### 10.2 Client → server contract

```
PATCH /api/v3/work_packages/123
If-Match: "5"
Content-Type: application/json

{"title": "New title", "status": "closed"}
```

The client **always** sends the latest known `lockVersion`. The server:

```typescript
// pages/api/v3/work_packages/[id].ts
const ifMatch = req.headers['if-match'];
const expected = parseInt(ifMatch?.replaceAll('"', '') ?? '-1', 10);

const wp = await prisma.$transaction(async (tx) => {
  const current = await tx.workPackage.findUniqueOrThrow({ where: { id } });
  if (current.lockVersion !== expected) {
    throw new ConflictError({ current: current.lockVersion, sent: expected, currentDoc: current });
  }
  return tx.workPackage.update({
    where: { id },
    data: { ...parsed, lockVersion: { increment: 1 } },
  });
});

res.setHeader('ETag', `"${wp.lockVersion}"`);
res.status(200).json(wrap(wp));
```

### 10.3 409 Conflict response

```json
{
  "error": {
    "code": "VERSION_CONFLICT",
    "message": "Resource was modified by another user",
    "expected": 5,
    "current": 7,
    "resource": { "id": "wp_123", "title": "Their title", "status": "in_progress", "lockVersion": 7 }
  }
}
```

### 10.4 Client-side merge UI

The TanStack Query mutation:

```typescript
const mutation = useMutation({
  mutationFn: (input) => fetch(`/api/v3/work_packages/${id}`, {
    method: 'PATCH',
    headers: { 'If-Match': `"${currentVersion}"`, 'content-type': 'application/json' },
    body: JSON.stringify(input),
  }),
  onError: async (err, _input, ctx) => {
    if (err.status === 409) {
      const body = await err.response.json();
      // Open merge dialog
      openMergeDialog({
        mine: ctx.previous,
        theirs: body.error.resource,
        fields: diff(ctx.previous, body.error.resource),
      });
    } else {
      // Rollback
      queryClient.setQueryData(['wp', id], ctx.previous);
    }
  },
  onSuccess: (wp) => {
    queryClient.setQueryData(['wp', id], wp);
  },
});
```

The merge dialog presents a **per-field three-way diff** (`base`, `mine`, `theirs`) and lets the user pick per field. After merging, the client retries with the **new lockVersion** of `theirs` and the merged field set.

### 10.5 Auto-merge for non-overlapping fields

If the conflict is non-overlapping (user A changed `title`, user B changed `description`), the client can auto-merge and resubmit. We expose a helper:

```typescript
function autoMerge<T extends { lockVersion: number }>(mine: T, theirs: T, original: T): T {
  const result: any = { ...theirs }; // start with their version
  for (const key of Object.keys(mine)) {
    if (key === 'lockVersion' || key === 'updatedAt') continue;
    const mineChanged = !deepEqual(mine[key], original[key]);
    const theirsChanged = !deepEqual(theirs[key], original[key]);
    if (mineChanged && !theirsChanged) result[key] = mine[key]; // take mine
    if (mineChanged && theirsChanged) result[key] = undefined; // conflict marker
  }
  return result as T;
}
```

The conflict marker tells the UI which fields need a human decision.

### 10.6 Why ETag, not custom header?

- ETag / If-Match is **HTTP-standard** (RFC 7232). Proxies, CDNs, and clients understand it.
- Caching layers can use it for free (304 Not Modified).
- It composes with optimistic concurrency libraries (`@tanstack/query` doesn't have it built-in, but it's a 10-line wrapper).

---

## 11. Live Editing Strategy

### 11.1 Three tiers

| Tier | Mechanism | Use cases | Complexity |
|---|---|---|---|
| **T1: Pessimistic lock** | "Only one editor at a time" + auto-release after N seconds of inactivity | Wiki pages (single-author feel), Forum thread OP (long-form), Forum post | Low |
| **T2: Optimistic + last-write-wins + conflict UI** | Optimistic local update, server stores the latest, conflicting user gets 409 with the merged resource | Work-package description, work-package subject, meeting title, short fields | Low |
| **T3: CRDT (Yjs)** | Multi-cursor, real-time, eventually consistent, no conflicts by design | Meeting minutes (collaborative notes), Documents (Phase 4 rich docs), Anywhere "Google Docs-style" | High |

### 11.2 T1: Pessimistic lock

**Protocol (over WebSocket):**

```
client → server:  { op: "lock.acquire", resource: "wiki:42", ttl: 120 }
server → client:  { op: "lock.acquired",  resource: "wiki:42", expiresAt: ... }
        OR
server → client:  { op: "lock.denied",    resource: "wiki:42", heldBy: { userId, expiresAt } }

# Server also publishes to op:lock:wiki:42 and op:project:42
server → broadcast: { type: "lock.acquired", resource: "wiki:42", userId, expiresAt }

# Heartbeat (every 30s)
client → server:  { op: "lock.heartbeat", resource: "wiki:42" }
server → client:  { op: "lock.heartbeat.ack", expiresAt }

# Release
client → server:  { op: "lock.release", resource: "wiki:42" }
# OR auto-release on disconnect after 30s grace
# OR TTL expiry
```

**Server state (Redis):**

```
SET lock:wiki:42 '{"userId":"u_5","expiresAt":1700000000000}' EX 120 NX
```

`SET ... NX` makes it atomic. Heartbeat extends with `EXPIRE`. The grace period on disconnect is a 30 s timer in the WS handler.

**UI:**

- A "Bob is editing this page" banner with a "Take over" button (steals the lock after 30 s grace, sends a notification to Bob).
- The editor's title bar shows a "✏️ You are editing" badge.

### 11.3 T2: Optimistic + last-write-wins

Used for short fields where conflict is rare and a 409 + merge dialog is acceptable:

- Work-package `subject`, `description`, `status`, `assignee`, `dueDate`
- Meeting `title`, `agenda`
- News `title`, `summary`

Pattern: client does optimistic update via TanStack Query `onMutate`, server applies `If-Match`, returns 409 on conflict, client opens merge dialog or auto-merges non-overlapping fields (see §10.5).

### 11.4 T3: CRDT (Yjs)

Yjs is a battle-tested CRDT library used by Notion-class apps. It has:

- **Y.Doc** — the shared document, contains nested Y.Map, Y.Array, Y.Text, etc.
- **y-websocket** — transport protocol for sync.
- **y-protocols/awareness** — built-in presence (cursor, selection, user info).

**Architecture:**

```
┌──────────────┐                  ┌──────────────────────────┐
│  Browser A   │  binary frames   │  Yjs WebSocket Server    │
│  Y.Doc       │◄────────────────►│  (Hocuspocus or custom)  │
└──────────────┘                  └────────┬─────────────────┘
                                            │
┌──────────────┐                            │  pub/sub
│  Browser B   │                            ▼
│  Y.Doc       │                  ┌──────────────────────────┐
└──────────────┘                  │  Redis pub/sub channel   │
                                  │  op:doc:<docId>          │
                                  │  (binary Yjs updates)    │
                                  └──────────────────────────┘
```

**Yjs protocol basics (relevant subset):**

| Message type | Direction | Purpose |
|---|---|---|
| `sync step 1` | C → S | "Send me your state vector" |
| `sync step 2` | S → C | "Here are the missing updates" |
| `update` | C → S / S → C | Binary diff to apply |
| `awareness` | C → S / S → C | Cursor / selection / user info |
| `auth` | C → S | First message: JWT token |
| `queryAwareness` | C → S | "Who is here?" |

**Server: Hocuspocus (or self-hosted y-websocket).**

We recommend **Hocuspocus** (Tiptap's Yjs server) for:

- Built-in auth hooks (we plug NextAuth JWT verification).
- Built-in persistence (Postgres adapter for periodic snapshots).
- Built-in webhooks (we can post a "doc updated" event into our normal event bus when persistence completes).

**Persistence:** Every 100 updates, Hocuspocus writes the `Y.Doc` to Postgres as `bytea`. On load, the doc is hydrated; the first 3 clients to connect send a `sync step 1`, the server replies with the current state, and they're merged in <100 ms.

**Awareness → presence bridge.** Hocuspocus awareness messages are also published to `op:presence:doc:<id>` so non-Yjs clients (e.g., a "view-only" page) can still show "Bob is also here".

**Where T3 applies in OpenProject Rewrite:**

| Resource | Tier | Why |
|---|---|---|
| `Meeting#agenda` / minutes | **T3** | Meeting notes are the canonical "everyone types together" feature |
| `Document` body (Phase 4) | **T3** | Document is the wiki replacement |
| `WorkPackage#description` | **T2** | Markdown, short, conflicts are tolerable |
| `WikiPage` body | **T1 (v1) → T3 (v2)** | Wiki pages are typically single-author; v2 adds CRDT for opt-in |
| `ForumThread` OP body | **T1** | Long-form, sequential editing preferred |
| `ForumPost` body | **T1** | Sequential |
| `News` body | **T1** | Single author, published model |

### 11.5 Choosing a tier — a heuristic

Ask three questions:

1. **Are multiple users likely to type at the exact same time?**
   No → T1 is fine.
   Sometimes → T2 (with merge UI).
   Yes → T3.

2. **Is the content structured (lists, tables, code blocks)?**
   Yes → T3 (Y.Array, Y.Map, Y.XmlFragment give us structure).

3. **Is the content short (<1 000 chars)?**
   Yes → T2 is fine.
   No → T3 if collaboration matters, T1 if not.

---

## 12. Realtime UI Patterns

### 12.1 Toast notifications

```typescript
// components/notifications/ToastHost.tsx
import { useToast } from '@/components/ui/toast';

export function useRealtimeToasts() {
  const { toast } = useToast();
  useSSE({
    onEvent: (env) => {
      if (env.type === 'notification.created') {
        const n = env.payload as Notification;
        toast({
          title: n.reason === 'mentioned' ? `${n.actor.name} mentioned you` : n.reason,
          description: n.subject,
          action: n.subjectHref ? { label: 'Open', onClick: () => router.push(n.subjectHref) } : undefined,
        });
      }
    },
  });
}
```

Best practices:

- **De-duplicate** by `envelope.id` (toasts for the same event must not double-fire).
- **Persist across navigations** with a Zustand store keyed by `envelope.id`.
- **Respect "do not disturb"** user preference (`@/stores/notification-store`).
- **Audio cue** for high-priority events (configurable, off by default).

### 12.2 Optimistic UI updates

Pattern:

```typescript
const queryClient = useQueryClient();
const updateWP = useMutation({
  mutationFn: (input) => api.patch(`/work_packages/${id}`, input),
  onMutate: async (input) => {
    await queryClient.cancelQueries({ queryKey: ['wp', id] });
    const previous = queryClient.getQueryData(['wp', id]);
    queryClient.setQueryData(['wp', id], (old) => ({ ...old, ...input, _optimistic: true }));
    return { previous };
  },
  onError: (err, input, ctx) => {
    if (err.code === 'VERSION_CONFLICT') openMergeDialog(err, input, ctx);
    else queryClient.setQueryData(['wp', id], ctx.previous);
  },
  onSettled: () => queryClient.invalidateQueries({ queryKey: ['wp', id] }),
});
```

The `_optimistic: true` flag dims the row in the UI until the server confirms.

### 12.3 Conflict resolution UI

The merge dialog (see §13) presents a three-way diff: "Your change vs. their change vs. original". Per-field radio buttons. After resolving, the client retries with the merged payload and the new `lockVersion`.

### 12.4 Live indicator (online / idle / offline)

```typescript
// components/presence/PresenceDot.tsx
export function PresenceDot({ userId }: { userId: string }) {
  const status = usePresenceStatus(userId); // 'online' | 'idle' | 'offline'
  const color = { online: 'bg-green-500', idle: 'bg-yellow-400', offline: 'bg-gray-300' }[status];
  return <span className={clsx('inline-block h-2 w-2 rounded-full', color)} aria-label={status} />;
}
```

Animated pulse for "online" via Tailwind `animate-pulse`. Tooltip on hover shows last seen.

### 12.5 Activity feed push

```typescript
const { data: activities } = useQuery({
  queryKey: ['activities', projectId],
  queryFn: () => api.get(`/projects/${projectId}/activities?since=${lastEventId}`),
});

useRealtime({
  channel: `project:${projectId}`,
  onEvent: (env) => {
    if (env.type === 'activity.created') {
      queryClient.setQueryData(['activities', projectId], (old) => ({
        ...old,
        events: [env.payload, ...old.events].slice(0, 50),
      }));
    }
  },
});
```

### 12.6 Live cursors on the board view

```typescript
// components/board/BoardLiveCursors.tsx
export function BoardLiveCursors({ boardId }: { boardId: string }) {
  const cursors = useCursors(`board:${boardId}`); // { userId, x, y, color, name }[]
  return (
    <>
      {cursors.map((c) => (
        <Cursor
          key={c.userId}
          x={c.x}
          y={c.y}
          color={c.color}
          name={c.name}
        />
      ))}
    </>
  );
}

// In BoardView:
<div onMouseMove={(e) => {
  const rect = e.currentTarget.getBoundingClientRect();
  realtime.send({ op: 'presence.cursor', channel: `board:${boardId}`, x: e.clientX - rect.left, y: e.clientY - rect.top });
}}>
```

Throttle to 30 Hz (`requestAnimationFrame`).

### 12.7 "X is typing…" indicator (forum / comments)

Use Yjs awareness OR a simple debounced WebSocket message:

```typescript
const sendTyping = useDebouncedCallback(
  () => realtime.send({ op: 'typing.start', channel: `forum:42:thread:7` }),
  1000
);
```

Server fans out to other subscribers of the channel as `presence.typing` events. UI shows a "Bob is typing…" line.

---

## 13. Conflict Resolution UX

### 13.1 The Merge Dialog (wireframe in words)

```
┌────────────────────────────────────────────────────────────────────┐
│  ⚠️ Someone else updated this work package              [×]        │
├────────────────────────────────────────────────────────────────────┤
│  Field         Original     Yours       Theirs       Resolution    │
│  ─────────     ─────────    ────────    ─────────    ────────────  │
│  Subject       Plan v1      Plan v2     Plan v1.1   ◉ theirs      │
│                                                          ○ mine    │
│                                                          ○ custom  │
│  Description   ...         ...         ...         ◉ mine        │
│  Assignee      Alice        Alice       Bob          ◉ theirs     │
│  Status        Open         Open        In Progress  ⚠ conflict   │
│                                                              [pick]│
│  Due date      2026-01-15  2026-01-20  2026-01-15  ◉ mine        │
├────────────────────────────────────────────────────────────────────┤
│  [Cancel]                              [Apply & retry]              │
└────────────────────────────────────────────────────────────────────┘
```

### 13.2 Implementation

```typescript
// components/merge/MergeDialog.tsx
export function MergeDialog({ mine, theirs, original, onResolve }: Props) {
  const fields = useMemo(() => diffFields(mine, theirs, original), [mine, theirs, original]);
  const [resolution, setResolution] = useState<Record<string, 'mine' | 'theirs' | 'custom'>>(
    () => Object.fromEntries(fields.map((f) => [f.key, autoPick(f)]))
  );
  // ...
}
```

### 13.3 Server-side `If-Match` retry loop

```typescript
async function applyMerge(id: string, merged: object, maxAttempts = 3) {
  let attempt = 0;
  while (attempt < maxAttempts) {
    try {
      return await api.patch(`/work_packages/${id}`, merged, {
        headers: { 'If-Match': `"${merged.lockVersion}"` },
      });
    } catch (e) {
      if (e.status !== 409) throw e;
      // Re-merge against the new server state
      const fresh = await api.get(`/work_packages/${id}`);
      merged = autoMerge(merged, fresh, original);
      merged.lockVersion = fresh.lockVersion;
      attempt++;
    }
  }
  throw new Error('Could not converge after 3 attempts');
}
```

---

## 14. Server Code Patterns

### 14.1 SSE endpoint (final form)

```typescript
// pages/api/sse/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Redis } from '@upstash/redis';
import { ulid } from 'ulid';
import { publish } from '@/lib/realtime/event-bus';

export const config = { api: { bodyParser: false } };

const HEARTBEAT_MS = 25_000;
const USER_CHANNELS_KEY = (uid: string) => `sse:channels:${uid}`;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'UNAUTHORIZED' });
  const userId = (session.user as any).id;
  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
  res.flushHeaders();

  // Subscribe to user + project channels
  const redis = new Redis({ url: process.env.UPSTASH_REDIS_URL!, token: process.env.UPSTASH_REDIS_TOKEN! });
  const subscriber = redis.duplicate();

  const channels = [`op:user:${userId}`];
  // Look up the user's project memberships to pre-subscribe
  const memberProjects = await redis.smembers(`user:${userId}:projects`);
  for (const pid of memberProjects) channels.push(`op:project:${pid}`);

  await subscriber.subscribe(...channels);
  await redis.sadd(USER_CHANNELS_KEY(userId), 'sse');
  await redis.expire(USER_CHANNELS_KEY(userId), 60 * 60);

  // Replay from last-event-id
  const lastId = req.headers['last-event-id'] as string | undefined;
  if (lastId) {
    for (const ch of channels) {
      const entries = await redis.xread(`op:stream:${ch}`, lastId, 'COUNT', 100);
      for (const [, , fields] of entries ?? []) {
        const msg = (fields as any).msg as string;
        const env = JSON.parse(msg);
        res.write(`id: ${env.id}\nevent: ${env.type}\ndata: ${msg}\n\n`);
      }
    }
  }

  // Greet
  res.write(`event: connected\ndata: ${JSON.stringify({ id: ulid(), type: 'connected', userId, timestamp: Date.now() })}\n\n`);

  // Heartbeat
  const hb = setInterval(() => {
    if (res.writable) res.write(`: heartbeat ${Date.now()}\n\n`);
  }, HEARTBEAT_MS);

  // Message pump
  subscriber.on('message', (ch: string, message: string) => {
    if (!res.writable) return;
    let env: any;
    try { env = JSON.parse(message); } catch { return; }
    res.write(`id: ${env.id}\nevent: ${env.type}\ndata: ${message}\n\n`);
  });

  // Cleanup
  req.socket.on('close', async () => {
    clearInterval(hb);
    try { await subscriber.unsubscribe(...channels); } catch {}
    try { await subscriber.quit(); } catch {}
    await redis.srem(USER_CHANNELS_KEY(userId), 'sse');
  });
}
```

### 14.2 WebSocket gateway

On Pages Router, the cleanest path is a **custom server** (`server.ts`) that handles the WS upgrade, while Next.js handles HTTP. This way we don't fight Vercel's runtime.

```typescript
// server.ts (dev: tsx server.ts; prod: node dist/server.js)
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { WebSocketServer } from 'ws';
import { attachWSHandlers } from './lib/realtime/ws-gateway';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => handle(req, res, parse(req.url!, true)));
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const { pathname, query } = parse(req.url!, true);
    if (pathname === '/api/ws') {
      wss.handleUpgrade(req, socket, head, (ws) => attachWSHandlers(ws, req, query));
    } else {
      socket.destroy();
    }
  });

  server.listen(3000, () => console.log('> Ready on http://localhost:3000'));
});
```

```typescript
// lib/realtime/ws-gateway.ts
import { WebSocket } from 'ws';
import { verifyJwt } from '@/lib/auth';
import { Redis } from '@upstash/redis';
import { publish } from './event-bus';

type Connection = {
  id: string;
  ws: WebSocket;
  userId: string;
  channels: Set<string>;
  redis: Redis;
  subscriber: any;
};

const connections = new Map<string, Connection>();

export function attachWSHandlers(ws: WebSocket, req: any, query: any) {
  const id = crypto.randomUUID();
  const token = query.token as string;
  const user = verifyJwt(token);
  if (!user) { ws.close(4401, 'Unauthorized'); return; }

  const redis = new Redis({ url: process.env.UPSTASH_REDIS_URL!, token: process.env.UPSTASH_REDIS_TOKEN! });
  const subscriber = redis.duplicate();
  const conn: Connection = { id, ws, userId: user.id, channels: new Set(), redis, subscriber };
  connections.set(id, conn);

  ws.on('message', (raw) => handleMessage(conn, raw.toString()));
  ws.on('close', () => cleanup(conn));

  ws.send(JSON.stringify({ op: 'hello', connectionId: id, userId: user.id }));
}

async function handleMessage(conn: Connection, raw: string) {
  let msg: any;
  try { msg = JSON.parse(raw); } catch { return; }

  switch (msg.op) {
    case 'subscribe':
      for (const ch of msg.channels ?? []) {
        if (conn.channels.has(ch)) continue;
        if (!(await authorize(conn.userId, ch))) {
          conn.ws.send(JSON.stringify({ op: 'subscribe.error', channel: ch, reason: 'forbidden' }));
          continue;
        }
        await conn.subscriber.subscribe(`op:${ch}`);
        conn.subscriber.on('message', (channelName: string, message: string) => {
          if (conn.ws.readyState !== 1) return;
          conn.ws.send(message);
        });
        conn.channels.add(ch);
        // Presence join
        if (ch.startsWith('project:') || ch.startsWith('wp:')) {
          await conn.redis.sadd(`presence:scope:${ch}`, conn.userId);
          await publish(`presence:${ch}`, {
            type: 'presence.joined',
            channel: ch,
            payload: { userId: conn.userId },
          });
        }
      }
      conn.ws.send(JSON.stringify({ op: 'subscribed', channels: [...conn.channels] }));
      break;

    case 'unsubscribe':
      // symmetric to above
      break;

    case 'presence.cursor':
      // Throttled server-side; broadcast to other subscribers of board:<id>
      if (msg.channel?.startsWith('board:')) {
        await publish(`presence:${msg.channel}`, {
          type: 'presence.cursor',
          channel: msg.channel,
          payload: { userId: conn.userId, x: msg.x, y: msg.y, selectionId: msg.selectionId },
        });
      }
      break;

    case 'presence.heartbeat':
      await conn.redis.hset(`presence:user:${conn.userId}`, { lastSeen: Date.now(), status: 'active' });
      await conn.redis.expire(`presence:user:${conn.userId}`, 60);
      break;

    case 'lock.acquire':
      // ... see §11.2
      break;

    default:
      conn.ws.send(JSON.stringify({ op: 'error', message: `Unknown op: ${msg.op}` }));
  }
}

async function cleanup(conn: Connection) {
  for (const ch of conn.channels) {
    await conn.redis.srem(`presence:scope:${ch}`, conn.userId);
    await publish(`presence:${ch}`, {
      type: 'presence.left',
      channel: ch,
      payload: { userId: conn.userId },
    });
    try { await conn.subscriber.unsubscribe(`op:${ch}`); } catch {}
  }
  try { await conn.subscriber.quit(); } catch {}
  connections.delete(conn.id);
}
```

### 14.3 Yjs sync endpoint (Hocuspocus-style, or use Hocuspocus directly)

We recommend running **Hocuspocus** as a sidecar process (not in the Next.js process). It's a Node WebSocket server purpose-built for Yjs.

```typescript
// yjs-server.ts
import { Server } from '@hocuspocus/server';
import { Database } from '@hocuspocus/extension-database';
import { TiptapTransformer } from '@hocuspocus/transformer';
import { prisma } from '@/lib/prisma';
import { verifyJwt } from '@/lib/auth';
import { publish } from '@/lib/realtime/event-bus';

const server = new Server({
  port: 1234,
  extensions: [
    new Database({
      fetch: async ({ documentName }) => {
        const doc = await prisma.document.findUnique({ where: { id: documentName } });
        return doc?.yjsState ?? null; // bytea
      },
      store: async ({ documentName, state }) => {
        await prisma.document.upsert({
          where: { id: documentName },
          create: { id: documentName, yjsState: state },
          update: { yjsState: state, updatedAt: new Date() },
        });
        await publish({
          type: 'doc.saved',
          channel: `doc:${documentName}`,
          payload: { id: documentName, savedAt: Date.now() },
        });
      },
    }),
  ],
  async onAuthenticate({ token, documentName }) {
    const user = await verifyJwt(token);
    if (!user) throw new Error('Unauthorized');
    const doc = await prisma.document.findUnique({ where: { id: documentName } });
    if (!doc) throw new Error('Not found');
    if (doc.projectId) {
      const member = await prisma.member.findUnique({
        where: { projectId_userId: { projectId: doc.projectId, userId: user.id } },
      });
      if (!member) throw new Error('Forbidden');
    }
    return { user };
  },
});

server.listen();
```

---

## 15. Client Hook Patterns

### 15.1 `useSSE` (refactored, typed)

```typescript
// hooks/useSSE.ts
import { useEffect, useRef } from 'react';
import type { EventEnvelope, TypedEventMap } from '@/types/realtime';

type SSEOptions<TMap extends TypedEventMap> = {
  channels?: string[];                              // project:42, wp:123
  onEvent?: <K extends keyof TMap>(env: EventEnvelope<TMap[K]>) => void;
  onOpen?: () => void;
  onError?: (e: Event) => void;
};

export function useSSE<TMap extends TypedEventMap = TypedEventMap>(
  opts: SSEOptions<TMap> = {}
) {
  const { channels, onEvent, onOpen, onError } = opts;
  const ref = useRef<EventSource | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams();
    if (channels?.length) params.set('channels', channels.join(','));
    const url = `/api/sse${params.toString() ? `?${params}` : ''}`;
    const es = new EventSource(url, { withCredentials: true });
    ref.current = es;

    es.addEventListener('open', () => onOpen?.());
    es.addEventListener('error', (e) => onError?.(e));

    // Listen to a curated set of event types
    const types: (keyof TMap)[] = [
      'work_package.updated', 'work_package.created', 'work_package.deleted',
      'notification.created', 'activity.created',
      'presence.joined', 'presence.left', 'presence.idle', 'presence.cursor',
      'lock.acquired', 'lock.released',
    ];
    for (const t of types) {
      es.addEventListener(t as string, (e: MessageEvent) => {
        try {
          const env = JSON.parse(e.data) as EventEnvelope<TMap[typeof t]>;
          onEvent?.(env);
        } catch (err) { console.error('SSE parse', err); }
      });
    }

    return () => { es.close(); ref.current = null; };
  }, [channels?.join(','), onEvent, onOpen, onError]);
}
```

### 15.2 `useRealtime` (WebSocket gateway, typed)

```typescript
// hooks/useRealtime.ts
import { useEffect, useRef, useCallback } from 'react';

type RealtimeMessage = { op: string; [k: string]: any };

export function useRealtime(opts: {
  onMessage?: (msg: RealtimeMessage) => void;
  onOpen?: () => void;
}) {
  const wsRef = useRef<WebSocket | null>(null);
  const queue = useRef<RealtimeMessage[]>([]);
  const attempt = useRef(0);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let alive = true;
    const connect = () => {
      if (!alive) return;
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const url = `${proto}://${location.host}/api/ws?token=${encodeURIComponent(getWsToken())}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        attempt.current = 0;
        opts.onOpen?.();
        // flush queue
        for (const m of queue.current) ws.send(JSON.stringify(m));
        queue.current = [];
        // presence heartbeat
        pingRef.current = setInterval(() => {
          if (ws.readyState === 1) ws.send(JSON.stringify({ op: 'presence.heartbeat' }));
        }, 20_000);
      };
      ws.onmessage = (e) => {
        if (typeof e.data !== 'string') return; // binary handled by useLiveEdit
        try { opts.onMessage?.(JSON.parse(e.data)); } catch {}
      };
      ws.onclose = () => {
        if (pingRef.current) clearInterval(pingRef.current);
        const delay = Math.min(30_000, 500 * 2 ** attempt.current++) + Math.random() * 500;
        setTimeout(connect, delay);
      };
      ws.onerror = () => ws.close();
    };
    connect();
    return () => {
      alive = false;
      if (pingRef.current) clearInterval(pingRef.current);
      wsRef.current?.close();
    };
  }, []);

  const send = useCallback((m: RealtimeMessage) => {
    if (wsRef.current?.readyState === 1) wsRef.current.send(JSON.stringify(m));
    else queue.current.push(m);
  }, []);

  return { send };
}

function getWsToken(): string {
  // Reuse the NextAuth JWT — short-lived (5 min) and re-issued on refresh
  return document.cookie.match(/next-auth\.session-token=([^;]+)/)?.[1] ?? '';
}
```

### 15.3 `usePresence`

```typescript
// hooks/usePresence.ts
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRealtime } from './useRealtime';

type PresenceStatus = 'online' | 'idle' | 'offline';
type Presence = { userId: string; status: PresenceStatus; lastSeen?: number };

export function usePresenceScope(channel: string) {
  const qc = useQueryClient();
  const { data } = useQuery<Presence[]>({
    queryKey: ['presence', channel],
    queryFn: () => fetch(`/api/presence?channel=${encodeURIComponent(channel)}`).then((r) => r.json()),
    staleTime: 30_000,
  });
  useRealtime({
    onMessage: (msg) => {
      if (msg.op === 'event' && msg.channel === `presence:${channel}`) {
        if (msg.type === 'presence.joined') {
          qc.setQueryData<Presence[]>(['presence', channel], (old) => [
            ...(old ?? []).filter((p) => p.userId !== msg.payload.userId),
            { userId: msg.payload.userId, status: 'online' },
          ]);
        }
        if (msg.type === 'presence.left' || msg.type === 'presence.idle') {
          qc.setQueryData<Presence[]>(['presence', channel], (old) =>
            (old ?? []).map((p) => p.userId === msg.payload.userId
              ? { ...p, status: msg.type === 'presence.left' ? 'offline' : 'idle' }
              : p)
          );
        }
      }
    },
  });
  return data ?? [];
}

export function usePresenceStatus(userId: string): PresenceStatus {
  // Walk all known presence queries (cheap because TanStack Query indexes them)
  const qc = useQueryClient();
  const all = qc.getQueriesData<Presence[]>({ queryKey: ['presence'] });
  for (const [, data] of all) {
    const found = data?.find((p) => p.userId === userId);
    if (found) return found.status;
  }
  return 'offline';
}
```

### 15.4 `useLiveEdit` (Yjs)

```typescript
// hooks/useLiveEdit.ts
import { useEffect, useState } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { Awareness } from 'y-protocols/awareness';

export function useLiveEdit(docId: string, token: string) {
  const [ydoc] = useState(() => new Y.Doc());
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const [synced, setSynced] = useState(false);
  const [peers, setPeers] = useState<{ clientId: number; user?: { name: string; color: string } }[]>([]);

  useEffect(() => {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const wp = new WebsocketProvider(`${proto}://${location.host}/yjs`, docId, ydoc, {
      params: { token },
    });
    setProvider(wp);
    wp.on('synced', (isSynced: boolean) => setSynced(isSynced));
    const awareness = wp.awareness as Awareness;
    const updatePeers = () => {
      setPeers(
        Array.from(awareness.getStates().entries()).map(([clientId, state]) => ({
          clientId,
          user: state.user as any,
        }))
      );
    };
    awareness.on('change', updatePeers);
    updatePeers();
    return () => { awareness.off('change', updatePeers); wp.destroy(); };
  }, [docId, token]);

  return { ydoc, provider, synced, peers };
}
```

```typescript
// components/editor/CollaborativeEditor.tsx
import { useLiveEdit } from '@/hooks/useLiveEdit';
import { useEditor, EditorContent } from '@tiptap/react';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';

export function CollaborativeEditor({ docId, user }: { docId: string; user: User }) {
  const { ydoc, provider, synced, peers } = useLiveEdit(docId, getWsToken());
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ history: false }), // Yjs provides history
      Collaboration.configure({ document: ydoc }),
      ...(provider ? [CollaborationCursor.configure({ provider, user })] : []),
    ],
  }, [provider]);

  if (!synced) return <Spinner label="Loading document…" />;
  return <EditorContent editor={editor} />;
}
```

---

## 16. Typed Event Bus

### 16.1 Discriminated union

```typescript
// types/realtime.ts
import { z } from 'zod';

// ---- Zod schemas (single source of truth) ----
export const WorkPackageRefSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  lockVersion: z.number().int().nonnegative(),
});
export type WorkPackageRef = z.infer<typeof WorkPackageRefSchema>;

export const WorkPackageChangesSchema = z.object({
  id: z.string(),
  changes: z.record(z.string(), z.any()),
  lockVersion: z.number().int().nonnegative(),
  actorId: z.string(),
});
export type WorkPackageChanges = z.infer<typeof WorkPackageChangesSchema>;

export const NotificationRefSchema = z.object({
  id: z.string(),
  recipientId: z.string(),
  reason: z.string(),
  subject: z.string().optional(),
  subjectHref: z.string().optional(),
  actor: z.object({ id: z.string(), name: z.string(), avatarUrl: z.string().optional() }),
  readAt: z.string().datetime().nullable(),
});
export type NotificationRef = z.infer<typeof NotificationRefSchema>;

export const ActivityRefSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  verb: z.string(),
  actor: z.object({ id: z.string(), name: z.string() }),
  target: z.object({ type: z.string(), id: z.string(), title: z.string().optional() }),
  createdAt: z.string().datetime(),
});
export type ActivityRef = z.infer<typeof ActivityRefSchema>;

export const PresencePayloadSchema = z.object({
  userId: z.string(),
  channel: z.string(),
  x: z.number().optional(),
  y: z.number().optional(),
  selectionId: z.string().optional(),
});
export type PresencePayload = z.infer<typeof PresencePayloadSchema>;

export const LockPayloadSchema = z.object({
  resourceType: z.enum(['wiki', 'forum_thread', 'forum_post', 'document']),
  resourceId: z.string(),
  userId: z.string(),
  expiresAt: z.number(),
  heldBy: z.object({ userId: z.string(), expiresAt: z.number() }).optional(),
});
export type LockPayload = z.infer<typeof LockPayloadSchema>;

// ---- Discriminated union of all event payloads ----
export type EventPayloadMap = {
  'work_package.created': WorkPackageRef;
  'work_package.updated': WorkPackageChanges;
  'work_package.deleted': { id: string };
  'notification.created': NotificationRef;
  'activity.created': ActivityRef;
  'presence.joined': PresencePayload;
  'presence.left': PresencePayload;
  'presence.idle': PresencePayload;
  'presence.cursor': PresencePayload;
  'lock.acquired': LockPayload;
  'lock.released': LockPayload;
  'lock.denied': LockPayload;
  'connected': { userId: string };
  'doc.saved': { id: string; savedAt: number };
};
export type EventType = keyof EventPayloadMap;
export type TypedEventMap = EventPayloadMap;

export interface EventEnvelope<T = unknown> {
  id: string;
  type: EventType | string;
  version: number;
  channel: string;
  origin: string;
  timestamp: number;
  correlationId?: string;
  actorId?: string;
  payload: T;
  replay?: boolean;
}
```

### 16.2 Typed publisher

```typescript
// lib/realtime/event-bus.ts
import type { EventPayloadMap, EventType, EventEnvelope } from '@/types/realtime';
import { Redis } from '@upstash/redis';
import { ulid } from 'ulid';

const SCHEMAS: { [K in EventType]?: ZodSchema } = {
  'work_package.updated': WorkPackageChangesSchema,
  'work_package.created': WorkPackageRefSchema,
  'notification.created': NotificationRefSchema,
  'activity.created': ActivityRefSchema,
  'presence.joined': PresencePayloadSchema,
  'lock.acquired': LockPayloadSchema,
  // ...
};

export async function publish<K extends EventType>(
  args: {
    type: K;
    channel: string;
    payload: EventPayloadMap[K];
    actorId?: string;
    correlationId?: string;
  }
): Promise<string> {
  const schema = SCHEMAS[args.type];
  if (schema) schema.parse(args.payload);   // throws on invalid

  const envelope: EventEnvelope<EventPayloadMap[K]> = {
    id: ulid(),
    type: args.type,
    version: 1,
    channel: args.channel,
    origin: process.env.HOSTNAME ?? 'unknown',
    timestamp: Date.now(),
    correlationId: args.correlationId,
    actorId: args.actorId,
    payload: args.payload,
  };

  const redis = getRedisPublisher();
  const json = JSON.stringify(envelope);

  await Promise.all([
    redis.publish(`op:${args.channel}`, json),
    redis.xadd(`op:stream:${args.channel}`, 'MAXLEN', '~', 10000, '*', { id: envelope.id, type: args.type, msg: json }),
  ]);
  return envelope.id;
}
```

### 16.3 Typed consumer

```typescript
// hooks/useTypedEvent.ts
import { useEffect } from 'react';
import type { EventPayloadMap, EventType } from '@/types/realtime';
import { useSSE } from './useSSE';

export function useTypedEvent<K extends EventType>(
  type: K,
  handler: (payload: EventPayloadMap[K], env: EventEnvelope<EventPayloadMap[K]>) => void,
  channels: string[] = []
) {
  useSSE({
    channels,
    onEvent: (env) => {
      if (env.type === type) handler(env.payload, env);
    },
  });
}

// Usage:
useTypedEvent('work_package.updated', (payload, env) => {
  console.log('WP', payload.id, 'updated to lockVersion', payload.lockVersion);
}, [`project:${projectId}`]);
```

---

## 17. Optimistic Update with Rollback

### 17.1 Generic optimistic helper

```typescript
// lib/query/optimistic.ts
import { QueryClient, QueryKey, MutateOptions } from '@tanstack/react-query';

type OptimisticContext<T> = { previous?: T };

export async function optimisticUpdate<TData, TVariables>(
  qc: QueryClient,
  key: QueryKey,
  mutateFn: (vars: TVariables) => Promise<TData>,
  apply: (old: TData | undefined, vars: TVariables) => TData,
  vars: TVariables
): Promise<TData> {
  await qc.cancelQueries({ queryKey: key });
  const previous = qc.getQueryData<TData>(key);
  qc.setQueryData<TData>(key, (old) => apply(old, vars));
  try {
    return await mutateFn(vars);
  } catch (err) {
    qc.setQueryData(key, previous);
    throw err;
  }
}
```

### 17.2 Work-package patch with conflict handling

```typescript
// hooks/useWorkPackageMutations.ts
export function useUpdateWorkPackage(id: string) {
  const qc = useQueryClient();
  const merge = useMergeDialog();
  return useMutation({
    mutationFn: async (input: WPInput) => {
      const current = qc.getQueryData<WorkPackage>(['wp', id]);
      return apiFetch<WorkPackage>(`/api/v3/work_packages/${id}`, {
        method: 'PATCH',
        headers: { 'If-Match': `"${current!.lockVersion}"`, 'content-type': 'application/json' },
        body: JSON.stringify(input),
      });
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ['wp', id] });
      const previous = qc.getQueryData<WorkPackage>(['wp', id]);
      qc.setQueryData<WorkPackage>(['wp', id], (old) => ({ ...old!, ...input, _optimistic: true }));
      return { previous };
    },
    onError: async (err: any, _input, ctx) => {
      if (err.code === 'VERSION_CONFLICT') {
        const fresh = await apiFetch<WorkPackage>(`/api/v3/work_packages/${id}`);
        merge.open({
          mine: ctx!.previous!,
          theirs: fresh,
          base: await fetchBaseVersion(id, ctx!.previous!.lockVersion),
          onResolve: async (resolved) => {
            qc.setQueryData(['wp', id], { ...resolved, _optimistic: true });
            try {
              const final = await apiFetch<WorkPackage>(`/api/v3/work_packages/${id}`, {
                method: 'PATCH',
                headers: { 'If-Match': `"${resolved.lockVersion}"`, 'content-type': 'application/json' },
                body: JSON.stringify(resolved),
              });
              qc.setQueryData(['wp', id], final);
            } catch (e) { qc.setQueryData(['wp', id'], ctx!.previous); }
          },
        });
      } else {
        qc.setQueryData(['wp', id'], ctx!.previous);
      }
    },
    onSuccess: (wp) => qc.setQueryData(['wp', id'], wp),
    onSettled: () => qc.invalidateQueries({ queryKey: ['wp', id'] }),
  });
}
```

### 17.3 What the user sees

| t | Action | UI |
|---|---|---|
| 0 ms | User edits "Title" field | Input shows new value, dimmed |
| 5 ms | Optimistic apply | Card row updates immediately |
| 30 ms | PATCH sent | Spinner on the field |
| 80 ms | 200 OK | Field "snaps" to canonical (no visible change) |
| 80 ms (alt) | 409 Conflict | Toast "Another user updated this — open merge?" |
| 250 ms | User clicks merge | Merge dialog opens |
| 1.2 s | User resolves, clicks Apply | Optimistic retry, succeeds, dialog closes |

---

## 18. WebRTC Considerations (Optional)

### 18.1 When we'd reach for it

- Voice/video calls in `Meeting` (Phase 5). Not in v2 scope.
- True mesh collaboration with server offload. Not on our roadmap.

### 18.2 Why we don't use it now

- TURN servers are expensive and operationally heavy.
- Audio/video in OP can be served by a third-party (Daily.co, Jitsi embed) much more cheaply.
- CRDT (Yjs) doesn't need WebRTC; it works fine over WS.

### 18.3 Reserved for v3

If we ever add voice/video or screen sharing, the abstraction is in place: `useRealtime({ channel: "meeting:42:audio" })` already gives us a signaling channel; we add `RTCPeerConnection` and `getUserMedia` on top.

---

## 19. Scaling — From Redis to Streams to NATS/Kafka

### 19.1 v2 (current target) — Upstash Redis

```
  ── 1 Redis instance
  ── ~10 k connections per shard
  ── Pub/Sub fan-out (transient)
  ── Streams for replay (durable, MAXLEN 10k)
  ── ~100 k events/sec aggregate
```

Pros: zero new infra. Cons: Pub/Sub doesn't survive a Redis restart, and there's no cross-region replication on Upstash.

### 19.2 v3 — Multi-region / sharded

When traffic outgrows a single Upstash region, we move to **NATS JetStream**:

- JetStream gives us **persistent streams with replay** (like Kafka-lite).
- Subject-based routing (`op.project.42.work_package.updated`) maps to our channel model natively.
- Geo-replication across regions.
- At-least-once with deduplication by message id.

### 19.3 v4 — Kafka

If we ever cross 100 k events/sec sustained (say, 100 k concurrent users), we move to **Kafka** (Confluent Cloud or MSK). At that point:

- Topics: `op.work_package.updated`, `op.notification.created`, `op.presence.cursor`, …
- Consumer groups: one per WS gateway pod, one per analytics sink, one per audit log.
- Schema Registry for envelope evolution.
- Replay for free.

### 19.4 Decision matrix

| Scale | Pub/Sub | Streams | Bus |
|---|---|---|---|
| < 1 000 concurrent | ✅ | (replay only) | Upstash Redis |
| 1 k – 10 k concurrent | ✅ | ✅ | Upstash Redis (or self-hosted Redis Cluster) |
| 10 k – 100 k concurrent | ⚠ | ✅ | NATS JetStream |
| > 100 k concurrent | ❌ | ⚠ | Kafka |

### 19.5 What we abstract away

All transport details live behind two interfaces:

```typescript
interface EventBus {
  publish(env: EventEnvelope): Promise<void>;
  subscribe(channels: string[], onMessage: (env: EventEnvelope) => void): Promise<Unsubscribe>;
}
```

The Upstash and NATS implementations share this interface. When we migrate, only the implementation file changes.

---

## 20. Testing Realtime

### 20.1 Unit: mock `EventSource`

```typescript
// tests/mocks/event-source.ts
export class MockEventSource {
  url: string;
  readyState = 0;
  onopen: ((e: Event) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  private listeners = new Map<string, ((e: MessageEvent) => void)[]>();

  constructor(url: string) {
    this.url = url;
    queueMicrotask(() => {
      this.readyState = 1;
      this.onopen?.(new Event('open'));
    });
  }

  addEventListener(type: string, cb: (e: MessageEvent) => void) {
    const arr = this.listeners.get(type) ?? [];
    arr.push(cb);
    this.listeners.set(type, arr);
    if (type === 'message') this.onmessage = cb;
  }

  removeEventListener(type: string, cb: (e: MessageEvent) => void) {
    const arr = this.listeners.get(type) ?? [];
    this.listeners.set(type, arr.filter((f) => f !== cb));
  }

  close() { this.readyState = 2; }

  // Test helper
  emit(env: EventEnvelope) {
    const e = new MessageEvent('message', { data: JSON.stringify(env) });
    this.listeners.get('message')?.forEach((cb) => cb(e));
  }
}

// vitest setup
beforeAll(() => {
  (globalThis as any).EventSource = MockEventSource;
});
```

### 20.2 Component test: `useSSE` with mock

```typescript
// tests/hooks/useSSE.test.ts
import { renderHook, act } from '@testing-library/react';
import { useSSE } from '@/hooks/useSSE';
import { EventSource as Mock } from '../mocks/event-source';

it('invokes onEvent when a work_package.updated event arrives', () => {
  const onEvent = vi.fn();
  renderHook(() => useSSE({ onEvent }));
  const es = (globalThis as any).EventSource.lastInstance as Mock;
  act(() => {
    es.emit({ id: '01H...', type: 'work_package.updated', version: 1, channel: 'project:42',
              origin: 'test', timestamp: Date.now(), payload: { id: 'wp_1', changes: { title: 'New' }, lockVersion: 2, actorId: 'u_1' } });
  });
  expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'work_package.updated' }));
});
```

### 20.3 Integration test with real Redis

```typescript
// tests/integration/realtime.test.ts
import { Redis } from '@upstash/redis';
import { publish } from '@/lib/realtime/event-bus';

const TEST_REDIS = new Redis({ url: process.env.TEST_REDIS_URL!, token: process.env.TEST_REDIS_TOKEN! });

it('round-trips an event', async () => {
  const sub = TEST_REDIS.duplicate();
  const got: any[] = [];
  await sub.subscribe('op:user:test');
  sub.on('message', (_ch, msg) => got.push(JSON.parse(msg)));

  await publish({ type: 'work_package.created', channel: 'user:test', payload: { id: 'wp_x', projectId: 'p_1', lockVersion: 0 } });

  await new Promise((r) => setTimeout(r, 200));
  expect(got).toHaveLength(1);
  expect(got[0].type).toBe('work_package.created');
  await sub.quit();
});
```

### 20.4 Load test — 1 000 concurrent SSE connections

Use **k6** with the `k6/experimental/websockets` module for WS, and a tiny Node script for SSE (since SSE is just HTTP).

```javascript
// tests/load/sse-1k.js (k6)
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = { vus: 1000, duration: '60s' };

export default function () {
  const res = http.get(`${__ENV.BASE}/api/sse`, { headers: { Cookie: `next-auth.session-token=${__ENV.TOKEN}` } });
  check(res, { 'status 200': (r) => r.status === 200, 'is event-stream': (r) => r.headers['Content-Type']?.includes('event-stream') });
  // Keep open for 30s
  sleep(30);
}
```

Target: **1 000 VUs, 60 s, p95 connect < 500 ms, server RSS < 600 MB**.

For a more realistic test, **publish 10 events/s** on a shared project channel and measure per-client delivery latency:

```bash
node scripts/load-broadcaster.js --channel=op:project:42 --rate=10
```

### 20.5 Yjs test

```typescript
// tests/integration/yjs.test.ts
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import WebSocket from 'ws';

it('two clients converge on the same doc', async () => {
  const docA = new Y.Doc(); const docB = new Y.Doc();
  const url = 'ws://localhost:1234';
  const pa = new WebsocketProvider(url, 'doc_test', docA, { WebSocketPolyfill: WebSocket as any, params: { token: TEST_TOKEN } });
  const pb = new WebsocketProvider(url, 'doc_test', docB, { WebSocketPolyfill: WebSocket as any, params: { token: TEST_TOKEN } });
  const textA = docA.getText('content'); const textB = docB.getText('content');
  await new Promise((r) => pa.on('synced', r));
  await new Promise((r) => pb.on('synced', r));
  textA.insert(0, 'Hello');
  await new Promise((r) => setTimeout(r, 200));
  expect(textB.toString()).toBe('Hello');
  pa.destroy(); pb.destroy();
});
```

---

## 21. Observability, Security & Rate Limiting

### 21.1 Observability

- **Sentry:** wrap publish/subscribe in spans; tag with `channel`, `event.type`, `connection.id`.
- **Pino logs:** structured logs at every publish (`event.published`), subscribe (`event.subscribed`), conflict (`event.conflict`).
- **Prometheus metrics:**
  - `realtime_events_published_total{type,channel}` counter
  - `realtime_events_delivered_total{type,channel,transport}` counter
  - `realtime_subscribers{channel}` gauge
  - `realtime_conflicts_total{resource_type}` counter
  - `realtime_presence_active_users` gauge
  - `realtime_ws_connections` gauge
  - `realtime_sse_connections` gauge
  - `realtime_redis_publish_latency_ms` histogram
  - `realtime_redis_xadd_latency_ms` histogram

### 21.2 Security

- **Auth:** SSE uses NextAuth session cookie. WS uses a short-lived (5 min) JWT derived from the NextAuth session; refreshed on every WS reconnect.
- **Authorization on subscribe:** every WS `subscribe` message is checked against `Member`/`Watcher`/resource ACL.
- **Channel isolation:** a user can only subscribe to channels they have ACL for; the server rejects with `{ op: 'subscribe.error', reason: 'forbidden' }`.
- **Rate limiting:** WS messages per connection are limited via `@upstash/ratelimit` (e.g., 60 msg/s for cursor; 5 msg/s for lock ops).
- **Origin check:** WS upgrade only allowed from same origin.
- **Payload size limit:** WS messages capped at 64 KB (Yjs uses binary frames and lives in a different WS path with its own size limits).
- **No PII in event payloads:** we publish resource IDs and summary fields only; full objects fetched via REST.

### 21.3 Rate limiting

```typescript
// lib/realtime/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();
export const cursorLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.tokenBucket(60, '1 s', 60),
  analytics: true,
  prefix: 'rl:cursor',
});

export const lockLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 s'),
  prefix: 'rl:lock',
});
```

---

## 22. Migration Plan — SSE-only → Hybrid SSE+WS

### 22.1 Phase R1 — Foundations (week 1-2)

- Add `ws@8`, `yjs@13`, `y-websocket@2`, `y-protocols@1`, `@hocuspocus/server@2` to deps.
- Create `lib/realtime/` directory tree: `event-bus.ts`, `publish.ts`, `presence.ts`, `lock.ts`, `ws-gateway.ts`, `yjs-server.ts`.
- Add `EventEnvelope` + Zod schemas in `types/realtime.ts`.
- Unify `lib/notifications/realtime.ts` and `lib/realtime.ts` (delete the duplicate).
- Add `lockVersion Int @default(0)` to all mutable models (migration).

### 22.2 Phase R2 — Optimistic concurrency (week 2-3)

- Add `If-Match` handling to PATCH/DELETE routes for: `work_package`, `comment`, `document`, `wiki_page`, `meeting`, `project`.
- Add 409 response with `VERSION_CONFLICT` shape.
- Add ETag header to GET responses (`ETag: "<lockVersion>"`).
- Add `useUpdateWorkPackage` (and analogues) with `onMutate`/`onError` rollback.
- Add `MergeDialog` component.
- Add auto-merge helper for non-overlapping fields.

### 22.3 Phase R3 — SSE v2 (week 3-4)

- Update `/api/sse` to read `Last-Event-ID` and replay from Streams.
- Add `MAXLEN` to all `xadd` calls.
- Add typed `useSSE` hook with discriminated union.
- Add presence channels (`presence:user`, `presence:project`, `presence:wp`).
- Update existing `broadcastWorkPackageUpdate` to use the new typed bus.

### 22.4 Phase R4 — WebSocket gateway (week 4-6)

- Add `server.ts` custom server with WS upgrade.
- Add `useRealtime` hook with reconnect/queue.
- Add `presence.heartbeat`, `presence.cursor`, `presence.typing` ops.
- Add `lock.acquire`/`lock.release` ops (T1).
- Wire up to project pages, WP pages, board view.
- Migrate "user online" status from periodic poll to WS.

### 22.5 Phase R5 — Yjs / CRDT (week 6-8)

- Stand up Hocuspocus as a sidecar.
- Wire `Document` editor to Yjs (Phase 4 model).
- Wire `Meeting#agenda` to Yjs.
- Add `useLiveEdit` hook + Tiptap integration.
- Add `doc.saved` event into the event bus for activity feed.

### 22.6 Phase R6 — Polish (week 8-10)

- Load test 1 000 concurrent SSE + 1 000 concurrent WS.
- Sentry dashboards for realtime spans.
- Prometheus metrics + Grafana panel.
- Runbook for "Redis pub/sub broken" (fall back to in-process pub/sub for the lifetime of one Lambda).
- Document the event catalog in `/docs/realtime-events.md`.

### 22.7 Backwards compatibility

- Existing `useSSE` clients (which pass `?userId=...` query param) keep working — the server uses the **session** for auth and **ignores** the query param (with a `console.warn` if it doesn't match).
- Existing event types (`work_package.updated`, `notification.new`) keep the same names so deployed clients don't break.
- Add new event types under new names; never rename a published event without a `version: 2` dual-publish window.

### 22.8 Feature flags

Use **PostHog** or a simple Redis flag to enable new features per project/user:

```
SETEX "flag:realtime:v2:<projectId>" 86400 "true"
```

Routes check the flag before emitting `version: 2` events.

---

## 23. Comparison with Original OpenProject (ActionCable)

### 23.1 What the original does

The original OpenProject (Rails) uses **ActionCable** for realtime:

- Server-side: ActionCable runs inside the Rails process (or a separate Puma worker). Each channel is a Ruby class.
- Client-side: `@rails/actioncable` (JS) maintains one WS connection per user, multiplexes channels over it.
- Events are essentially JSON over a custom ActionCable wire format.
- Authentication is the Rails session cookie.

### 23.2 Comparison

| Aspect | ActionCable (Rails original) | Our v2 (Next.js + WS + SSE) |
|---|---|---|
| Transport | WS only (with long-poll fallback) | SSE for fan-out + WS for bidirectional |
| Server | In-process with Rails | Serverless (SSE) + Node gateway (WS) |
| Pub/Sub backend | Redis (single instance) or PostgreSQL | Upstash Redis (Pub/Sub + Streams) |
| Event schema | Untyped JSON; documented in Ruby | Zod-validated discriminated union; typed in TS |
| Replay | ❌ (must re-fetch on reconnect) | ✅ Last-Event-ID + Streams |
| Optimistic concurrency | `lock_version` integer + 409 (Rails) | `lockVersion` + `If-Match` + ETag (HTTP-standard) |
| Presence | Polling / ActionCable channel | Server-tracked via Redis with idle detection |
| Live editing | Pessimistic lock only (Wiki, Documents) | Yjs CRDT (Docs, Meetings) + lock (Wiki) |
| Schema evolution | Manual, no version field | Envelope has `version`; producers pin to a major |
| Client complexity | `@rails/actioncable` (~80 KB) | Native `EventSource` (0 KB) + native `WebSocket` (0 KB) |
| Cold start | Slow (Rails boots) | Fast (serverless) |
| Horizontal scaling | Sticky sessions or Redis adapter | Stateless (SSE) + sharded gateway (WS) |
| Backpressure | In-process queue | Kernel buffer aware; pause/resume subscriber |
| Outbox pattern | `after_commit` callbacks (best-effort) | `prisma.$transaction` with `outbox_event` (atomic) |

### 23.3 What we do better

1. **Replay** is a first-class concern; flaky mobile networks don't lose events.
2. **Schema validation** at the boundary; bad payloads fail loud at publish time.
3. **Yjs** for true multi-cursor editing on documents and meeting minutes, where the original locks the page to one editor.
4. **Last-Event-ID** is browser-native, no custom protocol.
5. **Outbox** guarantees we never publish an event for a rolled-back transaction.
6. **HTTP-standard concurrency** (`If-Match`/`ETag`) is well understood by HTTP clients and proxies; the original `lock_version` header is Rails-specific.
7. **No sticky sessions** required.

### 23.4 What we lose vs. ActionCable

- ActionCable's **automatic channel multiplexing** (one WS, many rooms) — we re-implement this in our gateway (subscribed channels set per connection).
- The Rails ecosystem of **ActionCable extensions** (we don't have a mature alternative for `yjs`-as-a-service, so we operate Hocuspocus ourselves).
- **Long-poll fallback** (ActionCable falls back to HTTP polling when WS is blocked). We accept that some corporate networks will block WS; in those cases SSE carries most of the load and the user can still get notifications, just no live cursors.

---

## 24. Roadmap & Phased Rollout

| Phase | Week | Deliverable | Acceptance |
|---|---|---|---|
| R1 | 1-2 | Typed event bus, Zod schemas, lockVersion migration | All PATCH routes set ETag; outbox table exists |
| R2 | 2-3 | If-Match + 409 + merge dialog | Conflict dialog appears for race; auto-merge works for non-overlapping |
| R3 | 3-4 | SSE v2: replay, typed events, presence channels | `Last-Event-ID` reconnect replays 100 events; presence accurate ±10 s |
| R4 | 4-6 | WebSocket gateway + presence + edit locks | Live cursors on board; wiki lock works; presence "online" badge |
| R5 | 6-8 | Yjs (Hocuspocus) for Documents + Meeting minutes | Two browsers type in same doc; text converges; awareness shows both cursors |
| R6 | 8-10 | Load test 1 k SSE + 1 k WS, observability, docs | p95 < 300 ms; no errors at 1 k sustained; Sentry + Prometheus wired |

---

## 25. Top 10 Realtime Improvements vs Current

1. **Hybrid transport (SSE + WS).** One-way fan-out stays on the simple, serverless-friendly SSE; bidirectional flows (presence, edit locks, CRDT) get a real WebSocket. The current SSE-only design makes presence and live editing impossible.
2. **Channel model + per-channel auth.** Subscribe to `project:42` or `wp:123` explicitly; the server checks ACL on every subscribe. The current per-user channel forces O(N) fan-out per project event and leaks nothing to non-members.
3. **Optimistic concurrency with `If-Match` + `lockVersion` + ETag.** 409 responses, three-way merge UI, auto-merge for non-overlapping fields. The current last-write-wins silently destroys user work.
4. **Typed event bus with Zod-validated discriminated unions.** Compile-time safety, runtime validation, single source of truth for the wire format. The current `type: string` parser silently drops unknown events.
5. **Last-Event-ID replay via Redis Streams.** Mobile users reconnecting after a network blip catch up to the last 100 events. The current SSE has no replay.
6. **Presence system** (online / idle / offline + per-scope). A 5-minute idle threshold, last-seen timestamps, scope sets in Redis. The current code has zero presence.
7. **Outbox pattern for at-least-once event delivery.** Events are written in the same DB transaction as the business change; a worker flushes them to Redis. The current `broadcastWorkPackageUpdate` can publish an event for a transaction that was rolled back.
8. **Yjs CRDT for collaborative editing** on Documents and Meeting minutes. Multi-cursor, eventually consistent, offline-tolerant. The current code only supports pessimistic locking.
9. **Backpressure-aware SSE** with `pause`/`resume` on `drain`, plus a 30-second slow-client disconnect policy. The current code will OOM if a client is slow.
10. **Observability: Sentry spans + Prometheus metrics** for every event (publish, deliver, conflict, presence). The current code logs `console.log` for unknown events; we cannot answer "what is our p95 fan-out latency" today.

---

## 26. Appendices — Reference Code, Tables, Diagrams

### 26.1 Prisma schema additions (v2)

```prisma
// Add to WorkPackage, Comment, Document, WikiPage, Meeting, Project, etc.
model WorkPackage {
  // ... existing fields ...
  lockVersion Int @default(0)
  // ... existing relations ...
}

model OutboxEvent {
  id          String   @id              // ULID
  type        String                     // event type
  channel     String                     // channel name
  payload     Json
  publishedAt DateTime?                  // null until flushed
  createdAt   DateTime @default(now())
  @@index([publishedAt, createdAt])
}
```

### 26.2 Event catalog (one-pager)

| Type | Channel | Version | Payload summary |
|---|---|---|---|
| `work_package.created` | `wp:<id>`, `project:<id>` | 1 | `{ id, projectId, lockVersion }` |
| `work_package.updated` | `wp:<id>`, `project:<id>` | 1 | `{ id, changes, lockVersion, actorId }` |
| `work_package.deleted` | `wp:<id>`, `project:<id>` | 1 | `{ id }` |
| `work_package.moved` | `board:<id>` | 1 | `{ id, fromPosition, toPosition, columnId }` |
| `comment.added` | `wp:<id>` | 1 | `{ id, parentId, authorId }` |
| `comment.updated` | `wp:<id>` | 1 | `{ id }` |
| `comment.deleted` | `wp:<id>` | 1 | `{ id, parentType, parentId }` |
| `project.member_added` | `project:<id>` | 1 | `{ projectId, userId, role }` |
| `project.member_removed` | `project:<id>` | 1 | `{ projectId, userId }` |
| `notification.created` | `user:<id>` | 1 | `NotificationRef` |
| `activity.created` | `project:<id>` | 1 | `ActivityRef` |
| `presence.joined` | `presence:<scope>` | 1 | `{ userId, channel }` |
| `presence.left` | `presence:<scope>` | 1 | `{ userId, channel }` |
| `presence.idle` | `presence:user:<id>` | 1 | `{ userId }` |
| `presence.cursor` | `presence:board:<id>` | 1 | `{ userId, x, y, selectionId? }` |
| `lock.acquired` | `lock:<type>:<id>`, `project:<id>` | 1 | `{ resourceType, resourceId, userId, expiresAt }` |
| `lock.released` | `lock:<type>:<id>`, `project:<id>` | 1 | `{ resourceType, resourceId, userId }` |
| `lock.denied` | `user:<id>` (private) | 1 | `{ resourceType, resourceId, heldBy }` |
| `doc.saved` | `doc:<id>`, `project:<id>` | 1 | `{ id, savedAt }` |

### 26.3 Performance budget

| Operation | Target p95 | Notes |
|---|---|---|
| `publish()` to Redis | < 20 ms | Upstash region-local |
| Pub/Sub → SSE write | < 50 ms | In-memory fan-out |
| Pub/Sub → WS write | < 50 ms | In-memory fan-out |
| Yjs sync step (cold) | < 200 ms | Hocuspocus + Postgres fetch |
| Yjs incremental update | < 30 ms | Pure in-memory |
| 409 detection + merge UI render | < 100 ms | Client-side |
| Last-Event-ID replay (100 events) | < 500 ms | Stream `XRANGE` + bulk write |
| Lock acquire (Redis `SET NX`) | < 5 ms | |
| Presence heartbeat | < 10 ms | Redis `HSET` |

### 26.4 Channel ACL cheat sheet

| Channel | Required membership |
|---|---|
| `user:<id>` | The user themselves (session) |
| `project:<id>` | `Member(projectId=id, userId=me)` |
| `wp:<id>` | `Member(projectId=wp.projectId, userId=me)` OR `Watcher(wpId=id, userId=me)` |
| `doc:<id>` | `Member(projectId=doc.projectId, userId=me)` |
| `board:<id>` | `Member(projectId=board.projectId, userId=me)` |
| `forum:<id>` | `Member(projectId=forum.projectId, userId=me)` |
| `wiki:<pageId>` | `Member(projectId=page.projectId, userId=me)` |
| `announcement:<id>` | Any authenticated user |

### 26.5 Failure modes & mitigations

| Failure | Impact | Mitigation |
|---|---|---|
| Redis down | No realtime events | SSE/WS still open; clients retry; no data loss (Postgres is source of truth) |
| WS gateway pod crashes | Users reconnect to another pod | Re-subscribe on connect; presence rebuilt from Redis |
| Yjs Hocuspocus down | Doc editing blocked | Doc read still works; writes queue locally and sync on reconnect |
| Slow consumer (SSE) | OOM risk | Backpressure pause; 30 s slow-client timeout |
| Event payload drift (old client) | Crash or wrong data | `version` field; client pins to a major; server can dual-publish |
| Redis Streams `MAXLEN` truncates | Some events lost on replay window | Acceptable; cap is 5 min window; users re-fetch via REST |
| Sticky WebSocket session can't migrate | Some users get disconnected | Reconnect with backoff; subscribe is idempotent |
| Outbox row not flushed | Event lag | Inngest cron sweeps every 1 s; alerting on `publishedAt IS NULL AND createdAt < now - 1 min` |

### 26.6 Open questions (call for team input)

1. **Do we want optimistic concurrency on `Comment` edits?** Common pattern is **immutable** (edit creates a new comment). Recommend: keep comments immutable; only `lockVersion` for things that get edited.
2. **Should board-view cursor events be best-effort or persisted?** Recommend: best-effort, no Streams; drop on disconnect.
3. **Idle threshold: 5 min or 2 min?** Recommend: 5 min (matches Slack/Linear). Make it user-configurable.
4. **Do we ship Yjs for v2 or punt to v3?** Recommend: ship for `Document` (Phase 4) and `Meeting#agenda`. Skip wiki v1.
5. **What is the "presence:offline" eviction policy?** Recommend: 5 min after last heartbeat.

### 26.7 Glossary

- **SSE** — Server-Sent Events (HTTP/1.1 streaming, server → client only).
- **WS** — WebSocket (RFC 6455, bidirectional, framed).
- **CRDT** — Conflict-free Replicated Data Type. A data structure that can be edited concurrently on multiple nodes and will converge to the same state.
- **Yjs** — A high-performance CRDT library.
- **Hocuspocus** — A Yjs WebSocket server with auth, persistence, and webhooks (Tiptap).
- **Outbox pattern** — Writing events to a DB table inside the same transaction as the business change, then a separate worker publishes them. Guarantees at-least-once.
- **ETag** — HTTP response header that identifies a specific version of a resource; used with `If-Match` for optimistic concurrency.
- **Last-Event-ID** — HTTP header automatically set by the browser's `EventSource` on reconnect; used to resume from where the connection dropped.
- **Backpressure** — When a slow consumer forces the producer to slow down or buffer.
- **Outbox flush lag** — The delay between writing an outbox row and the worker publishing the corresponding event.

---

**End of document.**
