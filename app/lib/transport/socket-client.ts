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
  MessageKind,
  Role,
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
  | { ok: false; error: string };

let socket: Socket | null = null;
// What we want to be a member of, so a dropped socket can silently re-join
// the same room once it reconnects.
let desiredRoom: { roomId: string; role: Role } | null = null;

const state: RoomState = {
  connected: false,
  status: "idle",
  roomId: null,
  role: null,
  peerConnected: false,
  error: null,
};

const stateListeners = new Set<StateListener>();
const messageListeners = new Set<MessageListener>();

const MAX_BUFFERED_MESSAGES = 100;
const recentMessages: InboundMessage[] = [];

function snapshot(): RoomState {
  return { ...state };
}

function emitState(): void {
  const s = snapshot();
  stateListeners.forEach((l) => l(s));
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
    // If we already had a room, this is a reconnect: silently re-join it.
    if (desiredRoom) rejoin();
    emitState();
  });

  socket.on("disconnect", (reason: string) => {
    state.connected = false;
    state.peerConnected = false;
    // Manual leaveRoom() disconnects intentionally; anything else is a drop
    // that Socket.IO will retry.
    state.status = reason === "io client disconnect" ? "idle" : "reconnecting";
    emitState();
  });

  socket.on("connect_error", (err: Error) => {
    if (desiredRoom) state.error = `Connection problem: ${err.message}`;
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

  socket.on(TRANSPORT_EVENTS.peerJoined, () => {
    state.peerConnected = true;
    emitState();
  });

  socket.on(TRANSPORT_EVENTS.peerLeft, () => {
    state.peerConnected = false;
    emitState();
  });

  socket.on(TRANSPORT_EVENTS.message, (msg: InboundMessage) => {
    recentMessages.push(msg);
    if (recentMessages.length > MAX_BUFFERED_MESSAGES) recentMessages.shift();
    messageListeners.forEach((l) => l(msg));
  });

  return socket;
}

function rejoin(): void {
  if (!desiredRoom || !socket) return;
  socket.emit(TRANSPORT_EVENTS.joinRoom, desiredRoom, (ack: JoinAck) => {
    if (ack && ack.ok) {
      state.roomId = ack.result.roomId;
      state.role = ack.result.role;
      state.peerConnected = ack.result.peers > 1;
      state.error = null;
    } else {
      state.error = "The conversation ended (room no longer exists).";
    }
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

async function join(roomId: string, role: Role): Promise<RoomJoinedAck> {
  const s = await ensureConnected();
  return new Promise((resolve, reject) => {
    s.emit(
      TRANSPORT_EVENTS.joinRoom,
      { roomId, role },
      (ack: JoinAck) => {
        if (!ack || ack.ok === false) {
          const reason = ack && ack.ok === false ? ack.error : "join_room failed";
          reject(new Error(reason || "join_room failed"));
          return;
        }
        state.roomId = ack.result.roomId;
        state.role = ack.result.role;
        state.peerConnected = ack.result.peers > 1;
        desiredRoom = { roomId: ack.result.roomId, role: ack.result.role };
        emitState();
        resolve(ack.result);
      },
    );
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
  await join(roomId, role);
  return roomId;
}

export async function joinRoom(roomId: string, role: Role): Promise<RoomJoinedAck> {
  return join(roomId, role);
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
  desiredRoom = null;
  if (socket?.connected) socket.disconnect();
  recentMessages.length = 0;
  state.roomId = null;
  state.role = null;
  state.peerConnected = false;
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
