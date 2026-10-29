// Peer-to-Peer & E2EE Relay Session Manager for Empanel
import {
  deriveKeyFromPin,
  deriveRoomId,
  encryptPayload,
  decryptPayload,
  createAuthChallenge,
  computeAuthProof,
  verifyAuthProof,
  type EncryptedEnvelope,
} from './crypto';
import type { SyncStatus, WhisperMessage } from '../types';

export type SyncRole = 'host' | 'viewer';

export type SyncMutation =
  | {
      type: 'SNAPSHOT';
      payload: {
        activeCase: any;
        jurors: any[];
        questions: any[];
        causeChallenges: any[];
        peremptoryStrikes: any[];
      };
    }
  | { type: 'REQUEST_SNAPSHOT' }
  | { type: 'BATCH_JUROR_UPDATE'; jurors: any[] }
  | { type: 'UPDATE_JUROR'; jurorId: string; updates: any }
  | { type: 'UPDATE_CASE'; updates: any }
  | { type: 'TOGGLE_RESPONSE'; jurorId: string; questionId: string }
  | { type: 'ASSIGN_SEAT'; jurorId: string; seatNumber: number; isAlternate?: boolean }
  | { type: 'UNSEAT_JUROR'; jurorId: string }
  | { type: 'RECORD_STRIKE'; strike: any }
  | { type: 'RECORD_CAUSE'; challenge: any }
  | { type: 'REVERT_STRIKE'; jurorId: string }
  | { type: 'WHISPER'; message: WhisperMessage }
  | { type: 'DISMISS_WHISPER'; messageId: string }
  | { type: 'PING'; timestamp: number }
  | { type: 'PONG'; timestamp: number };

type SignalingMessage =
  | { type: 'PEER_JOIN'; role: SyncRole }
  | { type: 'AUTH_CHALLENGE'; challenge: string }
  | { type: 'AUTH_PROOF'; proof: string }
  | { type: 'AUTH_SUCCESS' }
  | { type: 'AUTH_FAIL'; attempt: number; maxAttempts: number }
  | { type: 'BURN_ROOM' }
  | { type: 'WEBRTC_OFFER'; sdp: EncryptedEnvelope }
  | { type: 'WEBRTC_ANSWER'; sdp: EncryptedEnvelope }
  | { type: 'WEBRTC_ICE'; candidate: EncryptedEnvelope }
  | { type: 'RELAY_MUTATION'; envelope: EncryptedEnvelope }
  | { type: 'PEER_LEAVE' };

export interface SyncSessionEvents {
  onStatusChange?: (status: SyncStatus) => void;
  onAttemptChange?: (attempts: number, max: number) => void;
  onMutationReceived?: (mutation: SyncMutation) => void;
  onWhisperReceived?: (whisper: WhisperMessage) => void;
  onError?: (error: string) => void;
  onLatencyUpdate?: (latencyMs: number) => void;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export class SyncSession {
  private role: SyncRole | null = null;
  private pin: string | null = null;
  private roomId: string | null = null;
  private cryptoKey: CryptoKey | null = null;
  private status: SyncStatus = 'idle';

  private failedAttempts: number = 0;
  private readonly maxAttempts: number = 3;

  private bc: BroadcastChannel | null = null;
  private ws: WebSocket | null = null;
  private pc: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private iceCandidateQueue: RTCIceCandidateInit[] = [];

  private currentAuthChallenge: string | null = null;
  private events: SyncSessionEvents = {};
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private joinRetryInterval: ReturnType<typeof setInterval> | null = null;
  private lastPingSent: number = 0;

  constructor(events: SyncSessionEvents = {}) {
    this.events = events;
  }

  public setEvents(events: SyncSessionEvents) {
    this.events = { ...this.events, ...events };
  }

  public getStatus(): SyncStatus {
    return this.status;
  }

  public getRole(): SyncRole | null {
    return this.role;
  }

  public getPin(): string | null {
    return this.pin;
  }

  public getFailedAttempts(): { current: number; max: number } {
    return { current: this.failedAttempts, max: this.maxAttempts };
  }

  private setStatus(newStatus: SyncStatus) {
    this.status = newStatus;
    this.events.onStatusChange?.(newStatus);
  }

  /**
   * Host starts a pairing session with the given 6-character PIN.
   */
  public async startHosting(pin: string) {
    this.cleanup();
    this.role = 'host';
    this.pin = pin;
    this.failedAttempts = 0;
    this.setStatus('hosting');

    try {
      this.roomId = await deriveRoomId(pin);
      this.cryptoKey = await deriveKeyFromPin(pin);
      this.events.onAttemptChange?.(0, this.maxAttempts);
      this.initSignaling();
    } catch (err: any) {
      this.setStatus('error');
      this.events.onError?.(err?.message || 'Failed to initialize host security');
    }
  }

  /**
   * Viewer joins a session with the given 6-character PIN.
   */
  public async joinSession(pin: string) {
    this.cleanup();
    this.role = 'viewer';
    this.pin = pin;
    this.setStatus('joining');

    try {
      this.roomId = await deriveRoomId(pin);
      this.cryptoKey = await deriveKeyFromPin(pin);
      this.initSignaling();

      // Announce presence immediately and retry periodically until challenge received
      this.sendSignalingMessage({ type: 'PEER_JOIN', role: 'viewer' });
      let attempts = 0;
      this.joinRetryInterval = setInterval(() => {
        if (this.status !== 'joining' || attempts++ >= 6) {
          if (this.joinRetryInterval) clearInterval(this.joinRetryInterval);
          return;
        }
        this.sendSignalingMessage({ type: 'PEER_JOIN', role: 'viewer' });
      }, 700);
    } catch (err: any) {
      this.setStatus('error');
      this.events.onError?.(err?.message || 'Failed to initialize session encryption');
    }
  }

  private initSignaling() {
    if (!this.roomId) return;

    // 1. Vite HMR Dev WebSocket (Enables cross-computer LAN testing with 0 setup!)
    const hot = (import.meta as any).hot;
    if (hot) {
      hot.on('empanel:signal', (payload: any) => {
        if (payload && payload.roomId === this.roomId) {
          this.handleSignalingMessage(payload.msg);
        }
      });
    }

    // 2. BroadcastChannel for same-browser cross-tab testing
    try {
      this.bc = new BroadcastChannel(`empanel-room-${this.roomId}`);
      this.bc.onmessage = (event) => {
        this.handleSignalingMessage(event.data);
      };
    } catch (e) {
      console.warn('BroadcastChannel not supported in this environment');
    }

    // 3. Connect to WebSocket signaling relay (Cloudflare Worker or fallback)
    const relayUrl = (window as any).__EMPANEL_RELAY_URL__ || this.getRelayUrl();
    if (relayUrl) {
      try {
        this.ws = new WebSocket(`${relayUrl}?room=${this.roomId}&role=${this.role}`);
        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleSignalingMessage(data);
          } catch (err) {
            console.error('Failed to parse WS message', err);
          }
        };
        this.ws.onclose = () => {
          if (this.status === 'connected_relay') {
            this.setStatus('disconnected');
          }
        };
      } catch (e) {
        console.warn('Could not establish WebSocket relay connection', e);
      }
    }
  }

  private getRelayUrl(): string | null {
    // If running in development Vite, Vite HMR plugin handles it via import.meta.hot!
    if ((import.meta as any).hot) {
      return null;
    }
    // Production Cloudflare Worker WebSocket relay endpoint
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/api/relay`;
  }

  private sendSignalingMessage(msg: SignalingMessage) {
    // 1. Vite HMR bus (cross-computer on LAN in dev)
    const hot = (import.meta as any).hot;
    if (hot) {
      try {
        hot.send('empanel:signal', { roomId: this.roomId, msg });
      } catch (e) {}
    }

    // 2. BroadcastChannel (same browser)
    if (this.bc) {
      try {
        this.bc.postMessage(msg);
      } catch (err) {}
    }

    // 3. WebSocket relay
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(msg));
      } catch (err) {}
    }
  }

  private async handleSignalingMessage(msg: SignalingMessage) {
    if (this.status === 'burned') return;

    switch (msg.type) {
      case 'PEER_JOIN':
        if (this.role === 'host') {
          // Send auth challenge to the newly joined peer
          this.currentAuthChallenge = createAuthChallenge();
          this.sendSignalingMessage({
            type: 'AUTH_CHALLENGE',
            challenge: this.currentAuthChallenge,
          });
        }
        break;

      case 'AUTH_CHALLENGE':
        if (this.role === 'viewer' && this.cryptoKey) {
          if (this.joinRetryInterval) {
            clearInterval(this.joinRetryInterval);
            this.joinRetryInterval = null;
          }
          const proof = await computeAuthProof(this.cryptoKey, msg.challenge);
          this.sendSignalingMessage({ type: 'AUTH_PROOF', proof });
        }
        break;

      case 'AUTH_PROOF':
        if (this.role === 'host' && this.cryptoKey && this.currentAuthChallenge) {
          const isValid = await verifyAuthProof(
            this.cryptoKey,
            this.currentAuthChallenge,
            msg.proof
          );

          if (isValid) {
            this.failedAttempts = 0;
            this.events.onAttemptChange?.(0, this.maxAttempts);
            this.sendSignalingMessage({ type: 'AUTH_SUCCESS' });
            await this.initWebRTC(true);
          } else {
            this.failedAttempts += 1;
            this.events.onAttemptChange?.(this.failedAttempts, this.maxAttempts);

            if (this.failedAttempts >= this.maxAttempts) {
              this.burnRoom();
            } else {
              this.sendSignalingMessage({
                type: 'AUTH_FAIL',
                attempt: this.failedAttempts,
                maxAttempts: this.maxAttempts,
              });
            }
          }
        }
        break;

      case 'AUTH_SUCCESS':
        if (this.role === 'viewer') {
          await this.initWebRTC(false);
        }
        break;

      case 'AUTH_FAIL':
        if (this.role === 'viewer') {
          this.events.onError?.(
            `Incorrect PIN (Attempt ${msg.attempt} of ${msg.maxAttempts})`
          );
        }
        break;

      case 'BURN_ROOM':
        this.status = 'burned';
        this.setStatus('burned');
        this.events.onError?.(
          'Room burned due to excessive failed attempts. Please request a new PIN.'
        );
        this.cleanupConnections();
        break;

      case 'WEBRTC_OFFER':
        if (this.role === 'viewer' && this.cryptoKey) {
          try {
            if (!this.pc) {
              await this.initWebRTC(false);
            }
            const offer = await decryptPayload<RTCSessionDescriptionInit>(
              this.cryptoKey,
              msg.sdp
            );
            await this.handleOffer(offer);
          } catch (e) {
            console.error('Failed to handle WebRTC offer', e);
          }
        }
        break;

      case 'WEBRTC_ANSWER':
        if (this.role === 'host' && this.cryptoKey && this.pc) {
          try {
            const answer = await decryptPayload<RTCSessionDescriptionInit>(
              this.cryptoKey,
              msg.sdp
            );
            await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
            // Flush any buffered ICE candidates
            await this.flushIceCandidates();
          } catch (e) {
            console.error('Failed to handle WebRTC answer', e);
          }
        }
        break;

      case 'WEBRTC_ICE':
        if (this.cryptoKey) {
          try {
            const candidate = await decryptPayload<RTCIceCandidateInit>(
              this.cryptoKey,
              msg.candidate
            );
            if (candidate) {
              if (this.pc && this.pc.remoteDescription) {
                await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
              } else {
                this.iceCandidateQueue.push(candidate);
              }
            }
          } catch (e) {
            console.error('Failed to decrypt ICE candidate', e);
          }
        }
        break;

      case 'RELAY_MUTATION':
        if (this.cryptoKey) {
          try {
            const mutation = await decryptPayload<SyncMutation>(
              this.cryptoKey,
              msg.envelope
            );
            this.processIncomingMutation(mutation);
          } catch (e) {
            console.error('Failed to decrypt relay mutation', e);
          }
        }
        break;

      case 'PEER_LEAVE':
        this.setStatus('disconnected');
        break;
    }
  }

  private async flushIceCandidates() {
    if (!this.pc || !this.pc.remoteDescription) return;
    while (this.iceCandidateQueue.length > 0) {
      const candidate = this.iceCandidateQueue.shift();
      if (candidate) {
        try {
          await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn('Error adding queued ICE candidate', e);
        }
      }
    }
  }

  private async initWebRTC(isHost: boolean) {
    try {
      this.pc = new RTCPeerConnection(RTC_CONFIG);
      this.iceCandidateQueue = [];

      this.pc.onicecandidate = async (event) => {
        if (event.candidate && this.cryptoKey) {
          const candJson = event.candidate.toJSON ? event.candidate.toJSON() : {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
          };
          const envelope = await encryptPayload(this.cryptoKey, candJson);
          this.sendSignalingMessage({ type: 'WEBRTC_ICE', candidate: envelope });
        }
      };

      this.pc.onconnectionstatechange = () => {
        if (this.pc?.connectionState === 'connected') {
          // Connected via P2P
        } else if (
          this.pc?.connectionState === 'disconnected' ||
          this.pc?.connectionState === 'failed'
        ) {
          if (this.status === 'connected_p2p') {
            this.setStatus('connected_relay');
          }
        }
      };

      if (isHost) {
        // Host creates DataChannel
        this.dataChannel = this.pc.createDataChannel('empanel-sync', { ordered: true });
        this.setupDataChannel(this.dataChannel);

        const offer = await this.pc.createOffer();
        await this.pc.setLocalDescription(offer);

        if (this.cryptoKey) {
          const offerInit = (offer as any).toJSON
            ? (offer as any).toJSON()
            : { type: offer.type, sdp: offer.sdp };
          const envelope = await encryptPayload(this.cryptoKey, offerInit);
          this.sendSignalingMessage({ type: 'WEBRTC_OFFER', sdp: envelope });
        }
      } else {
        // Viewer listens for DataChannel
        this.pc.ondatachannel = (event) => {
          this.dataChannel = event.channel;
          this.setupDataChannel(this.dataChannel);
        };
      }

      // Fallback timeout: If direct P2P dataChannel takes >2.5s, fall back to E2EE Relay
      setTimeout(() => {
        if (this.status === 'hosting' || this.status === 'joining') {
          this.setStatus('connected_relay');
          this.startHeartbeat();
          if (this.role === 'viewer') {
            this.sendMutation({ type: 'REQUEST_SNAPSHOT' });
          }
        }
      }, 2500);
    } catch (err: any) {
      console.warn('WebRTC init failed, using E2EE relay', err);
      this.setStatus('connected_relay');
      this.startHeartbeat();
    }
  }

  private async handleOffer(offer: RTCSessionDescriptionInit) {
    if (!this.pc) return;
    await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
    await this.flushIceCandidates();

    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);

    if (this.cryptoKey) {
      const answerInit = (answer as any).toJSON
        ? (answer as any).toJSON()
        : { type: answer.type, sdp: answer.sdp };
      const envelope = await encryptPayload(this.cryptoKey, answerInit);
      this.sendSignalingMessage({ type: 'WEBRTC_ANSWER', sdp: envelope });
    }
  }

  private setupDataChannel(channel: RTCDataChannel) {
    channel.onopen = () => {
      this.setStatus('connected_p2p');
      this.startHeartbeat();
      if (this.role === 'viewer') {
        // Request initial full state snapshot
        this.sendMutation({ type: 'REQUEST_SNAPSHOT' });
      }
    };

    channel.onclose = () => {
      if (this.status === 'connected_p2p') {
        this.setStatus('connected_relay');
      }
    };

    channel.onmessage = async (event) => {
      if (!this.cryptoKey) return;
      try {
        const envelope: EncryptedEnvelope = JSON.parse(event.data);
        const mutation = await decryptPayload<SyncMutation>(this.cryptoKey, envelope);
        this.processIncomingMutation(mutation);
      } catch (err) {
        console.error('DataChannel decryption failed', err);
      }
    };
  }

  private processIncomingMutation(mutation: SyncMutation) {
    if (mutation.type === 'PING') {
      this.sendMutation({ type: 'PONG', timestamp: mutation.timestamp });
      return;
    }
    if (mutation.type === 'PONG') {
      const latency = Date.now() - mutation.timestamp;
      this.events.onLatencyUpdate?.(Math.max(1, Math.round(latency / 2)));
      return;
    }
    if (mutation.type === 'WHISPER') {
      this.events.onWhisperReceived?.(mutation.message);
    }
    this.events.onMutationReceived?.(mutation);
  }

  private startHeartbeat() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      if (this.status === 'connected_p2p' || this.status === 'connected_relay') {
        this.lastPingSent = Date.now();
        this.sendMutation({ type: 'PING', timestamp: this.lastPingSent });
      }
    }, 4000);
  }

  /**
   * Broadcasts a mutation encrypted with AES-256-GCM.
   */
  public async sendMutation(mutation: SyncMutation) {
    if (!this.cryptoKey) return;
    try {
      const envelope = await encryptPayload(this.cryptoKey, mutation);

      // Prefer WebRTC DataChannel (Direct P2P)
      if (this.dataChannel && this.dataChannel.readyState === 'open') {
        this.dataChannel.send(JSON.stringify(envelope));
      } else {
        // Fall back to E2EE Relay
        this.sendSignalingMessage({ type: 'RELAY_MUTATION', envelope });
      }
    } catch (err) {
      console.error('Failed to send mutation', err);
    }
  }

  /**
   * Sends a quick tactical whisper message between sessions.
   */
  public async sendWhisper(text: string, priority: 'normal' | 'urgent' = 'normal') {
    const whisper: WhisperMessage = {
      id: `w-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      sender: this.role === 'host' ? 'second_chair' : 'podium',
      text: text.trim(),
      timestamp: Date.now(),
      priority,
    };
    await this.sendMutation({ type: 'WHISPER', message: whisper });
    this.events.onWhisperReceived?.(whisper);
    return whisper;
  }

  /**
   * Burns the room after 3 failed attempts or when triggered by Second Chair.
   */
  public burnRoom() {
    this.sendSignalingMessage({ type: 'BURN_ROOM' });
    this.status = 'burned';
    this.setStatus('burned');
    this.events.onAttemptChange?.(this.maxAttempts, this.maxAttempts);
    this.events.onError?.('Room burned. Security lockout active.');
    this.cleanupConnections();
  }

  private cleanupConnections() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.joinRetryInterval) {
      clearInterval(this.joinRetryInterval);
      this.joinRetryInterval = null;
    }
    if (this.dataChannel) {
      try {
        this.dataChannel.close();
      } catch (e) {}
      this.dataChannel = null;
    }
    if (this.pc) {
      try {
        this.pc.close();
      } catch (e) {}
      this.pc = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }
    if (this.bc) {
      try {
        this.bc.close();
      } catch (e) {}
      this.bc = null;
    }
    this.iceCandidateQueue = [];
  }

  public cleanup() {
    this.cleanupConnections();
    this.role = null;
    this.pin = null;
    this.roomId = null;
    this.cryptoKey = null;
    this.currentAuthChallenge = null;
    this.failedAttempts = 0;
    this.status = 'idle';
  }
}

export const syncSession = new SyncSession();
