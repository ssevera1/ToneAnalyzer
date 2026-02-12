import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { spawn } from 'child_process';

interface ProxySession {
  ws: WebSocket;
  ffmpeg: ReturnType<typeof spawn> | null;
  url: string;
}

const sessions = new Map<string, ProxySession>();

export function startRtspProxy(port: number = 9999) {
  const server = createServer();
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws, req) => {
    const urlParam = new URL(req.url || '', `http://localhost:${port}`).searchParams.get('url');
    if (!urlParam) {
      ws.close(1008, 'Missing RTSP URL');
      return;
    }

    const sessionId = Math.random().toString(36).substring(2);

    const ffmpeg = spawn('ffmpeg', [
      '-rtsp_transport', 'tcp',
      '-i', urlParam,
      '-f', 'mpegts',
      '-codec:v', 'mpeg1video',
      '-b:v', '1000k',
      '-r', '15',
      '-an',
      'pipe:1',
    ]);

    const session: ProxySession = { ws, ffmpeg, url: urlParam };
    sessions.set(sessionId, session);

    ffmpeg.stdout.on('data', (data: Buffer) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    ffmpeg.stderr.on('data', (data: Buffer) => {
      console.log(`[RTSP ${sessionId}]`, data.toString());
    });

    ffmpeg.on('close', () => {
      sessions.delete(sessionId);
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });

    ws.on('close', () => {
      ffmpeg.kill('SIGTERM');
      sessions.delete(sessionId);
    });

    ws.on('error', () => {
      ffmpeg.kill('SIGTERM');
      sessions.delete(sessionId);
    });
  });

  server.listen(port, () => {
    console.log(`RTSP proxy listening on port ${port}`);
  });

  return server;
}
