import { describe, expect, it, vi } from 'vitest';
import { createBridge, serveBridge } from '@/lib/bridge';

describe('bridge', () => {
  it('leva o pedido à página e traz a resposta', async () => {
    const script = new EventTarget();
    const handle = vi.fn(() => Promise.resolve({ ok: true as const }));
    serveBridge(script, handle);
    const send = createBridge(script);

    await expect(send({ type: 'seekBy', seconds: 10 })).resolves.toEqual({ ok: true });
    expect(handle).toHaveBeenCalledWith({ type: 'seekBy', seconds: 10 });
  });

  it('casa cada resposta com o seu pedido', async () => {
    const script = new EventTarget();
    serveBridge(script, (request) =>
      Promise.resolve(
        request.type === 'getTitle'
          ? { ok: true as const, title: undefined }
          : { ok: request.type === 'skip' },
      ),
    );
    const send = createBridge(script);

    const [skip, seek] = await Promise.all([
      send({ type: 'skip' }),
      send({ type: 'seekBy', seconds: 1 }),
    ]);
    expect(skip).toEqual({ ok: true });
    expect(seek).toEqual({ ok: false });
  });

  it('responde ok: false quando a página dá erro', async () => {
    const script = new EventTarget();
    serveBridge(script, () => Promise.reject(new Error('API mudou')));
    await expect(createBridge(script)({ type: 'skip' })).resolves.toEqual({ ok: false });
  });

  it('desiste depois do timeout quando ninguém atende', async () => {
    const send = createBridge(new EventTarget(), 20);
    await expect(send({ type: 'skip' })).resolves.toEqual({ ok: false });
  });
});
