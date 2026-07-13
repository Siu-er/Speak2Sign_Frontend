"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createRoom as createRoomClient,
  joinRoom as joinRoomClient,
  getRoomState,
  leaveRoom as leaveRoomClient,
  ConnectionStatus,
  RoomState,
  sendMessage,
  subscribeMessages,
  subscribeState,
} from "@/app/lib/transport/socket-client";
import { InboundMessage, MessageKind, Role } from "@/app/lib/transport/types";

export interface UseRoomResult {
  connected: boolean;
  status: ConnectionStatus;
  error: string | null;
  roomId: string | null;
  role: Role | null;
  peerConnected: boolean;
  createRoom: (role: Role) => Promise<string>;
  joinRoom: (roomId: string, role: Role) => Promise<void>;
  send: (kind: MessageKind, text: string) => void;
  onMessage: (cb: (msg: InboundMessage) => void, replay?: boolean) => () => void;
  leaveRoom: () => void;
}

/**
 * React surface over the singleton room transport. State mirrors the shared
 * connection, so any screen reflects the room established during pairing.
 */
export function useRoom(): UseRoomResult {
  const [state, setState] = useState<RoomState>(getRoomState);

  useEffect(() => subscribeState(setState), []);

  const createRoom = useCallback(
    (role: Role) => createRoomClient(role),
    [],
  );

  const joinRoom = useCallback(async (roomId: string, role: Role) => {
    await joinRoomClient(roomId, role);
  }, []);

  const send = useCallback((kind: MessageKind, text: string) => {
    sendMessage(kind, text);
  }, []);

  const onMessage = useCallback(
    (cb: (msg: InboundMessage) => void, replay = false) =>
      subscribeMessages(cb, replay),
    [],
  );

  const leaveRoom = useCallback(() => leaveRoomClient(), []);

  return {
    connected: state.connected,
    status: state.status,
    error: state.error,
    roomId: state.roomId,
    role: state.role,
    peerConnected: state.peerConnected,
    createRoom,
    joinRoom,
    send,
    onMessage,
    leaveRoom,
  };
}
