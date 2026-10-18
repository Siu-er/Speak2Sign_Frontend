/**
 * Singleton Socket.IO connection plus the room state it carries.
 *
 * Room state lives here, at module scope, so it survives client-side route
 * changes: the pairing screen establishes the room, then the capture and
 * receiver screens read the same live connection without re-pairing.
 */

import { io, Socket } from "socket.io-client";
import {
  InboundMessage,
  JoinError,
  MessageKind,
  OPPOSITE_ROLE,
  PresenceEvent,
  Role,
  RoleCounts,
  RoomJoinedAck,
  TRANSPORT_EVENTS,
} from "@/app/lib/transport/types";

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000";

export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting";

export interface RoomState {
  connected: boolean;
  status: ConnectionStatus;
  roomId: string | null;
  role: Role | null;
  counts: RoleCounts;
  /** At least one member of the opposite role is in the room. */
  peerConnected: boolean;
  error: string | null;
}

type StateListener = (state: RoomState) => void;
type MessageListener = (msg: InboundMessage) => void;

interface CreateRoomAck {
  roomId: string;
}

type JoinAck =
  | { ok: true; result: RoomJoinedAck }
  | { ok: false; error: JoinError };

/**
 * The room this client means to be in, so a dropped socket can re-join it once
 * it reconnects. A meeting room is re-created by the join if the server
 * restarted; a pair room is not, because its code was issued by the server.
 */
type Membership =
  | { kind: "pair"; roomId: string; role: Role }
  | { kind: "meeting"; meetingCode: string; role: Role };

const EMPTY_COUNTS: RoleCounts = { speaker: 0, signer: 0 };

const JOIN_ERROR_TEXT: Record<JoinError, string> = {
  room_not_found: "The conversation ended (room no longer exists).",
  room_full: "This conversation already has two devices.",
  invalid_role: "Choose speaker or signer.",
  invalid_meeting_code: "This is not a Google Meet meeting code.",
};

let socket: Socket | null = null;
let membership: Membership | null = null;

const state: RoomState = {
  connected: false,
  status: "idle",
  roomId: null,
  role: null,
  counts: EMPTY_COUNTS,
  peerConnected: false,
  error: null,
};

const stateListeners = new Set<StateListener>();
const messageListeners = new Set<MessageListener>();

const MAX_BUFFERED_MESSAGES = 100;
const recentMessages: InboundMessage[] = [];

function snapshot(): RoomState {
  return { ...state, counts: { ...state.counts } };
}

function emitState(): void {
  const s = snapshot();
  stateListeners.forEach((l) => l(s));
}

function applyCounts(counts: RoleCounts): void {
  state.counts = counts;
  state.peerConnected = state.role !== null && counts[OPPOSITE_ROLE[state.role]] > 0;
}

function getSocket(): Socket {
  if (socket) return socket;

  socket = io(SOCKET_URL, {
    autoConnect: false,
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 3000,
  });

  socket.on("connect", () => {
    state.connected = true;
    state.status = "connected";
    state.error = null;
    if (membership) rejoin(membership);
    emitState();
  });

  socket.on("disconnect", (reason: string) => {
    state.connected = false;
    applyCounts(EMPTY_COUNTS);
    // Manual leaveRoom() disconnects intentionally; anything else is a drop
    // that Socket.IO will retry.
    state.status = reason === "io client disconnect" ? "idle" : "reconnecting";
    emitState();
  });

  socket.on("connect_error", (err: Error) => {
    if (membership) state.error = `Connection problem: ${err.message}`;
    emitState();
  });

  socket.io.on("reconnect_attempt", () => {
    state.status = "reconnecting";
    emitState();
  });

  socket.io.on("reconnect_failed", () => {
    state.error = "Connection lost. Check the server and retry.";
    emitState();
  });

  socket.on(TRANSPORT_EVENTS.presence, (event: PresenceEvent) => {
    applyCounts(event.counts);
    emitState();
  });

  socket.on(TRANSPORT_EVENTS.message, (msg: InboundMessage) => {
    recentMessages.push(msg);
    if (recentMessages.length > MAX_BUFFERED_MESSAGES) recentMessages.shift();
    messageListeners.forEach((l) => l(msg));
  });

  return socket;
}

function joinRequest(m: Membership): [string, object] {
  return m.kind === "pair"
    ? [TRANSPORT_EVENTS.joinRoom, { roomId: m.roomId, role: m.role }]
    : [TRANSPORT_EVENTS.joinMeeting, { meetingCode: m.meetingCode, role: m.role }];
}

function applyJoined(m: Membership, result: RoomJoinedAck): void {
  membership = m;
  state.roomId = result.roomId;
  state.role = result.role;
  applyCounts(result.counts);
  state.error = null;
}

function rejoin(m: Membership): void {
  const [event, payload] = joinRequest(m);
  getSocket().emit(event, payload, (ack: JoinAck) => {
    if ("error" in ack) state.error = JOIN_ERROR_TEXT[ack.error];
    else applyJoined(m, ack.result);
    emitState();
  });
}

function ensureConnected(): Promise<Socket> {
  const s = getSocket();
  if (s.connected) return Promise.resolve(s);
  if (state.status !== "reconnecting") {
    state.status = "connecting";
    emitState();
  }
  return new Promise((resolve, reject) => {
    const onConnect = () => {
      s.off("connect_error", onError);
      resolve(s);
    };
    const onError = (err: Error) => {
      s.off("connect", onConnect);
      reject(err);
    };
    s.once("connect", onConnect);
    s.once("connect_error", onError);
    s.connect();
  });
}

async function join(m: Membership): Promise<RoomJoinedAck> {
  const s = await ensureConnected();
  const [event, payload] = joinRequest(m);
  return new Promise((resolve, reject) => {
    s.emit(event, payload, (ack: JoinAck) => {
      if ("error" in ack) {
        reject(new Error(JOIN_ERROR_TEXT[ack.error]));
        return;
      }
      applyJoined(m, ack.result);
      emitState();
      resolve(ack.result);
    });
  });
}

export async function createRoom(role: Role): Promise<string> {
  const s = await ensureConnected();
  const roomId = await new Promise<string>((resolve, reject) => {
    s.emit(TRANSPORT_EVENTS.createRoom, (ack: CreateRoomAck) => {
      if (!ack?.roomId) {
        reject(new Error("create_room returned no roomId"));
        return;
      }
      resolve(ack.roomId);
    });
  });
  await join({ kind: "pair", roomId, role });
  return roomId;
}

export async function joinRoom(roomId: string, role: Role): Promise<RoomJoinedAck> {
  return join({ kind: "pair", roomId, role });
}

export async function joinMeeting(meetingCode: string, role: Role): Promise<RoomJoinedAck> {
  return join({ kind: "meeting", meetingCode, role });
}

export function sendMessage(kind: MessageKind, text: string): void {
  if (!state.roomId) throw new Error("sendMessage before joining a room");
  getSocket().emit(TRANSPORT_EVENTS.message, {
    roomId: state.roomId,
    kind,
    text,
  });
}

export function leaveRoom(): void {
  membership = null;
  if (socket?.connected) socket.disconnect();
  recentMessages.length = 0;
  state.roomId = null;
  state.role = null;
  applyCounts(EMPTY_COUNTS);
  state.connected = false;
  state.status = "idle";
  state.error = null;
  emitState();
}

export function getRoomState(): RoomState {
  return snapshot();
}

export function subscribeState(listener: StateListener): () => void {
  stateListeners.add(listener);
  listener(snapshot());
  return () => stateListeners.delete(listener);
}

export function subscribeMessages(
  listener: MessageListener,
  replay = false,
): () => void {
  messageListeners.add(listener);
  if (replay) recentMessages.forEach((m) => listener(m));
  return () => messageListeners.delete(listener);
}
