'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import '@xterm/xterm/css/xterm.css';
import { io, type Socket } from 'socket.io-client';
import { TerminalSquare, Server, Cpu, HardDrive, Clock, AlertTriangle } from 'lucide-react';
import {
  sandboxes,
  missions,
  tokenStore,
  API_ORIGIN,
  type SandboxStatus,
  type Mission,
} from '@/lib/api';

export default function TerminalPage() {
  const [status, setStatus] = useState<SandboxStatus | null>(null);
  const [missionList, setMissionList] = useState<Mission[]>([]);
  const [missionId, setMissionId] = useState<string>('');
  const [connected, setConnected] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const termRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const xtermRef = useRef<any>(null);

  useEffect(() => {
    sandboxes.status().then(setStatus).catch(() => setStatus(null));
    missions.list().then(setMissionList).catch(() => undefined);
  }, []);

  const disconnect = useCallback(() => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    xtermRef.current?.dispose?.();
    xtermRef.current = null;
    setConnected(false);
  }, []);

  const connect = useCallback(async () => {
    if (!missionId || !termRef.current) return;
    setNotice(null);
    const { Terminal } = await import('@xterm/xterm');
    const { FitAddon } = await import('@xterm/addon-fit');

    const term = new Terminal({
      fontFamily: 'var(--font-mono), monospace',
      fontSize: 13,
      theme: { background: '#070b11', foreground: '#e6edf3', cursor: '#2dd4bf' },
      cursorBlink: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(termRef.current);
    fit.fit();
    xtermRef.current = term;

    const socket = io(`${API_ORIGIN}/terminal`, {
      transports: ['websocket'],
      auth: { token: tokenStore.access, missionId },
    });
    socketRef.current = socket;

    socket.on('ready', () => {
      setConnected(true);
      socket.emit('resize', { cols: term.cols, rows: term.rows });
    });
    socket.on('data', (d: string) => term.write(d));
    socket.on('unavailable', (m: string) => {
      setNotice(m);
      term.writeln(`\r\n\x1b[33m[sandbox unavailable] ${m}\x1b[0m`);
    });
    socket.on('error-msg', (m: string) => setNotice(m));
    socket.on('exit', () => {
      term.writeln('\r\n\x1b[90m[session ended]\x1b[0m');
      setConnected(false);
    });
    socket.on('disconnect', () => setConnected(false));

    term.onData((d) => socket.emit('input', d));
    const onResize = () => {
      fit.fit();
      socket.emit('resize', { cols: term.cols, rows: term.rows });
    };
    window.addEventListener('resize', onResize);
    socket.on('disconnect', () => window.removeEventListener('resize', onResize));
  }, [missionId]);

  useEffect(() => () => disconnect(), [disconnect]);

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-text">
          <TerminalSquare size={20} className="text-accent" /> Terminal
        </h1>
        <p className="text-sm text-text-muted">Interactive shell inside an isolated, resource-capped sandbox.</p>
      </div>

      {/* Sandbox status */}
      {status && (
        <div className="card grid gap-3 p-4 sm:grid-cols-4">
          <Stat icon={Server} label="Driver" value={`${status.driver} - ${status.available ? 'available' : 'unavailable'}`} ok={status.available} />
          <Stat icon={Cpu} label="CPU / Mem" value={`${status.caps.cpu} vCPU - ${status.caps.memoryMb} MB`} />
          <Stat icon={HardDrive} label="Disk" value={`${status.caps.diskMb} MB`} />
          <Stat icon={Clock} label="Wall-clock" value={`${status.wallclockLimit}s`} />
        </div>
      )}

      {status && !status.available && (
        <div className="card flex items-start gap-3 border-warn/30 bg-warn/5 p-4 text-sm">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warn" />
          <div>
            <p className="text-text">Sandbox backend not reachable</p>
            <p className="mt-1 text-text-muted">
              No <span className="font-mono">{status.driver}</span> backend is available in this environment, so
              no shell can be opened. Deploy with a reachable Docker daemon (or E2B) to enable the terminal.
              Commands never run on the application server.
            </p>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <select className="input max-w-xs" value={missionId} onChange={(e) => setMissionId(e.target.value)} disabled={connected}>
          <option value="">Select a mission...</option>
          {missionList.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        {connected ? (
          <button className="btn-ghost" onClick={disconnect}>Disconnect</button>
        ) : (
          <button className="btn-primary" disabled={!missionId || !status?.available} onClick={connect}>
            Open shell
          </button>
        )}
        {notice && <span className="text-sm text-warn">{notice}</span>}
      </div>

      {/* Terminal surface */}
      <div className="card overflow-hidden p-0">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs text-text-dim">
          <span className={`h-2 w-2 rounded-full ${connected ? 'bg-success' : 'bg-text-dim'}`} />
          {connected ? 'connected' : 'not connected'}
        </div>
        <div ref={termRef} className="h-[460px] w-full bg-bg p-2" />
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, ok }: { icon: typeof Server; label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`rounded-lg bg-bg-elevated p-2 ${ok === false ? 'text-warn' : 'text-accent'}`}>
        <Icon size={16} />
      </div>
      <div>
        <p className="text-[11px] uppercase tracking-wide text-text-dim">{label}</p>
        <p className="text-sm text-text">{value}</p>
      </div>
    </div>
  );
}
