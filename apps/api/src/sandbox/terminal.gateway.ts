import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { SandboxService } from './sandbox.service';
import { SandboxUnavailableError } from './sandbox.types';

interface Session {
  stream: NodeJS.ReadWriteStream;
  resize: (w: number, h: number) => Promise<void>;
}

/**
 * Terminal WebSocket gateway. Authenticates the handshake token, resolves the
 * mission's sandbox, and bridges an isolated PTY to the browser's xterm.js.
 * It never runs anything on the application server — only inside the sandbox.
 */
@WebSocketGateway({ namespace: '/terminal', cors: { origin: true } })
export class TerminalGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(TerminalGateway.name);
  private readonly sessions = new Map<string, Session>();

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly sandboxes: SandboxService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      const missionId = client.handshake.auth?.missionId as string | undefined;
      if (!token || !missionId) {
        client.emit('error-msg', 'Missing token or missionId');
        client.disconnect(true);
        return;
      }
      const payload = await this.jwt.verifyAsync(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
      const orgId: string | null = payload.orgId ?? null;
      const permissions: string[] = payload.permissions ?? [];
      if (!orgId || !permissions.includes('sandbox:execute')) {
        client.emit('error-msg', 'Not authorized for sandbox execution');
        client.disconnect(true);
        return;
      }

      const { stream, resize } = await this.sandboxes.openTerminal(orgId, missionId);
      this.sessions.set(client.id, { stream, resize });

      stream.on('data', (chunk: Buffer) => client.emit('data', chunk.toString('utf8')));
      stream.on('end', () => {
        client.emit('exit');
        client.disconnect(true);
      });
      client.emit('ready');
    } catch (err) {
      if (err instanceof SandboxUnavailableError) {
        client.emit('unavailable', err.message);
      } else {
        client.emit('error-msg', String(err).slice(0, 200));
      }
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const session = this.sessions.get(client.id);
    if (session) {
      try {
        session.stream.end();
      } catch {
        /* ignore */
      }
      this.sessions.delete(client.id);
    }
  }

  @SubscribeMessage('input')
  onInput(@ConnectedSocket() client: Socket, @MessageBody() data: string): void {
    this.sessions.get(client.id)?.stream.write(data);
  }

  @SubscribeMessage('resize')
  onResize(@ConnectedSocket() client: Socket, @MessageBody() size: { cols: number; rows: number }): void {
    void this.sessions.get(client.id)?.resize(size.cols, size.rows);
  }
}
