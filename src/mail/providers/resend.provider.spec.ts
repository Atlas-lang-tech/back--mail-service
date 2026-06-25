import { jest } from '@jest/globals';

// ---- ESM module mock: must be registered before importing the SUT ----
const sendMock = jest.fn<(args: any) => Promise<any>>();
const ResendCtor = jest.fn().mockImplementation(() => ({
  emails: { send: sendMock },
}));

jest.unstable_mockModule('resend', () => ({ Resend: ResendCtor }));

const { ResendMailProvider } = await import('./resend.provider.js');

function createConfig() {
  const values: Record<string, string> = {
    RESEND_API_KEY: 're_test_key',
    MAIL_FROM: 'no-reply@example.com',
  };
  return { getOrThrow: jest.fn((k: string) => values[k]) };
}

describe('ResendMailProvider.send', () => {
  beforeEach(() => {
    sendMock.mockReset();
    ResendCtor.mockClear();
  });

  function makeProvider() {
    return new ResendMailProvider(createConfig() as any);
  }

  it('constructs the Resend client with the configured API key', () => {
    makeProvider();
    expect(ResendCtor).toHaveBeenCalledWith('re_test_key');
  });

  it('sends with the default from address and returns the provider id', async () => {
    sendMock.mockResolvedValueOnce({ data: { id: 're_999' }, error: null });
    const provider = makeProvider();

    const result = await provider.send({
      to: 'user@example.com',
      subject: 'Hi',
      html: '<p>Hi</p>',
    });

    expect(result).toEqual({ id: 're_999' });
    expect(sendMock).toHaveBeenCalledWith({
      from: 'no-reply@example.com',
      to: 'user@example.com',
      subject: 'Hi',
      html: '<p>Hi</p>',
    });
  });

  it('honours an explicit from address', async () => {
    sendMock.mockResolvedValueOnce({ data: { id: 're_1' }, error: null });
    const provider = makeProvider();

    await provider.send({
      to: 'user@example.com',
      subject: 'Hi',
      html: '<p>Hi</p>',
      from: 'custom@example.com',
    });

    expect((sendMock.mock.calls[0][0] as any).from).toBe('custom@example.com');
  });

  it('throws when the provider returns an error (for BullMQ retry)', async () => {
    sendMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'rate limited' },
    });
    const provider = makeProvider();

    await expect(
      provider.send({ to: 'u@e.com', subject: 's', html: 'h' }),
    ).rejects.toThrow('rate limited');
  });

  it('throws when the provider returns no data', async () => {
    sendMock.mockResolvedValueOnce({ data: null, error: null });
    const provider = makeProvider();

    await expect(
      provider.send({ to: 'u@e.com', subject: 's', html: 'h' }),
    ).rejects.toThrow('Resend returned no data');
  });
});
