import { PassThrough } from 'node:stream';
import Docker from 'dockerode';
import { buildContainerOptions } from './container-options';
import type { CreateSandboxRequest, ExecResult, SandboxDriver } from './sandbox.types';

/**
 * Docker-backed sandbox driver. Talks to the Docker Engine over the default
 * socket. All containers are created from the hardened options builder.
 */
export class DockerDriver implements SandboxDriver {
  readonly name = 'docker';
  private readonly docker: Docker;

  constructor(socketPath = '/var/run/docker.sock') {
    this.docker = new Docker({ socketPath });
  }

  async available(): Promise<boolean> {
    try {
      await this.docker.ping();
      return true;
    } catch {
      return false;
    }
  }

  async create(req: CreateSandboxRequest): Promise<{ externalId: string }> {
    const options = buildContainerOptions(req);
    const container = await this.docker.createContainer(options as Docker.ContainerCreateOptions);
    return { externalId: container.id };
  }

  async start(externalId: string): Promise<void> {
    await this.docker.getContainer(externalId).start();
  }

  async stop(externalId: string): Promise<void> {
    await this.docker.getContainer(externalId).stop({ t: 2 }).catch(() => undefined);
  }

  async destroy(externalId: string): Promise<void> {
    await this.docker.getContainer(externalId).remove({ force: true }).catch(() => undefined);
  }

  async exec(externalId: string, command: string[], timeoutSeconds: number): Promise<ExecResult> {
    const container = this.docker.getContainer(externalId);
    const exec = await container.exec({
      Cmd: command,
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
    });
    const stream = await exec.start({ hijack: true, stdin: false });

    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const outChunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    stdout.on('data', (c) => outChunks.push(c));
    stderr.on('data', (c) => errChunks.push(c));
    this.docker.modem.demuxStream(stream, stdout, stderr);

    const finished = new Promise<void>((resolve) => stream.on('end', resolve));
    const timed = new Promise<'timeout'>((resolve) =>
      setTimeout(() => resolve('timeout'), timeoutSeconds * 1000),
    );
    const race = await Promise.race([finished.then(() => 'done' as const), timed]);
    if (race === 'timeout') {
      stream.destroy();
      return {
        exitCode: 124, // conventional timeout code
        stdout: Buffer.concat(outChunks).toString('utf8'),
        stderr: Buffer.concat(errChunks).toString('utf8') + '\n[sandbox] command timed out',
      };
    }

    const info = await exec.inspect();
    return {
      exitCode: info.ExitCode ?? 0,
      stdout: Buffer.concat(outChunks).toString('utf8'),
      stderr: Buffer.concat(errChunks).toString('utf8'),
    };
  }

  /**
   * Start an interactive PTY shell for the terminal. Returns the duplex stream
   * plus resize/inspect helpers. Used by the terminal WebSocket gateway.
   */
  async execPty(
    externalId: string,
    shell = '/bin/bash',
  ): Promise<{
    stream: NodeJS.ReadWriteStream;
    resize: (w: number, h: number) => Promise<void>;
  }> {
    const container = this.docker.getContainer(externalId);
    const exec = await container.exec({
      Cmd: [shell],
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
    });
    const stream = (await exec.start({ hijack: true, stdin: true })) as NodeJS.ReadWriteStream;
    return {
      stream,
      resize: async (w: number, h: number) => {
        await exec.resize({ w, h }).catch(() => undefined);
      },
    };
  }
}
