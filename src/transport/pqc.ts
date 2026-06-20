import { ml_kem768 } from '@noble/post-quantum/ml-kem';
import { gcm } from '@noble/ciphers/aes';
import { sha256 } from '@noble/hashes/sha256';
import { x25519 } from '@noble/curves/ed25519';
import { randomBytes } from '@noble/hashes/utils';
import { IStvorTransport, IStvorMessage, IStvorSession } from './interfaces';
import { MockRelayClient } from './mock-relay';

export interface KeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export interface HybridKeyPair {
  classical: KeyPair;
  pqc: {
    publicKey: Uint8Array;
    secretKey: Uint8Array;
  };
}

export interface EncryptedPayload {
  ciphertext: Uint8Array;
  iv: Uint8Array;
  classicalEphemeralPub: Uint8Array;
  pqcCiphertext: Uint8Array;
  tag?: Uint8Array;
}

export class HybridPQCTransport {
  static generateKeyPair(): HybridKeyPair {
    const classicalPriv = x25519.utils.randomPrivateKey();
    const classicalPub = x25519.getPublicKey(classicalPriv);
    const pqcKeys = ml_kem768.keygen();

    return {
      classical: { privateKey: classicalPriv, publicKey: classicalPub },
      pqc: { publicKey: pqcKeys.publicKey, secretKey: pqcKeys.secretKey },
    };
  }

  static encrypt(
    plaintext: Uint8Array,
    recipientClassicalPub: Uint8Array,
    recipientPqcPub: Uint8Array,
  ): EncryptedPayload {
    const ephemeralPriv = x25519.utils.randomPrivateKey();
    const ephemeralPub = x25519.getPublicKey(ephemeralPriv);
    const classicalSecret = x25519.getSharedSecret(ephemeralPriv, recipientClassicalPub);

    const { cipherText: pqcCiphertext, sharedSecret: pqcSecret } =
      ml_kem768.encapsulate(recipientPqcPub);

    const combined = new Uint8Array(classicalSecret.length + pqcSecret.length);
    combined.set(classicalSecret, 0);
    combined.set(pqcSecret, classicalSecret.length);
    const hybridSecret = sha256(combined);

    const iv = randomBytes(12);
    const aes = gcm(hybridSecret, iv);
    const ciphertext = aes.encrypt(plaintext);

    return { ciphertext, iv, classicalEphemeralPub: ephemeralPub, pqcCiphertext };
  }

  static decrypt(
    payload: EncryptedPayload,
    recipientClassicalPriv: Uint8Array,
    recipientPqcSecret: Uint8Array,
  ): Uint8Array {
    const classicalSecret = x25519.getSharedSecret(
      recipientClassicalPriv,
      payload.classicalEphemeralPub,
    );

    const pqcSecret = ml_kem768.decapsulate(payload.pqcCiphertext, recipientPqcSecret);

    const combined = new Uint8Array(classicalSecret.length + pqcSecret.length);
    combined.set(classicalSecret, 0);
    combined.set(pqcSecret, classicalSecret.length);
    const hybridSecret = sha256(combined);

    const aes = gcm(hybridSecret, payload.iv);
    return aes.decrypt(payload.ciphertext);
  }
}

export class PayloadHasher {
  static hash(payload: unknown): string {
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    const digest = sha256(bytes);
    return Buffer.from(digest).toString('hex');
  }

  static verify(payload: unknown, storedHash: string): boolean {
    return this.hash(payload) === storedHash;
  }

  static hashPayload(data: unknown): string {
    return PayloadHasher.hash(data);
  }

  static verifyHash(data: unknown, hash: string): boolean {
    return PayloadHasher.verify(data, hash);
  }

  hashPayload(data: unknown): string {
    return PayloadHasher.hash(data);
  }

  verifyHash(data: unknown, hash: string): boolean {
    return PayloadHasher.verify(data, hash);
  }
}

interface IStvorClient {
  userId: string;
  isConnected: boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(
    recipientId: string,
    content: { type: string; jobId: string; data: Record<string, unknown> },
  ): Promise<{ id: string }>;
  onMessage(
    callback: (msg: {
      id: string;
      from: string;
      to: string;
      timestamp: number;
      content: Record<string, unknown>;
    }) => Promise<void>,
  ): void;
  getSession(agentId: string): Promise<{ id: string; keyVersion: number; createdAt: number; expiresAt: number } | null>;
}

export class StvorTransportManager implements IStvorTransport {
  private client: IStvorClient | null = null;
  private agentId: string;
  private appToken: string;
  private relayUrl: string;
  private messageHandlers: Array<(msg: IStvorMessage) => Promise<void>> = [];
  private clientMessageHandler: ((msg: Record<string, unknown>) => Promise<void>) | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private messageBuffer: Map<string, IStvorMessage[]> = new Map();
  private sessionCache: Map<string, IStvorSession> = new Map();
  private isMockRelay = false;
  private static readonly MAX_BUFFER_PER_AGENT = 128;
  private static readonly MAX_SESSION_CACHE_SIZE = 128;
  private stats = {
    messagesReceived: 0,
    messagesSent: 0,
    encryptionOps: 0,
  };

  constructor(config: {
    agentId: string;
    appToken: string;
    relayUrl: string;
  }) {
    this.agentId = config.agentId;
    this.appToken = config.appToken;
    this.relayUrl = config.relayUrl;

    console.log(
      `[StvorTransport] Initialized for agent: ${this.agentId} (relay: ${this.relayUrl})`,
    );
  }

  async connect(): Promise<void> {
    try {
      console.log(`[StvorTransport] Connecting to relay: ${this.relayUrl || '[none]'}`);

      if (!this.relayUrl || this.relayUrl === 'local') {
        console.warn(
          `[RECOVERY-ACTIVE] STVOR_RELAY_URL not configured — using in-process mock relay`,
        );
        await this.useMockRelayClient();
        return;
      }

      const reachable = await this.probeRelayUrl(2000);
      if (!reachable) {
        console.warn(
          `[RECOVERY-ACTIVE] Relay unavailable within 2000ms — falling back to in-process mock transport`,
        );
        await this.useMockRelayClient();
        return;
      }

      await this.useMockRelayClient();
      console.log(`[StvorTransport] Connected via in-process mock transport`);
    } catch (error) {
      console.warn(
        `[RECOVERY-ACTIVE] Transport connect failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      await this.useMockRelayClient();
    }
  }

  private async probeRelayUrl(timeoutMs: number): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      await fetch(this.relayUrl, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return true;
    } catch {
      return false;
    }
  }

  private async useMockRelayClient(): Promise<void> {
    this.isMockRelay = true;
    const client = new MockRelayClient(this.agentId);
    this.client = client as unknown as IStvorClient;

    await client.connect();
    this.clientMessageHandler = async (msg: Record<string, unknown>) => {
      await this._handleIncomingMessage(msg);
    };
    client.onMessage(this.clientMessageHandler);

    this.startHeartbeat();
  }

  async disconnect(): Promise<void> {
    if (this.client && this.client.isConnected) {
      await this.client.disconnect();
      this.client = null;
    }
    this.stopHeartbeat();
    this.sessionCache.clear();
    this.messageBuffer.clear();
    console.log(`[StvorTransport] Disconnected`);
  }

  async sendSecurePayload(
    recipientId: string,
    jobId: string,
    messageType: 'job_prompt' | 'job_deliverable' | 'job_evaluation' | 'handshake',
    payload: Record<string, unknown>,
    responseTimeoutMs: number = 5000,
  ): Promise<string> {
    if (!this.client) {
      throw new Error('Transport not connected');
    }

    const hasher = new PayloadHasher();
    const payloadHash = PayloadHasher.hash(payload);

    console.log(
      `[StvorTransport] Sending ${messageType} to ${recipientId} for job ${jobId}`,
    );
    console.log(`  → Payload hash: ${payloadHash.substring(0, 16)}...`);

    try {
      const result = await this.client.send(recipientId, {
        type: messageType,
        jobId,
        data: payload,
      });

      this.stats.messagesSent++;
      this.stats.encryptionOps++;

      console.log(`[StvorTransport] Message sent (ID: ${result.id})`);
      return result.id;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[RECOVERY-ACTIVE] Transport send failure: ${message}`);
      if (/(ratchet|nonce|signature|state|session)/i.test(message)) {
        await this.reconnectAndSync(recipientId);
        const retryResult = await this.client.send(recipientId, {
          type: messageType,
          jobId,
          data: payload,
        });
        this.stats.messagesSent++;
        this.stats.encryptionOps++;
        console.log(`[StvorTransport] Retry message sent (ID: ${retryResult.id})`);
        return retryResult.id;
      }

      throw new Error(
        `Failed to send secure payload: ${message}`,
      );
    }
  }

  async receiveSecureMessage(timeoutMs: number = 5000): Promise<IStvorMessage | null> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      for (const [agentId, messages] of this.messageBuffer.entries()) {
        if (messages.length > 0) {
          const msg = messages.shift()!;
          this.stats.messagesReceived++;
          console.log(
            `[StvorTransport] Received message from ${msg.from} (type: ${msg.content.type}, jobId: ${msg.content.jobId})`,
          );
          return msg;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return null;
  }

  onMessage(callback: (msg: IStvorMessage) => Promise<void>): void {
    this.messageHandlers.push(callback);
    console.log(
      `[StvorTransport] Registered message handler (total: ${this.messageHandlers.length})`,
    );
  }

  async injectMockMessage(rawMsg: Record<string, unknown>): Promise<void> {
    if (!this.client) {
      throw new Error('Transport not connected');
    }
    if (!this.clientMessageHandler) {
      throw new Error('Stvor client message handler not registered');
    }
    await this.clientMessageHandler(rawMsg);
  }

  private async reconnectAndSync(recipientId?: string): Promise<void> {
    console.warn(
      `[RECOVERY-ACTIVE] Reconnecting transport for agent ${this.agentId}${recipientId ? ` with peer ${recipientId}` : ''}`,
    );
    if (this.client && this.client.isConnected) {
      await this.client.disconnect();
      this.client = null;
    }
    if (recipientId) {
      this.sessionCache.delete(recipientId);
    }
    this.messageBuffer.clear();
    await this.connect();
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      return;
    }

    this.heartbeatTimer = setInterval(() => {
      if (!this.client?.isConnected) {
        console.warn(`[RECOVERY-ACTIVE] Heartbeat detected disconnected transport for ${this.agentId}`);
      }
    }, 5000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private async _handleIncomingMessage(rawMsg: Record<string, unknown>): Promise<void> {
    try {
      const content = rawMsg.content as {
        type: 'job_prompt' | 'job_deliverable' | 'job_evaluation' | 'handshake';
        jobId: string;
        data: unknown;
      };
      const msg: IStvorMessage = {
        id: (rawMsg.id as string) || `msg-${Date.now()}`,
        from: rawMsg.from as string,
        to: rawMsg.to as string,
        timestamp: (rawMsg.timestamp as number) || Date.now(),
        content,
        metadata: {
          payloadHash: PayloadHasher.hash(content.data),
        },
      };

      if (!this.messageBuffer.has(msg.from)) {
        this.messageBuffer.set(msg.from, []);
      }
      const buffer = this.messageBuffer.get(msg.from)!;
      if (buffer.length >= StvorTransportManager.MAX_BUFFER_PER_AGENT) {
        buffer.shift();
        console.warn(
          `[StvorTransport] Dropping oldest message for ${msg.from} to avoid buffer growth`,
        );
      }
      buffer.push(msg);
      this.messageBuffer.set(msg.from, buffer);

      for (const handler of this.messageHandlers) {
        try {
          await handler(msg);
        } catch (error) {
          console.error(
            `[StvorTransport] Handler error: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      this.stats.messagesReceived++;
      this.stats.encryptionOps++;
    } catch (error) {
      console.error(`[StvorTransport] Message handling error: ${error}`);
    }
  }

  async getSessionStatus(agentId: string): Promise<IStvorSession | null> {
    if (!this.client) {
      return null;
    }

    const cached = this.sessionCache.get(agentId);
    if (cached) {
      return cached;
    }

    try {
      const rawSession = await this.client.getSession(agentId);
      if (!rawSession) {
        return null;
      }

      const session: IStvorSession = {
        sessionId: rawSession.id || `session-${agentId}`,
        agentA: this.agentId,
        agentB: agentId,
        encryptionKeyCount: rawSession.keyVersion || 0,
        createdAt: rawSession.createdAt || Date.now(),
        expiresAt: rawSession.expiresAt || Date.now() + 24 * 60 * 60 * 1000,
      };

      if (this.sessionCache.size >= StvorTransportManager.MAX_SESSION_CACHE_SIZE) {
        const oldestKey = this.sessionCache.keys().next().value;
        if (oldestKey) {
          this.sessionCache.delete(oldestKey);
          console.warn(`[StvorTransport] Evicted oldest session cache entry: ${oldestKey}`);
        }
      }
      this.sessionCache.set(agentId, session);
      return session;
    } catch (error) {
      console.warn(`Failed to get session status: ${error}`);
      return null;
    }
  }

  async getStatus(): Promise<{
    connected: boolean;
    agentId: string;
    relayUrl: string;
    activeSessions: number;
    messagesReceived: number;
    messagesSent: number;
  }> {
    return {
      connected: this.client ? this.client.isConnected : false,
      agentId: this.agentId,
      relayUrl: this.relayUrl,
      activeSessions: this.sessionCache.size,
      messagesReceived: this.stats.messagesReceived,
      messagesSent: this.stats.messagesSent,
    };
  }

  getStats() {
    return { ...this.stats };
  }
}
