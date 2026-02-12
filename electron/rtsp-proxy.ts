import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';

interface ProxySession {
  ws: WebSocket;
  ffmpeg: ReturnType<typeof spawn> | null;
  url: string;
  timeout: ReturnType<typeof setTimeout>;
}

const sessions = new Map<string, ProxySession>();
const MAX_SESSIONS = 12;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes max per session

/**
 * Validate that a URL is a legitimate RTSP/RTSPS address and not
 * pointing at private/link-local networks or using dangerous schemes.
 */
function validateRtspUrl(raw: string): string {
  // Must start with rtsp:// or rtsps://
  if (!/^rtsps?:\/\//i.test(raw)) {
    throw new Error('URL must use rtsp:// or rtsps:// scheme');
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('Invalid URL format');
  }

  // Block private / link-local / loopback IPs to prevent SSRF
  const hostname = parsed.hostname;
  const privatePatterns = [
    /^127\./,                     // loopback
    /^10\./,                      // RFC 1918
    /^172\.(1[6-9]|2\d|3[01])\./, // RFC 1918
    /^192\.168\./,                // RFC 1918
    /^169\.254\./,                // link-local
    /^0\./,                       // current network
    /^::1$/,                      // IPv6 loopback
    /^fd[0-9a-f]{2}:/i,          // IPv6 ULA
    /^fe80:/i,                    // IPv6 link-local
    /^localhost$/i,
  ];

  for (const pattern of privatePatterns) {
    if (pattern.test(hostname)) {
      throw new Error('RTSP URL must not point to private/loopback addresses');
    }
  }

  return raw;
}

/**
 * Redact credentials from a URL string for safe logging.
 */
function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.username || parsed.password) {
      parsed.username = '***';
      parsed.password = '***';
    }
    return parsed.toString();
  } catch {
    return '[invalid-url]';
  }
}

export function startRtspProxy(port: number = 9999) {
  const server = createServer();
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws, req) => {
    // Rate limit: reject if too many active sessions
    if (sessions.size >= MAX_SESSIONS) {
      ws.close(1013, 'Too many active sessions');
      return;
    }

    const urlParam = new URL(req.url || '', `http://localhost:${port}`).searchParams.get('url');
    if (!urlParam) {
      ws.close(1008, 'Missing RTSP URL');
      return;
    }

    // Validate the RTSP URL (scheme, no private IPs)
    let validatedUrl: string;
    try {
      validatedUrl = validateRtspUrl(urlParam);
    } catch (err) {
      ws.close(1008, err instanceof Error ? err.message : 'Invalid RTSP URL');
      return;
    }

    const sessionId = randomUUID();

    const ffmpeg = spawn('ffmpeg', [
      '-protocol_whitelist', 'rtsp,rtp,udp,tcp',
      '-rtsp_transport', 'tcp',
      '-i', validatedUrl,
      '-f', 'mpegts',
      '-codec:v', 'mpeg1video',
      '-b:v', '1000k',
      '-r', '15',
      '-an',
      'pipe:1',
    ]);

    // Session timeout to prevent resource exhaustion
    const timeout = setTimeout(() => {
      console.log(`[RTSP ${sessionId}] Session timed out after ${SESSION_TIMEOUT_MS / 60000}m`);
      cleanup(sessionId);
    }, SESSION_TIMEOUT_MS);

    const session: ProxySession = { ws, ffmpeg, url: validatedUrl, timeout };
    sessions.set(sessionId, session);

    ffmpeg.stdout.on('data', (data: Buffer) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    ffmpeg.stderr.on('data', (data: Buffer) => {
      // Redact any credentials from ffmpeg log output
      const line = data.toString().replace(/rtsp[s]?:\/\/[^\s]+/gi, (match) => redactUrl(match));
      console.log(`[RTSP ${sessionId}]`, line);
    });

    ffmpeg.on('close', () => {
      cleanup(sessionId);
    });

    ws.on('close', () => {
      cleanup(sessionId);
    });

    ws.on('error', () => {
      cleanup(sessionId);
    });
  });

  // Bind to localhost only — not exposed to the network
  server.listen(port, '127.0.0.1', () => {
    console.log(`RTSP proxy listening on 127.0.0.1:${port}`);
  });

  return server;
}

function cleanup(sessionId: string) {
  const session = sessions.get(sessionId);
  if (!session) return;

  clearTimeout(session.timeout);

  if (session.ffmpeg && !session.ffmpeg.killed) {
    session.ffmpeg.kill('SIGTERM');
  }

  if (session.ws.readyState === WebSocket.OPEN) {
    session.ws.close();
  }

  sessions.delete(sessionId);
}
