// ws-bridge — Node ↔ Python WebSocket bridge.
// See docs/node-python-bridge.md for the full wire protocol.

export { BridgeClient, callOnce } from './client';
export type { BridgeClientOptions, EventHandler, BridgeFrame } from './client';
export { readToken, invalidateTokenCache, authFilePath } from './auth';
export type { AuthPayload } from './auth';
export {
  ulid,
  helloFrame,
  requestFrame,
  pingFrame,
  cancelFrame,
} from './frame';
export type { FrameKind, BridgeFrame as Frame } from './frame';

export const BRIDGE_PROTOCOL_VERSION = 1 as const;
