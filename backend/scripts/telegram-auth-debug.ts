import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { Api } from 'telegram/tl';

type ConstructorLike = {
  className?: string;
  length?: number;
  timeout?: number;
  nextType?: unknown;
  type?: unknown;
  phoneCodeHash?: string;
  pattern?: string;
  prefix?: string;
  emailPattern?: string;
  beginning?: string;
};

function maskPhone(phone: string): string {
  return phone.replace(/(\+?\d{0,2})\d{3}(\d{2,})/, '$1***$2');
}

function getClassName(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const className = (value as ConstructorLike).className;
  if (typeof className === 'string') return className;
  const constructorName = (value as { constructor?: { name?: unknown } }).constructor?.name;
  return typeof constructorName === 'string' ? constructorName : undefined;
}

function describeSentCode(value: unknown) {
  const sentCode = value as ConstructorLike;
  const type = sentCode.type as ConstructorLike | undefined;
  const nextType = sentCode.nextType as ConstructorLike | undefined;

  return {
    className: getClassName(value),
    deliveryClassName: getClassName(type),
    nextDeliveryClassName: getClassName(nextType),
    timeoutSec: typeof sentCode.timeout === 'number' ? sentCode.timeout : undefined,
    codeLength: typeof type?.length === 'number' ? type.length : undefined,
    pattern: type?.emailPattern ?? type?.pattern ?? type?.prefix ?? type?.beginning,
    hasPhoneCodeHash: Boolean(sentCode.phoneCodeHash),
  };
}

function describeError(error: unknown) {
  const err = error as {
    code?: unknown;
    errorMessage?: unknown;
    message?: unknown;
    stack?: unknown;
  };
  return {
    name: error instanceof Error ? error.name : undefined,
    code: err.code,
    errorMessage: err.errorMessage,
    message: err.message,
  };
}

function describeConnection(client: TelegramClient) {
  const session = client.session as unknown as {
    dcId?: number;
    serverAddress?: string;
    port?: number;
  };
  return {
    dcId: session.dcId,
    serverAddress: session.serverAddress,
    port: session.port,
  };
}

function parseArgs(argv: string[]) {
  const flags = new Map<string, string | true>();
  const positional: string[] = [];

  for (const arg of argv) {
    if (arg === '--') continue;

    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }

    const [key, value] = arg.slice(2).split('=', 2);
    flags.set(key, value ?? true);
  }

  return { flags, positional };
}

function printHelp() {
  console.log(`
Usage:
  pnpm --filter backend auth:debug -- <phone> [--resend] [--resend-after=SECONDS]

Examples:
  pnpm --filter backend auth:debug -- +79991234567
  pnpm --filter backend auth:debug -- +79991234567 --resend-after=60

What it does:
  - starts from an empty StringSession, bypassing app DB/storage
  - calls Telegram auth.SendCode
  - this asks Telegram to send a real login code
  - prints deliveryClassName, nextDeliveryClassName, timeoutSec, codeLength
  - optionally calls auth.ResendCode for the same phoneCodeHash
`);
}

async function delay(ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const { flags, positional } = parseArgs(process.argv.slice(2));
  if (flags.has('help') || flags.has('h')) {
    printHelp();
    return;
  }

  const phone = positional[0] ?? process.env.TELEGRAM_AUTH_DEBUG_PHONE;
  if (!phone) {
    printHelp();
    throw new Error('Phone number is required');
  }

  const apiId = process.env.TELEGRAM_API_ID ? Number(process.env.TELEGRAM_API_ID) : NaN;
  const apiHash = process.env.TELEGRAM_API_HASH;
  if (!Number.isFinite(apiId) || !apiHash) {
    throw new Error('TELEGRAM_API_ID and TELEGRAM_API_HASH are required in .env');
  }

  const client = new TelegramClient(new StringSession(''), apiId, apiHash, {
    connectionRetries: 3,
  });

  await client.connect();
  console.log(
    JSON.stringify(
      {
        event: 'connected',
        maskedPhone: maskPhone(phone),
        connection: describeConnection(client),
      },
      null,
      2
    )
  );

  let phoneCodeHash: string | undefined;
  try {
    const sentCode = await client.invoke(
      new Api.auth.SendCode({
        phoneNumber: phone,
        apiId,
        apiHash,
        settings: new Api.CodeSettings({}),
      })
    );
    phoneCodeHash = (sentCode as ConstructorLike).phoneCodeHash;
    console.log(
      JSON.stringify(
        {
          event: 'sendCode',
          maskedPhone: maskPhone(phone),
          connection: describeConnection(client),
          result: describeSentCode(sentCode),
        },
        null,
        2
      )
    );
  } catch (error) {
    console.log(
      JSON.stringify(
        {
          event: 'sendCodeError',
          maskedPhone: maskPhone(phone),
          connection: describeConnection(client),
          error: describeError(error),
        },
        null,
        2
      )
    );
    throw error;
  }

  const resendAfterFlag = flags.get('resend-after');
  const shouldResend = flags.has('resend') || typeof resendAfterFlag === 'string';
  if (shouldResend && phoneCodeHash) {
    const resendAfterSec =
      typeof resendAfterFlag === 'string' ? Number.parseInt(resendAfterFlag, 10) : 0;
    if (Number.isFinite(resendAfterSec) && resendAfterSec > 0) {
      console.log(JSON.stringify({ event: 'waitingBeforeResend', seconds: resendAfterSec }));
      await delay(resendAfterSec * 1000);
    }

    try {
      const resentCode = await client.invoke(
        new Api.auth.ResendCode({
          phoneNumber: phone,
          phoneCodeHash,
        })
      );
      console.log(
        JSON.stringify(
          {
            event: 'resendCode',
            maskedPhone: maskPhone(phone),
            connection: describeConnection(client),
            result: describeSentCode(resentCode),
          },
          null,
          2
        )
      );
    } catch (error) {
      console.log(
        JSON.stringify(
          {
            event: 'resendCodeError',
            maskedPhone: maskPhone(phone),
            connection: describeConnection(client),
            error: describeError(error),
          },
          null,
          2
        )
      );
    }
  }

  await client.disconnect();
}

main().catch(error => {
  console.error('telegram-auth-debug failed', describeError(error));
  process.exitCode = 1;
});
