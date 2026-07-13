# Backend Wiring & Two-Device Transport - Design Doc

## Context

The mobile UI is built as a proof of concept with stubbed data. The
backend exposes a complete, stateless pipeline. This work connects the
two and adds the missing layer: a transport that links two paired
devices so one person's input is rendered as the other person's output.

The result screens are receiver views. They render data arriving from
the paired device, not local output.

## Current State

Backend (Flask, stateless REST):
- `/audio-to-text` - Whisper STT (multipart WAV)
- `/text-to-gloss` - English → ASL gloss
- `/gloss-to-sigml` - gloss → SiGML XML
- `/sign-to-text` - landmarks → sign (plus `all_probs`)
- `/sign-labels` - 250-word vocabulary
- No realtime layer. `flask-socketio` installed; `eventlet` absent.

Frontend (Next.js mobile):
- `/sign` - wired to live recognition engine (MediaPipe + `/sign-to-text`)
- `/speak`, `/result/speak`, `/result/sign` - stubbed, no transport
- `SiGMLDisplay` - CWASA 3D avatar, plays SiGML (reusable)
- `socket.io-client` installed

## Goal

```
Device A (speaker)            Backend relay            Device B (signer)
  mic → WAV → /audio-to-text
       ──── emit text ────►   room broadcast  ────►   recv text
                                                        /text-to-gloss
                                                        /gloss-to-sigml
                                                        → SiGMLDisplay avatar

  recv words ◄────────────    room broadcast  ◄────   /sign-to-text words
  text + TTS                                            camera capture
```

## Implementation Strategy: Hybrid

Foundation-driven for the transport layer (both directions depend on
it), then vertical slices per communication direction.

Rationale: the room relay is a shared foundation. Building it first and
verifying message exchange (L1, two browser tabs) de-risks both
directions. Each direction is then an independently deliverable vertical
slice through capture → transport → render.

Alternatives rejected:
- WebRTC peer-to-peer: no server relay needed, but signaling still
  requires a server, NAT traversal adds complexity, and payloads here
  are tiny text, so relay is simpler and sufficient.
- Pure REST polling: higher latency, wasteful, no push. Realtime
  conversation needs server push.

## Transport Design

Socket.IO room relay, `async_mode='threading'` (avoids the missing
eventlet; needs `simple-websocket` for the websocket transport).

Server holds no conversation state. It only relays messages between the
two members of a room. Stateless beyond room membership.

### Events

| Event | Direction | Payload | Purpose |
|-------|-----------|---------|---------|
| `create_room` | client → server | (none) | server returns unique `roomId` |
| `join_room` | client → server | `{ roomId, role }` | join existing room |
| `room_joined` | server → client | `{ roomId, role, peers }` | ack + peer count |
| `peer_joined` | server → client | `{ role }` | other device connected |
| `peer_left` | server → client | (none) | other device disconnected |
| `message` | client → server | `{ roomId, kind, text }` | relay payload |
| `message` | server → client | `{ kind, text, fromRole }` | delivered to peer |

`kind`: `"speech"` (speaker → signer, render as avatar) or `"sign"`
(signer → speaker, render as text + TTS).

Room id: server-generated, collision-checked against active rooms
(deterministic uniqueness, not random-and-hope).

### Pairing tiers (degrade gracefully, all feed the same room)

1. NFC tap (Phase 4, Android HCE) emits roomId
2. QR scan (Phase 2) encodes roomId
3. Manual room code (Phase 1) typed; proves the whole system

## Frontend Architecture

```
useRoom (Socket.IO hook)
  - createRoom() / joinRoom(code, role)
  - send(kind, text)
  - onMessage(cb)
  - state: roomId, role, peerConnected
```

- `lib/transport/socket-client.ts` - singleton Socket.IO connection
- `app/hooks/useRoom.ts` - room lifecycle & messaging
- `lib/audio/wav-encoder.ts` - extracted WAV 16k encode (shared by
  `/speak` & any future audio capture; removes duplication with
  `VADVoiceRecorder`)

### Screen wiring

| Screen | Role | Wires to |
|--------|------|----------|
| `/speak` | speaker capture | mic → `wav-encoder` → `/audio-to-text` → `send("speech", text)` |
| `/result/sign` | speaker receiver | `onMessage("sign")` → text + `speechSynthesis` |
| `/sign` | signer capture | recognition engine → `send("sign", words)` |
| `/result/speak` | signer receiver | `onMessage("speech")` → `/text-to-gloss` → `/gloss-to-sigml` → `SiGMLDisplay` |

## Risks & Mitigation

| Risk | Mitigation |
|------|-----------|
| eventlet missing | `async_mode='threading'` + `simple-websocket` |
| Flask debug reloader drops socket conns | run socket server without reloader, or accept reconnect |
| WAV encode duplication | extract `lib/audio/wav-encoder.ts`, reuse |
| Avatar CDN blocked by COEP | COEP already `credentialless` (handled earlier) |
| Room code collision | server-side uniqueness check on generation |
| Single-device testing | loopback: two browser tabs, same room, opposite roles |

## Phasing & Verification (L1 priority)

| Phase | Deliverable | L1 verification |
|-------|-------------|-----------------|
| 1a | Socket.IO relay + `useRoom` + manual code pairing | two tabs exchange a `message` |
| 1b | Speak → avatar slice | speak in tab A, avatar signs in tab B |
| 1c | Sign → TTS slice | sign in tab A, text + TTS in tab B |
| 2 | QR pairing | scan joins room |
| 3 | Capacitor wrap | web runs in native shell |
| 4 | NFC tap (Android HCE) | tap transfers roomId, auto-join |

Integration point (hybrid): each phase verified at L1, actual end-user
value through the real interface (two devices/tabs), not unit mocks.

## Out of Scope (this doc)

- Conversation persistence / history backend (currently mocked)
- User accounts / auth
- iOS-to-iOS NFC tap (Apple blocks HCE; QR fallback)
- Multi-party (more than 2) rooms
