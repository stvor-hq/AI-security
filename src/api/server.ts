/**
 * @file HTTP API Server (API Mode) with Transport Integration
 * 
 * RESTful interface for the agent node.
 * Provides endpoints for job management, secure transport, and monitoring.
 * 
 * Built with Bun's native HTTP server (zero-overhead).
 * All endpoints return JSON with proper error handling.
 * 
 * Data flow:
 *   - Job management: Standard CRUD endpoints
 *   - Transport: PQC-encrypted payload delivery via Stvor relay
 *   - Status: Real-time connection and session monitoring
 */

import { INodeSettings } from '../core/types';
import { AgentRuntime } from '../core/runtime';
import { ICommercePlugin } from '../plugins/agent-commerce';
import { StvorTransportManager } from '../transport/pqc';

/**
 * HTTP Server: RESTful API for agent operations.
 * 
 * Commerce Endpoints:
 *   POST   /api/jobs/create        - Create a new job
 *   POST   /api/jobs/:id/fund      - Fund a job
 *   POST   /api/jobs/:id/submit    - Submit deliverable
 *   POST   /api/jobs/:id/evaluate  - Evaluate deliverable
 *   GET    /api/jobs/:id           - Get job state
 *   GET    /api/jobs               - List jobs for agent
 * 
 * Transport Endpoints (PQC-E2EE):
 *   POST   /api/transport/send     - Send secure payload
 *   GET    /api/transport/status   - Transport connection status
 *   GET    /api/transport/session/:agentId - Get crypto session status
 * 
 * Monitoring:
 *   GET    /api/agent/status       - Node status
 *   GET    /health                 - Health check
 */
export class ApiServer {
  private runtime: AgentRuntime;
  private settings: INodeSettings;
  private transport: StvorTransportManager | null = null;
  private readonly apiKey: string;
  private server: ReturnType<typeof Bun.serve> | null = null;

  constructor(runtime: AgentRuntime, transport?: StvorTransportManager) {
    this.runtime = runtime;
    this.settings = runtime.settings;
    this.transport = transport || null;
    this.apiKey = this.settings.apiKey || process.env.STVOR_API_KEY || 'stvor-demo-key';
  }

  /**
   * Start the HTTP server.
   */
  start(): void {
    const port = this.settings.port;
    this.server = Bun.serve({
      port,
      fetch: (req) => this._handleRequest(req),
    });

    console.log(
      `[API Server] Listening on http://localhost:${port} (${this.settings.logLevel})`,
    );
  }

  stop(): void {
    if (!this.server) {
      return;
    }
    this.server.stop();
    this.server = null;
    console.log('[API Server] Stopped');
  }

  /**
   * Main request router.
   */
  private async _handleRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    try {
      // Health check
      if (path === '/health') {
        return this._response(200, { status: 'ok', agentId: this.settings.agentId });
      }

      // API routes
      if (path.startsWith('/api/')) {
        return await this._handleApiRoute(method, path, req, url);
      }

      return this._response(404, { error: 'Not found' });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[API Server] Error: ${message}`);
      return this._response(500, { error: message });
    }
  }

  /**
   * Route API requests.
   */
  private async _handleApiRoute(
    method: string,
    path: string,
    req: Request,
    url: URL,
  ): Promise<Response> {
    const commerce = this.runtime.getPlugin<ICommercePlugin>(
      'agent-commerce',
    );

    // ===== Commerce Endpoints =====

    // POST /api/jobs/create
    if (method === 'POST' && path === '/api/jobs/create') {
      if (!commerce) {
        return this._response(503, { error: 'Commerce plugin not loaded' });
      }
      const body = await req.json();
      const {
        clientAgent,
        providerAgent,
        taskDescription,
        requiredAmount,
      } = body;

      const job = await commerce.createJob(
        clientAgent,
        providerAgent,
        taskDescription,
        BigInt(requiredAmount),
      );

      return this._response(201, { success: true, job });
    }

    // POST /api/jobs/:id/fund
    if (method === 'POST' && path.match(/^\/api\/jobs\/[^/]+\/fund$/)) {
      if (!commerce) {
        return this._response(503, { error: 'Commerce plugin not loaded' });
      }
      const jobId = path.split('/')[3];
      const body = await req.json();
      const { clientAgent, fundAmount } = body;

      const job = await commerce.fundJob(
        jobId,
        clientAgent,
        BigInt(fundAmount),
      );

      return this._response(200, { success: true, job });
    }

    // POST /api/jobs/:id/submit
    if (method === 'POST' && path.match(/^\/api\/jobs\/[^/]+\/submit$/)) {
      if (!commerce) {
        return this._response(503, { error: 'Commerce plugin not loaded' });
      }
      const jobId = path.split('/')[3];
      const body = await req.json();
      const { providerAgent, deliverableHash } = body;

      const job = await commerce.submitJob(
        jobId,
        providerAgent,
        deliverableHash,
      );

      return this._response(200, { success: true, job });
    }

    // POST /api/jobs/:id/evaluate
    if (method === 'POST' && path.match(/^\/api\/jobs\/[^/]+\/evaluate$/)) {
      if (!commerce) {
        return this._response(503, { error: 'Commerce plugin not loaded' });
      }
      const jobId = path.split('/')[3];
      const body = await req.json();
      const { decision, reason } = body;

      const job = await commerce.evaluateJob(jobId, decision, reason);

      return this._response(200, { success: true, job });
    }

    // GET /api/jobs/:id
    if (method === 'GET' && path.match(/^\/api\/jobs\/[^/]+$/)) {
      if (!commerce) {
        return this._response(503, { error: 'Commerce plugin not loaded' });
      }
      const jobId = path.split('/')[3];
      const state = await commerce.getJobState(jobId);

      if (!state) {
        return this._response(404, { error: `Job ${jobId} not found` });
      }

      return this._response(200, { success: true, state });
    }

    // GET /api/jobs (list jobs for agent)
    if (method === 'GET' && path === '/api/jobs') {
      if (!commerce) {
        return this._response(503, { error: 'Commerce plugin not loaded' });
      }
      const agentId = url.searchParams.get('agentId');
      if (!agentId) {
        return this._response(400, {
          error: 'agentId query parameter required',
        });
      }

      const jobs = await commerce.listJobs(agentId);
      return this._response(200, { success: true, jobs, count: jobs.length });
    }

    // ===== Transport Endpoints =====

    // POST /api/transport/send
    if (method === 'POST' && path === '/api/transport/send') {
      if (!this.transport) {
        return this._response(503, { error: 'Transport layer not initialized' });
      }
      this.requireTransportAuth(req);
      const body = this.parseJsonBody(await req.json());
      const recipientId = this.validateStringField(body.recipientId, 'recipientId');
      const jobId = this.validateStringField(body.jobId, 'jobId');
      const messageType = this.validateStringField(body.messageType, 'messageType');
      const payload = body.payload;
      if (!['job_prompt', 'job_deliverable', 'job_evaluation', 'handshake'].includes(messageType)) {
        return this._response(400, { error: 'Invalid messageType' });
      }

      const msgId = await this.transport.sendSecurePayload(
        recipientId,
        jobId,
        messageType as any,
        payload,
      );

      return this._response(200, { success: true, messageId: msgId });
    }

    // GET /api/transport/status
    if (method === 'GET' && path === '/api/transport/status') {
      if (!this.transport) {
        return this._response(503, { error: 'Transport layer not initialized' });
      }
      this.requireTransportAuth(req);
      const status = await this.transport.getStatus();
      return this._response(200, { success: true, ...status });
    }

    // GET /api/transport/session/:agentId
    if (
      method === 'GET' &&
      path.match(/^\/api\/transport\/session\/[^/]+$/)
    ) {
      this.requireTransportAuth(req);
      if (!this.transport) {
        return this._response(503, { error: 'Transport layer not initialized' });
      }
      const agentId = this.validateStringField(path.split('/')[4], 'agentId');
      const session = await this.transport.getSessionStatus(agentId);

      if (!session) {
        return this._response(404, {
          error: `No active session with ${agentId}`,
        });
      }

      return this._response(200, { success: true, session });
    }

    // ===== Monitoring Endpoints =====

    // GET /api/agent/status
    if (method === 'GET' && path === '/api/agent/status') {
      const transportStatus = this.transport
        ? await this.transport.getStatus()
        : null;

      return this._response(200, {
        agentId: this.settings.agentId,
        state: this.runtime.state,
        pqcEnabled: this.settings.pqcEnabled,
        uptime: process.uptime(),
        transport: transportStatus
          ? {
              connected: transportStatus.connected,
              activeSessions: transportStatus.activeSessions,
              messagesReceived: transportStatus.messagesReceived,
              messagesSent: transportStatus.messagesSent,
            }
          : null,
      });
    }

    return this._response(404, { error: `Route not found: ${method} ${path}` });
  }

  /**
   * Helper: Format JSON response.
   */
  private parseJsonBody(body: any): any {
    if (!body || typeof body !== 'object') {
      throw new Error('Request body must be a JSON object');
    }
    return body;
  }

  private validateStringField(value: any, fieldName: string): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`${fieldName} is required and must be a non-empty string`);
    }
    if (value.includes('/')) {
      throw new Error(`${fieldName} contains invalid characters`);
    }
    return value.trim();
  }

  private requireTransportAuth(req: Request): void {
    const authHeader = req.headers.get('authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      throw new Error('Authorization header required');
    }
    const token = authHeader.slice(7).trim();
    if (token !== this.apiKey) {
      throw new Error('Invalid API key');
    }
  }

  private _response(status: number, body: any): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
