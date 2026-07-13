/**
 * Transport contract for the two-device room relay.
 *
 * The server holds no conversation state. It only relays messages between
 * the two members of a room. Event names and payload shapes here are the
 * single source of truth shared with the Socket.IO relay server.
 */

export type Role = "speaker" | "signer";

/**
 * "speech": speaker -> signer, rendered as the 3D avatar.
 * "sign":   signer -> speaker, rendered as text + speech synthesis.
 */
export type MessageKind = "speech" | "sign";

export interface JoinRoomRequest {
  roomId: string;
  role: Role;
}

export interface RoomJoinedAck {
  roomId: string;
  role: Role;
  peers: number;
}

export interface PeerJoinedEvent {
  role: Role;
}

export interface OutboundMessage {
  roomId: string;
  kind: MessageKind;
  text: string;
}

export interface InboundMessage {
  kind: MessageKind;
  text: string;
  fromRole: Role;
}

/** Server -> client error for a failed create/join. */
export interface RoomError {
  code: "room_not_found" | "room_full" | "invalid_role";
  message: string;
}

export const TRANSPORT_EVENTS = {
  createRoom: "create_room",
  joinRoom: "join_room",
  roomJoined: "room_joined",
  peerJoined: "peer_joined",
  peerLeft: "peer_left",
  message: "message",
  roomError: "room_error",
} as const;
