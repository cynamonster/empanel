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
  type EmpanelKey,
} from './crypto';
import type { SyncStatus, WhisperMessage, SyncRole, ConnectedPeer } from '../types';

export type { SyncRole };

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
  | { type: 'DELETE_JUROR'; jurorId: string }
  | { type: 'UPDATE_CASE'; updates: any }
  | { type: 'TOGGLE_RESPONSE'; jurorId: string; questionId: string }
  | { type: 'ASSIGN_SEAT'; jurorId: string; seatNumber: number; isAlternate?: boolean }
  | { type: 'UNSEAT_JUROR'; jurorId: string }
  | { type: 'RECORD_STRIKE'; strike: any }
  | { type: 'RECORD_CAUSE'; challenge: any }
  | { type: 'REVERT_STRIKE'; jurorId: string }
  | { type: 'WHISPER'; message: WhisperMessage }
  | { type: 'DISMISS_WHISPER'; messageId: string }
  | { type: 'PEER_ROLE_UPDATE'; peerId: string; role: SyncRole }
  | { type: 'PEER_LIST'; peers: ConnectedPeer[] }
  | { type: 'HOST_LEAVE' }
  | { type: 'PING'; timestamp: number }
  | { type: 'PONG'; timestamp: number };

type SignalingMessage =
  | { type: 'PEER_JOIN'; peerId: string; role: SyncRole; proof?: string }
  | { type: 'AUTH_CHALLENGE'; challenge: string }
  | { type: 'AUTH_PROOF'; proof: string; peerId?: string }
  | { type: 'AUTH_SUCCESS'; peerId?: string; hostId?: string }
  | { type: 'AUTH_FAIL'; peerId?: string; message?: string }
  | { type: 'BURN_ROOM' }
  | { type: 'WEBRTC_OFFER'; sdp: EncryptedEnvelope }
  | { type: 'WEBRTC_ANSWER'; sdp: EncryptedEnvelope }
  | { type: 'WEBRTC_ICE'; candidate: EncryptedEnvelope }
  | { type: 'RELAY_MUTATION'; envelope: EncryptedEnvelope }
  | { type: 'PEER_LEAVE'; peerId?: string }
  | { type: 'HOST_DISCONNECT' };

export interface SyncSessionEvents {
  onStatusChange?: (status: SyncStatus) => void;
  onAttemptChange?: (attempts: number, max: number) => void;
  onPeerJoined?: () => void;
  onPeersChange?: (peers: ConnectedPeer[]) => void;
  onMutationReceived?: (mutation: SyncMutation) => void;
  onWhisperReceived?: (whisper: WhisperMessage) => void;
  onError?: (error: string) => void;
  onLatencyUpdate?: (latencyMs: number) => void;
  onHostDisconnected?: () => void;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
};

export class SyncSession {
  private peerId: string = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : 'p-' + Math.random().toString(36).substring(2, 9);
  private role: SyncRole | null = null;
  private pin: string | null = null;
  private roomId: string | null = null;
  private cryptoKey: EmpanelKey | null = null;
  private authProof: string | null = null;
  private status: SyncStatus = 'idle';
  private peers: Map<string, ConnectedPeer> = new Map();

  private bc: BroadcastChannel | null = null;
  private ws: WebSocket | null = null;
  private pc: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private iceCandidateQueue: RTCIceCandidateInit[] = [];

  private currentAuthChallenge: string | null = null;
  private events: SyncSessionEvents = {};
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private joinRetryInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts: number = 0;
  private isExplicitDisconnect: boolean = false;
  private hostPeerId: string | null = null;
  private lastPingSent: number = 0;

  constructor(events: SyncSessionEvents = {}) {
    this.events = events;
  }

  public setEvents(events: SyncSessionEvents) {
    this.events = { ...this.events, ...events };
  }

  public getPeerId(): string {
    return this.peerId;
  }

  public getPeers(): ConnectedPeer[] {
    return Array.from(this.peers.values());
  }

  public getStatus(): SyncStatus {
    return this.status;
  }

  public getRole(): SyncRole | null {
    return this.role;
  }

  public async setRole(newRole: SyncRole) {
    this.role = newRole;
    if (this.status === 'connected_p2p' || this.status === 'connected_relay') {
      if (this.role === 'host') {
        this.peers.set(this.peerId, { id: this.peerId, role: 'host', joinedAt: Date.now() });
        this.broadcastPeerList();
      } else {
        await this.sendMutation({
          type: 'PEER_ROLE_UPDATE',
          peerId: this.peerId,
          role: newRole,
        });
      }
    }
  }

  public getPin(): string | null {
    return this.pin;
  }

  public getFailedAttempts(): { current: number; max: number } {
    return { current: 0, max: 0 };
  }

  private setStatus(newStatus: SyncStatus) {
    this.status = newStatus;
    this.events.onStatusChange?.(newStatus);
  }

  private broadcastPeerList() {
    if (this.role === 'host') {
      const list = this.getPeers();
      this.events.onPeersChange?.(list);
      this.sendMutation({ type: 'PEER_LIST', peers: list });
    }
  }

  /**
   * Host starts a pairing session with the given 6-character PIN.
   */
  public async startHosting(pin: string) {
    this.cleanup();
    this.isExplicitDisconnect = false;
    this.reconnectAttempts = 0;
    this.role = 'host';
    this.pin = pin;
    this.hostPeerId = this.peerId;
    this.peers.clear();
    this.peers.set(this.peerId, { id: this.peerId, role: 'host', joinedAt: Date.now() });
    this.setStatus('hosting');
    this.events.onPeersChange?.(this.getPeers());

    try {
      this.roomId = await deriveRoomId(pin);
      this.cryptoKey = await deriveKeyFromPin(pin);
      this.initSignaling();
    } catch (err: any) {
      this.setStatus('error');
      this.events.onError?.(err?.message || 'Failed to initialize host security');
    }
  }

  /**
   * Peer joins a session with the given 6-character PIN and initial role.
   */
  public async joinSession(pin: string, initialRole: SyncRole = 'viewer') {
    this.cleanup();
    this.isExplicitDisconnect = false;
    this.reconnectAttempts = 0;
    this.hostPeerId = null;
    this.role = initialRole;
    this.pin = pin;
    this.peers.clear();
    this.setStatus('joining');

    try {
      this.roomId = await deriveRoomId(pin);
      this.cryptoKey = await deriveKeyFromPin(pin);
      this.authProof = await computeAuthProof(this.cryptoKey, 'empanel-join');
      this.initSignaling();

      // Announce presence immediately and retry periodically until handshake completes
      const sendJoin = () => {
        if (this.status === 'joining' && this.authProof) {
          this.sendSignalingMessage({
            type: 'PEER_JOIN',
            peerId: this.peerId,
            role: this.role || 'viewer',
            proof: this.authProof,
          });
        }
      };

      sendJoin();
      let attempts = 0;
      this.joinRetryInterval = setInterval(() => {
        if (this.status !== 'joining' || attempts++ >= 30) {
          if (this.joinRetryInterval) clearInterval(this.joinRetryInterval);
          return;
        }
        sendJoin();
      }, 1000);
    } catch (err: any) {
      this.setStatus('error');
      this.events.onError?.(err?.message || 'Failed to initialize session encryption');
    }
  }

  private scheduleReconnect() {
    if (this.isExplicitDisconnect || !this.roomId) return;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 10000);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      if (this.isExplicitDisconnect || !this.roomId) return;
      this.initSignaling();
    }, delay);
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

    // 3. Connect to WebSocket signaling relay (Dedicated endpoint for LAN & Internet)
    const relayUrl = (window as any).__EMPANEL_RELAY_URL__ || this.getRelayUrl();
    if (relayUrl) {
      try {
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
          return;
        }
        if (this.ws) {
          try { this.ws.close(); } catch (e) {}
        }
        this.ws = new WebSocket(`${relayUrl}?room=${this.roomId}&role=${this.role}&peer=${this.peerId}`);
        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          if (this.role === 'host') {
            if (this.status === 'reconnecting') {
              this.setStatus(this.peers.size > 1 ? 'connected_relay' : 'hosting');
              this.broadcastPeerList();
            }
          } else {
            if ((this.status === 'joining' || this.status === 'reconnecting') && this.authProof) {
              this.sendSignalingMessage({
                type: 'PEER_JOIN',
                peerId: this.peerId,
                role: this.role || 'viewer',
                proof: this.authProof,
              });
            }
          }
        };
        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleSignalingMessage(data);
          } catch (err) {
            console.error('Failed to parse WS message', err);
          }
        };
        this.ws.onclose = () => {
          if (!this.isExplicitDisconnect && this.roomId && this.status !== 'idle' && this.status !== 'burned' && this.status !== 'error') {
            if (this.status !== 'reconnecting') {
              this.setStatus('reconnecting');
            }
            this.scheduleReconnect();
          } else if (this.status === 'connected_relay' || this.status === 'connected_p2p') {
            this.setStatus('disconnected');
          }
        };
        this.ws.onerror = (e) => {
          console.warn('WebSocket relay connection error', e);
        };
      } catch (e) {
        console.warn('Could not establish WebSocket relay connection', e);
        if (!this.isExplicitDisconnect && this.roomId) {
          this.scheduleReconnect();
        }
      }
    }
  }

  private getRelayUrl(): string | null {
    const customRelay = (window as any).__EMPANEL_RELAY_URL__;
    if (customRelay) return customRelay;
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/api/relay`;
  }

  private sendSignalingMessage(msg: SignalingMessage) {
    let sentViaWs = false;
    // 1. WebSocket relay (primary backbone across Wi-Fi & Internet)
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(msg));
        sentViaWs = true;
      } catch (err) {}
    }

    // 2. BroadcastChannel for same-browser cross-tab testing
    if (this.bc) {
      try {
        this.bc.postMessage(msg);
      } catch (err) {}
    }

    // 3. Vite HMR bus companion (only when dedicated WS relay is not connected)
    if (!sentViaWs) {
      const hot = (import.meta as any).hot;
      if (hot) {
        try {
          hot.send('empanel:signal', { roomId: this.roomId, msg });
        } catch (e) {}
      }
    }
  }

  private async handleSignalingMessage(msg: SignalingMessage) {
    switch (msg.type) {
      case 'PEER_JOIN':
        if (this.role === 'host' && this.cryptoKey) {
          if (msg.proof) {
            // Direct 1-step auth verification
            const isValid = await verifyAuthProof(this.cryptoKey, 'empanel-join', msg.proof);
            if (isValid) {
              const joiningPeerId = msg.peerId || `peer-${Date.now()}`;
              this.peers.set(joiningPeerId, {
                id: joiningPeerId,
                role: msg.role || 'second_chair',
                joinedAt: Date.now(),
              });
              this.setStatus('connected_relay');
              this.startHeartbeat();
              this.sendSignalingMessage({ type: 'AUTH_SUCCESS', peerId: joiningPeerId, hostId: this.peerId });
              this.broadcastPeerList();
              this.events.onPeerJoined?.();
              await this.initWebRTC(true);
            } else {
              // Wrong PIN on peer - inform peer without burning room
              this.sendSignalingMessage({ type: 'AUTH_FAIL', peerId: msg.peerId, message: 'Incorrect PIN' });
            }
          } else {
            // Legacy 2-step challenge fallback
            this.currentAuthChallenge = createAuthChallenge();
            this.sendSignalingMessage({
              type: 'AUTH_CHALLENGE',
              challenge: this.currentAuthChallenge,
            });
          }
        }
        break;

      case 'AUTH_CHALLENGE':
        if (this.role !== 'host' && this.cryptoKey) {
          const proof = await computeAuthProof(this.cryptoKey, msg.challenge);
          this.sendSignalingMessage({ type: 'AUTH_PROOF', proof, peerId: this.peerId });
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
            const joiningPeerId = msg.peerId || `peer-${Date.now()}`;
            this.peers.set(joiningPeerId, {
              id: joiningPeerId,
              role: 'second_chair',
              joinedAt: Date.now(),
            });
            this.sendSignalingMessage({ type: 'AUTH_SUCCESS', peerId: joiningPeerId, hostId: this.peerId });
            this.broadcastPeerList();
            this.events.onPeerJoined?.();
            await this.initWebRTC(true);
          } else {
            this.sendSignalingMessage({ type: 'AUTH_FAIL', peerId: msg.peerId, message: 'Incorrect PIN' });
          }
        }
        break;

      case 'AUTH_SUCCESS':
        if (this.role !== 'host') {
          if (!msg.peerId || msg.peerId === this.peerId) {
            if (msg.hostId) {
              this.hostPeerId = msg.hostId;
            }
            if (this.joinRetryInterval) {
              clearInterval(this.joinRetryInterval);
              this.joinRetryInterval = null;
            }
            this.reconnectAttempts = 0;
            // Immediately enter connected_relay state to receive snapshot
            this.setStatus('connected_relay');
            this.startHeartbeat();
            this.sendMutation({ type: 'REQUEST_SNAPSHOT' });
            if (this.role && this.role !== 'viewer') {
              this.sendMutation({ type: 'PEER_ROLE_UPDATE', peerId: this.peerId, role: this.role });
            }
            await this.initWebRTC(false);
          }
        }
        break;

      case 'AUTH_FAIL':
        if (this.role !== 'host') {
          if (!msg.peerId || msg.peerId === this.peerId) {
            if (this.joinRetryInterval) {
              clearInterval(this.joinRetryInterval);
              this.joinRetryInterval = null;
            }
            this.setStatus('error');
            this.events.onError?.('Incorrect PIN. Please re-enter the 6-letter PIN from the host screen.');
          }
        }
        break;

      case 'BURN_ROOM':
        // Ditch room burn: gracefully disconnect if received
        this.cleanupConnections();
        this.setStatus('disconnected');
        break;

      case 'WEBRTC_OFFER':
        if (this.role !== 'host' && this.cryptoKey) {
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
        if (msg.peerId) {
          // If the peer that departed was the host, end the shared session gracefully
          if (this.role !== 'host' && this.hostPeerId && msg.peerId === this.hostPeerId) {
            this.cleanupConnections();
            this.setStatus('disconnected');
            this.events.onHostDisconnected?.();
            return;
          }
          this.peers.delete(msg.peerId);
          if (this.role === 'host') {
            this.broadcastPeerList();
            if (this.peers.size <= 1) {
              this.setStatus('hosting');
            }
          } else {
            this.events.onPeersChange?.(Array.from(this.peers.values()));
          }
        }
        // NOTE: Untagged PEER_LEAVE or non-host departure does NOT disconnect the non-host
        break;

      case 'HOST_DISCONNECT':
        if (this.role !== 'host') {
          this.cleanupConnections();
          this.setStatus('disconnected');
          this.events.onHostDisconnected?.();
        }
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

      // Fallback timeout: If direct P2P dataChannel takes >3.5s, fall back to E2EE Relay
      setTimeout(() => {
        if (this.status === 'hosting' || this.status === 'joining') {
          this.setStatus('connected_relay');
          this.startHeartbeat();
          if (this.role === 'viewer') {
            this.sendMutation({ type: 'REQUEST_SNAPSHOT' });
            // Snapshot retry safeguard after 1.5s
            setTimeout(() => {
              if (this.role === 'viewer' && (this.status === 'connected_relay' || this.status === 'connected_p2p')) {
                this.sendMutation({ type: 'REQUEST_SNAPSHOT' });
              }
            }, 1500);
          }
        }
      }, 3500);
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
      if (this.role !== 'host') {
        // Request initial full state snapshot
        this.sendMutation({ type: 'REQUEST_SNAPSHOT' });
        // Snapshot retry safeguard after 1.5s
        setTimeout(() => {
          if (this.role !== 'host' && (this.status === 'connected_p2p' || this.status === 'connected_relay')) {
            this.sendMutation({ type: 'REQUEST_SNAPSHOT' });
          }
        }, 1500);
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
    if (mutation.type === 'PEER_ROLE_UPDATE') {
      if (this.role === 'host') {
        const role = mutation.role || 'second_chair';
        const existing = this.peers.get(mutation.peerId);
        if (existing) {
          existing.role = role;
        } else {
          this.peers.set(mutation.peerId, {
            id: mutation.peerId,
            role,
            joinedAt: Date.now(),
          });
        }
        this.broadcastPeerList();
      }
      return;
    }
    if (mutation.type === 'PEER_LIST') {
      this.peers.clear();
      for (const p of mutation.peers) {
        this.peers.set(p.id, p);
      }
      this.events.onPeersChange?.(mutation.peers);
      return;
    }
    if (mutation.type === 'HOST_LEAVE') {
      if (this.role !== 'host') {
        this.setStatus('disconnected');
        this.events.onHostDisconnected?.();
      }
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
   * Broadcasts a mutation encrypted with AES-256-GCM across all peers in the room.
   */
  public async sendMutation(mutation: SyncMutation) {
    if (!this.cryptoKey) return;
    try {
      const envelope = await encryptPayload(this.cryptoKey, mutation);

      // Multi-peer broadcast via WebSocket relay
      this.sendSignalingMessage({ type: 'RELAY_MUTATION', envelope });

      // Direct WebRTC DataChannel (if available)
      if (this.dataChannel && this.dataChannel.readyState === 'open') {
        try {
          this.dataChannel.send(JSON.stringify(envelope));
        } catch (e) {}
      }
    } catch (err) {
      console.error('Failed to send mutation', err);
    }
  }

  /**
   * Sends a quick tactical whisper message between sessions.
   */
  public async sendWhisper(text: string, priority: 'normal' | 'urgent' = 'normal') {
    const sender = this.role === 'host' ? 'host' : this.role === 'second_chair' ? 'second_chair' : 'podium';
    const whisper: WhisperMessage = {
      id: `w-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      sender,
      text: text.trim(),
      timestamp: Date.now(),
      priority,
    };
    await this.sendMutation({ type: 'WHISPER', message: whisper });
    this.events.onWhisperReceived?.(whisper);
    return whisper;
  }

  /**
   * Disconnects and announces departure to peers.
   */
  public disconnect() {
    this.isExplicitDisconnect = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    try {
      if (this.role === 'host') {
        this.sendSignalingMessage({ type: 'HOST_DISCONNECT' });
        this.sendMutation({ type: 'HOST_LEAVE' });
      } else {
        this.sendSignalingMessage({ type: 'PEER_LEAVE', peerId: this.peerId });
      }
    } catch (e) {}
    this.cleanup();
  }

  /**
   * Resets and disconnects the session (replaces legacy room burn).
   */
  public burnRoom() {
    this.isExplicitDisconnect = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.disconnect();
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
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
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
    this.isExplicitDisconnect = true;
    this.cleanupConnections();
    this.role = null;
    this.pin = null;
    this.roomId = null;
    this.cryptoKey = null;
    this.authProof = null;
    this.currentAuthChallenge = null;
    this.hostPeerId = null;
    this.status = 'idle';
  }
}

export const syncSession = new SyncSession();
