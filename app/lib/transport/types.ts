/**
 * Transport contract for the room relay.
 *
 * The server holds no conversation state. It relays each message from a member
 * to every member of the opposite role in the room. Event names and payload
 * shapes here are the single source of truth shared with the Socket.IO relay.
 *
 * A pair room joins two devices through a code; a meeting room is keyed by a
 * Google Meet meeting code and holds any number of speakers and signers.
 */

export type Role = "speaker" | "signer";

export const OPPOSITE_ROLE: Record<Role, Role> = { speaker: "signer", signer: "speaker" };

/**
 * "speech": speaker -> signers, rendered as the 3D avatar.
 * "sign":   signer -> speakers, rendered as text + speech synthesis.
 */
export type MessageKind = "speech" | "sign";

export type RoleCounts = Record<Role, number>;

/** Google Meet meeting codes: three, four and three lowercase letters. */
export const MEETING_CODE_PATTERN = /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/;

export interface JoinRoomRequest {
  roomId: string;
  role: Role;
}

export interface JoinMeetingRequest {
  meetingCode: string;
  role: Role;
}

export interface RoomJoinedAck {
  roomId: string;
  role: Role;
  counts: RoleCounts;
}

export interface PresenceEvent {
  counts: RoleCounts;
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

export type JoinError =
  | "room_not_found"
  | "room_full"
  | "invalid_role"
  | "invalid_meeting_code";

export const TRANSPORT_EVENTS = {
  createRoom: "create_room",
  joinRoom: "join_room",
  joinMeeting: "join_meeting",
  presence: "presence",
  message: "message",
} as const;
