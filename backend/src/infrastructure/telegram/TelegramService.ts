import { mkdir } from 'fs/promises';
import { Buffer } from 'node:buffer';
import { dirname, join } from 'path';

import bigInt, { type BigInteger } from 'big-integer';
import * as input from 'input';
import { TelegramClient } from 'telegram';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore internal password helper (no TS types published)
// Import password SRP helper from public root path (avoids bundling internal client path)
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore library lacks types for Password export
import { computeCheck } from 'telegram/Password';
import { StringSession } from 'telegram/sessions';
import { Api } from 'telegram/tl';

import { serviceLoggers } from '../../../../shared/logger.mts';
import type {
  IDownloadOptions,
  IDownloadResult,
  IFileInfo,
  IStorageService,
  ITelegramAuthCodeDelivery,
  ITelegramChannel,
  ITelegramQrAuthStartResult,
  ITelegramQrAuthToken,
  ITelegramQrAuthWaitResult,
  ITelegramService,
  ITelegramSession,
  ITelegramStartAuthResult,
  ITelegramUserMinimal,
  ITopic,
  ITopicFileInfo,
  TTelegramAuthCodeDeliveryType,
} from '../../../../types';
import { EOperationStatus } from '../../../../types';
import type { RetryConfig } from '../../config/retryConfig';
import { RETRY_CONFIGS, RetryManager } from '../../config/retryConfig';

type TelegramConstructorLike = {
  className?: string;
  length?: number;
  pattern?: string;
  prefix?: string;
  emailPattern?: string;
  beginning?: string;
  pushTimeout?: number;
};

type QrAuthPromiseControls = {
  resolve: (result: ITelegramQrAuthWaitResult) => void;
  reject: (error: Error) => void;
};

const AUTH_CODE_DELIVERY_LABELS: Record<TTelegramAuthCodeDeliveryType, string> = {
  app: 'Telegram app',
  sms: 'SMS',
  call: 'phone call',
  flash_call: 'flash call',
  missed_call: 'missed call',
  email: 'email',
  email_setup: 'email setup',
  fragment_sms: 'Fragment SMS',
  firebase_sms: 'Firebase SMS',
  sms_word: 'SMS word',
  sms_phrase: 'SMS phrase',
  unknown: 'unknown method',
};

function maskPhoneNumber(phoneNumber: string): string {
  return phoneNumber.replace(/(\+?\d{0,2})\d{3}(\d{2,})/, '$1***$2');
}

function normalizeTelegramPhone(phoneNumber?: string): string | undefined {
  if (!phoneNumber) return undefined;
  return phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
}

function buildQrAuthToken(token: Buffer, expires: number): ITelegramQrAuthToken {
  const expiresAt = new Date(expires * 1000).toISOString();
  return {
    url: `tg://login?token=${token.toString('base64url')}`,
    expiresAt,
    expiresInSec: Math.max(0, Math.floor(expires - Date.now() / 1000)),
  };
}

function getTelegramConstructorName(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const className = (value as TelegramConstructorLike).className;
  if (typeof className === 'string') return className;
  const constructorName = (value as { constructor?: { name?: unknown } }).constructor?.name;
  return typeof constructorName === 'string' ? constructorName : undefined;
}

function normalizeAuthCodeDeliveryType(rawType?: string): TTelegramAuthCodeDeliveryType {
  const name = rawType?.replace(/^auth\./, '');

  switch (name) {
    case 'SentCodeTypeApp':
      return 'app';
    case 'SentCodeTypeSms':
    case 'CodeTypeSms':
      return 'sms';
    case 'SentCodeTypeCall':
    case 'CodeTypeCall':
      return 'call';
    case 'SentCodeTypeFlashCall':
    case 'CodeTypeFlashCall':
      return 'flash_call';
    case 'SentCodeTypeMissedCall':
    case 'CodeTypeMissedCall':
      return 'missed_call';
    case 'SentCodeTypeEmailCode':
      return 'email';
    case 'SentCodeTypeSetUpEmailRequired':
      return 'email_setup';
    case 'SentCodeTypeFragmentSms':
    case 'CodeTypeFragmentSms':
      return 'fragment_sms';
    case 'SentCodeTypeFirebaseSms':
      return 'firebase_sms';
    case 'SentCodeTypeSmsWord':
      return 'sms_word';
    case 'SentCodeTypeSmsPhrase':
      return 'sms_phrase';
    default:
      return 'unknown';
  }
}

function extractAuthCodeDelivery(sentCode: unknown): ITelegramAuthCodeDelivery | undefined {
  if (!sentCode || typeof sentCode !== 'object') return undefined;

  const sentCodeObject = sentCode as {
    type?: unknown;
    nextType?: unknown;
    timeout?: unknown;
  };
  const typeObject = sentCodeObject.type as TelegramConstructorLike | undefined;
  const rawType = getTelegramConstructorName(typeObject);
  const type = normalizeAuthCodeDeliveryType(rawType);
  const rawNextType = getTelegramConstructorName(sentCodeObject.nextType);
  const nextType = rawNextType ? normalizeAuthCodeDeliveryType(rawNextType) : undefined;
  const timeout =
    typeof sentCodeObject.timeout === 'number'
      ? sentCodeObject.timeout
      : typeof typeObject?.pushTimeout === 'number'
        ? typeObject.pushTimeout
        : undefined;
  const pattern =
    typeObject?.emailPattern ?? typeObject?.pattern ?? typeObject?.prefix ?? typeObject?.beginning;

  return {
    type,
    label: AUTH_CODE_DELIVERY_LABELS[type],
    rawType,
    nextType,
    nextLabel: nextType ? AUTH_CODE_DELIVERY_LABELS[nextType] : undefined,
    rawNextType,
    timeoutSec: timeout,
    length: typeof typeObject?.length === 'number' ? typeObject.length : undefined,
    pattern,
  };
}

/**
 * TelegramService – реализация ITelegramService поверх GramJS
 * Стараемся придерживаться существующих интерфейсов без их изменения.
 */
export class TelegramService implements ITelegramService {
  private client: TelegramClient | null = null;
  private isInitialized = false;
  private logger = serviceLoggers.telegram;
  private retryManager: RetryManager;
  private channelCache: ITelegramChannel[] | null = null;
  private readonly configuredChannelIds?: string[];
  // Stepwise auth state
  private authPhone?: string;
  private phoneCodeHash?: string;
  private authDelivery?: ITelegramAuthCodeDelivery;
  private qrAuthPromise?: Promise<ITelegramQrAuthWaitResult>;
  private qrAuthControls?: QrAuthPromiseControls;
  private qrAuthPending = false;
  private qrAuthFlowId = 0;
  private hasRestoredSession = false;

  constructor(
    private storageService: IStorageService,
    private apiId: number,
    private apiHash: string,
    configuredChannelIds?: string[],
    private retryConfig: RetryConfig = RETRY_CONFIGS.telegram
  ) {
    this.configuredChannelIds = configuredChannelIds?.map(id => id.trim()).filter(Boolean);
    this.retryManager = new RetryManager(this.retryConfig);
  }

  private createClient(stringSession = ''): TelegramClient {
    return new TelegramClient(new StringSession(stringSession), this.apiId, this.apiHash, {
      connectionRetries: this.retryConfig.maxAttempts,
    });
  }

  private async resetToUnauthenticatedClient(reason: string): Promise<void> {
    if (this.client) {
      await this.client.disconnect().catch(() => undefined);
    }

    this.client = this.createClient();
    this.isInitialized = true;
    this.hasRestoredSession = false;
    this.channelCache = null;
    this.logger.info('Telegram client reset to unauthenticated auth session', { reason });
  }

  private isInvalidStoredSessionError(error: unknown): boolean {
    const message = (error as Error | undefined)?.message ?? '';
    return (
      message.includes('AUTH_KEY_UNREGISTERED') ||
      message.includes('AUTH_KEY_INVALID') ||
      message.includes('SESSION_REVOKED') ||
      message.includes('SESSION_EXPIRED')
    );
  }

  private isSendCodeUnavailableError(error: unknown): boolean {
    const maybeError = error as { errorMessage?: unknown; message?: unknown };
    return (
      maybeError.errorMessage === 'SEND_CODE_UNAVAILABLE' ||
      (typeof maybeError.message === 'string' &&
        maybeError.message.includes('SEND_CODE_UNAVAILABLE'))
    );
  }

  private isPasswordNeededError(error: unknown): boolean {
    const message = (error as Error | undefined)?.message ?? '';
    const errorMessage = (error as { errorMessage?: unknown } | undefined)?.errorMessage;
    return (
      errorMessage === 'SESSION_PASSWORD_NEEDED' || message.includes('SESSION_PASSWORD_NEEDED')
    );
  }

  private createQrAuthPromise(): Promise<ITelegramQrAuthWaitResult> {
    return new Promise<ITelegramQrAuthWaitResult>((resolve, reject) => {
      this.qrAuthControls = { resolve, reject };
    });
  }

  private clearQrAuthState(): void {
    this.qrAuthPromise = undefined;
    this.qrAuthControls = undefined;
    this.qrAuthPending = false;
  }

  private async exportQrAuthToken(client: TelegramClient): Promise<ITelegramQrAuthToken> {
    const result = await client.invoke(
      new Api.auth.ExportLoginToken({
        apiId: this.apiId,
        apiHash: this.apiHash,
        exceptIds: [],
      })
    );

    if (!(result instanceof Api.auth.LoginToken)) {
      throw new Error(`Unexpected QR auth token response: ${result.className}`);
    }

    return buildQrAuthToken(Buffer.from(result.token), result.expires);
  }

  private async saveClientSession(phoneNumber?: string): Promise<ITelegramSession> {
    const client = this.getClient();
    const saved = client.session.save();
    const sessionData = typeof saved === 'string' ? saved : '';
    const session: ITelegramSession = {
      id: '1',
      sessionData,
      stringSession: sessionData,
      phoneNumber: normalizeTelegramPhone(phoneNumber),
      isActive: true,
      lastUsed: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await this.storageService.saveTelegramSession(session);
    this.hasRestoredSession = true;
    this.channelCache = null;
    return session;
  }

  private async completeQrAuth(client: TelegramClient): Promise<ITelegramQrAuthWaitResult> {
    const result = await client.invoke(
      new Api.auth.ExportLoginToken({
        apiId: this.apiId,
        apiHash: this.apiHash,
        exceptIds: [],
      })
    );

    let authorization: Api.auth.TypeAuthorization | undefined;

    if (result instanceof Api.auth.LoginTokenSuccess) {
      authorization = result.authorization;
    } else if (result instanceof Api.auth.LoginTokenMigrateTo) {
      await (client as unknown as { _switchDC: (dcId: number) => Promise<void> })._switchDC(
        result.dcId
      );
      const migratedResult = await client.invoke(
        new Api.auth.ImportLoginToken({
          token: result.token,
        })
      );
      if (migratedResult instanceof Api.auth.LoginTokenSuccess) {
        authorization = migratedResult.authorization;
      }
    }

    if (!(authorization instanceof Api.auth.Authorization)) {
      throw new Error(`Unexpected QR auth completion response: ${result.className}`);
    }

    const phoneNumber = normalizeTelegramPhone(
      (authorization.user as unknown as { phone?: string }).phone
    );
    const session = await this.saveClientSession(phoneNumber);
    this.authPhone = undefined;
    this.phoneCodeHash = undefined;
    this.authDelivery = undefined;
    this.logger.info('QR auth completed successfully', {
      maskedPhone: session.phoneNumber ? maskPhoneNumber(session.phoneNumber) : undefined,
    });

    return {
      success: true,
      maskedPhone: session.phoneNumber ? maskPhoneNumber(session.phoneNumber) : undefined,
    };
  }

  private async handleQrLoginTokenUpdate(flowId: number, update: unknown): Promise<void> {
    if (flowId !== this.qrAuthFlowId || !this.qrAuthPending) return;
    if (!(update instanceof Api.UpdateLoginToken)) return;

    this.logger.info('QR login token scanned');
    const controls = this.qrAuthControls;
    try {
      const result = await this.completeQrAuth(this.getClient());
      this.clearQrAuthState();
      controls?.resolve(result);
    } catch (error) {
      if (this.isPasswordNeededError(error)) {
        this.clearQrAuthState();
        controls?.resolve({ needsPassword: true });
        return;
      }

      this.clearQrAuthState();
      controls?.reject(error as Error);
    }
  }

  private async prepareClientForAuth(): Promise<TelegramClient> {
    if (!this.client || !this.isInitialized) {
      await this.initialize();
    }

    if (this.qrAuthPending || this.qrAuthPromise) {
      await this.cancelQrAuth().catch(() => undefined);
    }

    if (this.hasRestoredSession) {
      this.logger.warn('Stored Telegram session present while starting auth, clearing it first');
      await this.storageService.clearTelegramSessions();
      await this.resetToUnauthenticatedClient('start auth with phone code');
    } else if (this.authPhone || this.phoneCodeHash) {
      await this.resetToUnauthenticatedClient('restart phone code auth');
      this.authPhone = undefined;
      this.phoneCodeHash = undefined;
      this.authDelivery = undefined;
    }

    const client = this.getClient();
    await client.connect();
    return client;
  }

  private logAuthClientConnection(operation: 'send' | 'resend'): void {
    const session = this.getClient().session as unknown as {
      dcId?: number;
      serverAddress?: string;
      port?: number;
    };
    this.logger.info('Telegram auth client connected', {
      operation,
      dcId: session.dcId,
      serverAddress: session.serverAddress,
      port: session.port,
    });
  }

  private getAuthClientConnectionInfo(): {
    dcId?: number;
    serverAddress?: string;
    port?: number;
  } {
    const session = this.getClient().session as unknown as {
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

  private buildStartAuthResult(
    phoneNumber: string,
    sentCode: unknown,
    operation: 'send' | 'resend'
  ): ITelegramStartAuthResult {
    const delivery = extractAuthCodeDelivery(sentCode);
    const anyRes = sentCode as { phoneCodeHash?: string };
    this.authPhone = phoneNumber;
    this.phoneCodeHash = anyRes.phoneCodeHash;
    this.authDelivery = delivery;
    const maskedPhone = maskPhoneNumber(phoneNumber);

    this.logger.info(
      operation === 'send'
        ? 'auth.SendCode response received'
        : 'auth.ResendCode response received',
      {
        maskedPhone,
        deliveryType: delivery?.type,
        rawDeliveryType: delivery?.rawType,
        nextDeliveryType: delivery?.nextType,
        rawNextDeliveryType: delivery?.rawNextType,
        timeoutSec: delivery?.timeoutSec,
        codeLength: delivery?.length,
        hasHash: !!this.phoneCodeHash,
        authClient: this.getAuthClientConnectionInfo(),
      }
    );

    return {
      needsCode: true,
      maskedPhone,
      delivery,
    };
  }

  /** Initializes client restoring existing session if present */
  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Telegram client...');
      const savedSession = await this.storageService.getTelegramSession();
      const stringSession = savedSession?.sessionData || savedSession?.stringSession || '';
      this.hasRestoredSession = Boolean(stringSession);

      this.client = this.createClient(stringSession);

      this.isInitialized = true;
      this.logger.info('Telegram client initialized successfully', {
        hasSavedSession: this.hasRestoredSession,
      });

      if (this.hasRestoredSession) {
        await this.tryRestoreSessionOnStartup();
      }
    } catch (error) {
      this.logger.error(error as Error, 'Failed to initialize Telegram client');
      throw error;
    }
  }

  /** Phone based authentication (interactive via input) */
  async authenticate(
    phoneNumber?: string
  ): Promise<{ needsPassword: boolean; needsCode: boolean }> {
    this.ensureInitialized();
    try {
      this.logger.info('Starting Telegram authentication...');
      const client = this.getClient();
      await client.start({
        phoneNumber: phoneNumber || (async () => await input.text('Enter your phone number: ')),
        password: async () => await input.text('Enter your password: '),
        phoneCode: async () => await input.text('Enter the code you received: '),
        onError: (err: Error) => {
          this.logger.error(err, 'Telegram auth error');
          throw err;
        },
      });
      const saved = client.session.save();
      const sessionData = typeof saved === 'string' ? saved : '';
      const session: ITelegramSession = {
        id: '1',
        sessionData,
        stringSession: sessionData,
        isActive: true,
        lastUsed: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await this.storageService.saveTelegramSession(session);
      this.logger.info('Telegram authentication completed successfully');
      return { needsPassword: false, needsCode: false };
    } catch (error) {
      this.logger.error(error as Error, 'Failed to authenticate with Telegram');
      throw error;
    }
  }

  /** Code confirmation (stub – handled inside authenticate flow) */
  async confirmAuth(_code: string): Promise<boolean> {
    return true;
  }

  /** Starts stepwise authentication by sending code */
  async startAuth(phoneNumber: string): Promise<ITelegramStartAuthResult> {
    const client = await this.prepareClientForAuth();
    this.logAuthClientConnection('send');
    const maskedPhone = maskPhoneNumber(phoneNumber);
    try {
      this.logger.info('Sending auth code requested', { maskedPhone });
      const res = await client.invoke(
        new Api.auth.SendCode({
          phoneNumber,
          apiId: this.apiId,
          apiHash: this.apiHash,
          settings: new Api.CodeSettings({}),
        })
      );
      if (res instanceof Api.auth.SentCodeSuccess) {
        throw new Error('Already authorized immediately after requesting the code');
      }

      return this.buildStartAuthResult(phoneNumber, res, 'send');
    } catch (error) {
      this.logger.error(error as Error, 'startAuth (sendCode) failed', { maskedPhone });
      throw error;
    }
  }

  /** Starts QR authentication by exporting a Telegram login token */
  async startQrAuth(): Promise<ITelegramQrAuthStartResult> {
    await this.cancelQrAuth().catch(() => undefined);
    const client = await this.prepareClientForAuth();
    const flowId = ++this.qrAuthFlowId;
    this.qrAuthPending = true;
    this.qrAuthPromise = this.createQrAuthPromise();

    client.addEventHandler((update: unknown) => {
      void this.handleQrLoginTokenUpdate(flowId, update);
    });

    try {
      const qr = await this.exportQrAuthToken(client);
      this.logger.info('QR auth token exported', {
        expiresAt: qr.expiresAt,
        expiresInSec: qr.expiresInSec,
        authClient: this.getAuthClientConnectionInfo(),
      });
      return { qr };
    } catch (error) {
      const controls = this.qrAuthControls;
      this.clearQrAuthState();
      controls?.reject(error as Error);
      this.logger.error(error as Error, 'startQrAuth failed');
      throw error;
    }
  }

  /** Waits for a pending QR authentication to be scanned and accepted */
  async waitForQrAuth(): Promise<ITelegramQrAuthWaitResult> {
    if (!this.qrAuthPromise) {
      throw new Error('QR auth not initiated');
    }
    return this.qrAuthPromise;
  }

  /** Cancels pending QR authentication state */
  async cancelQrAuth(): Promise<void> {
    if (!this.qrAuthPending && !this.qrAuthPromise) return;

    const controls = this.qrAuthControls;
    this.qrAuthFlowId++;
    this.clearQrAuthState();
    controls?.reject(new Error('QR_AUTH_CANCELLED'));
    this.logger.info('QR auth cancelled');
  }

  /** Requests Telegram to resend/switch delivery method for the current auth code */
  async resendAuthCode(): Promise<ITelegramStartAuthResult> {
    if (!this.authPhone || !this.phoneCodeHash) {
      throw new Error('Auth not initiated');
    }

    const client = this.getClient();
    await client.connect();
    this.logAuthClientConnection('resend');
    const maskedPhone = maskPhoneNumber(this.authPhone);

    try {
      this.logger.info('Resending auth code requested', { maskedPhone });
      const res = await client.invoke(
        new Api.auth.ResendCode({
          phoneNumber: this.authPhone,
          phoneCodeHash: this.phoneCodeHash,
        })
      );

      if (res instanceof Api.auth.SentCodeSuccess) {
        throw new Error('Already authorized immediately after resending the code');
      }

      return this.buildStartAuthResult(this.authPhone, res, 'resend');
    } catch (error) {
      if (this.isSendCodeUnavailableError(error)) {
        const delivery: ITelegramAuthCodeDelivery = {
          ...(this.authDelivery ?? {
            type: 'unknown',
            label: AUTH_CODE_DELIVERY_LABELS.unknown,
          }),
          resendUnavailable: true,
          resendUnavailableReason: 'SEND_CODE_UNAVAILABLE',
        };
        this.authDelivery = delivery;
        this.logger.warn('Telegram refused to resend auth code for this auth attempt', {
          maskedPhone,
          deliveryType: delivery.type,
          rawDeliveryType: delivery.rawType,
          reason: delivery.resendUnavailableReason,
        });
        return {
          needsCode: true,
          maskedPhone,
          delivery,
        };
      }
      this.logger.error(error as Error, 'resendAuthCode failed', { maskedPhone });
      throw error;
    }
  }

  /** Submits received code; may require 2FA password */
  async submitCode(
    code: string
  ): Promise<
    { success: true; maskedPhone?: string } | { needsPassword: true; maskedPhone?: string }
  > {
    if (!this.client || !this.isInitialized) {
      await this.initialize();
    }
    const client = this.getClient();
    await client.connect();
    if (!this.authPhone || !this.phoneCodeHash) throw new Error('Auth not initiated');
    try {
      this.logger.info('Submitting auth code...', { code: '***' });
      const res = await client.invoke(
        new Api.auth.SignIn({
          phoneNumber: this.authPhone,
          phoneCodeHash: this.phoneCodeHash,
          phoneCode: code,
        })
      );
      this.logger.info('auth.SignIn response received', {
        type: res.constructor.name,
      });
      if (res instanceof Api.auth.Authorization) {
        this.logger.info('Auth success (signed in)');
        const saved = client.session.save();
        const sessionData = typeof saved === 'string' ? saved : '';
        const session: ITelegramSession = {
          id: '1',
          sessionData,
          stringSession: sessionData,
          phoneNumber: this.authPhone,
          isActive: true,
          lastUsed: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await this.storageService.saveTelegramSession(session);
        // Clear auth state
        this.authPhone = undefined;
        this.phoneCodeHash = undefined;
        this.authDelivery = undefined;
        return { success: true, maskedPhone: session.phoneNumber };
      }
      // If we receive auth.AuthorizationSignUpRequired or similar, treat as success for now
      this.logger.warn('Received unexpected auth result', { result: res });
      return { success: true, maskedPhone: this.authPhone };
    } catch (error) {
      // If error indicates SESSION_PASSWORD_NEEDED
      const msg = (error as Error).message || '';
      if (msg.includes('SESSION_PASSWORD_NEEDED') || msg.includes('PASSWORD_HASH_INVALID')) {
        return { needsPassword: true, maskedPhone: this.authPhone };
      }
      this.logger.error(error as Error, 'submitCode failed');
      throw error;
    }
  }

  /** Submits 2FA password */
  async submitPassword(password: string): Promise<{ success: true; maskedPhone?: string }> {
    if (!this.client || !this.isInitialized) {
      await this.initialize();
    }
    const client = this.getClient();
    await client.connect();
    try {
      this.logger.info('Submitting 2FA password...');
      // Official SRP flow: GetPassword -> computeCheck -> auth.CheckPassword
      const pwState = await client.invoke(new Api.account.GetPassword());
      this.logger.debug('Password state received');
      const passwordCheck = await computeCheck(pwState, password);
      this.logger.debug('SRP check computed');
      await client.invoke(new Api.auth.CheckPassword({ password: passwordCheck }));
      this.logger.info('auth.CheckPassword success');
      const me = await this.getMeMinimal();
      const session = await this.saveClientSession(this.authPhone ?? me?.phone);
      this.authPhone = undefined;
      this.phoneCodeHash = undefined;
      this.authDelivery = undefined;
      return { success: true, maskedPhone: session.phoneNumber };
    } catch (error) {
      this.logger.error(error as Error, 'submitPassword failed');
      throw error;
    }
  }

  /** Fetch channels that support forums */
  async getChannels(): Promise<ITelegramChannel[]> {
    if (!this.client || !this.isInitialized) {
      await this.initialize();
    }
    if (this.channelCache) return this.channelCache; // serve from cache to reduce flood
    const client = this.getClient();
    return this.executeWithRetry('getChannels', async () => {
      this.logger.info('Fetching user channels...');

      if (Array.isArray(this.configuredChannelIds) && this.configuredChannelIds.length > 0) {
        const channels = await this.resolveConfiguredChannels(client, this.configuredChannelIds);
        this.channelCache = channels;
        return channels;
      }

      const result = await client.invoke(
        new Api.messages.GetDialogs({
          offsetDate: 0,
          offsetId: 0,
          offsetPeer: new Api.InputPeerEmpty(),
          limit: 100,
          hash: this.toBigInt(0),
        })
      );
      const channels: ITelegramChannel[] = [];
      if ('chats' in result) {
        for (const chat of result.chats) {
          if (chat instanceof Api.Channel || chat instanceof Api.Chat) {
            if ('forum' in chat && chat.forum) {
              channels.push({
                id: chat.id.toString(),
                title: chat.title,
                name: chat.title,
                username: 'username' in chat ? chat.username || undefined : undefined,
                accessHash: 'accessHash' in chat ? chat.accessHash?.toString() : undefined,
                isGroup: chat instanceof Api.Chat,
                isForum: 'forum' in chat ? !!chat.forum : false,
                participantsCount:
                  'participantsCount' in chat && typeof chat.participantsCount === 'number'
                    ? chat.participantsCount
                    : 0,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
              });
            }
          }
        }
      }
      this.logger.info(`Found ${channels.length} forum-enabled channels`);
      this.channelCache = channels; // cache
      return channels;
    });
  }

  private mapEntityToChannel(entity: Api.Channel | Api.Chat): ITelegramChannel {
    return {
      id: entity.id.toString(),
      title: entity.title,
      name: entity.title,
      username: 'username' in entity ? entity.username || undefined : undefined,
      accessHash: 'accessHash' in entity ? entity.accessHash?.toString() : undefined,
      isGroup: entity instanceof Api.Chat,
      isForum: 'forum' in entity ? !!entity.forum : false,
      participantsCount:
        'participantsCount' in entity && typeof entity.participantsCount === 'number'
          ? entity.participantsCount
          : 0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  private async resolveConfiguredChannels(
    client: TelegramClient,
    configuredIds: string[]
  ): Promise<ITelegramChannel[]> {
    type DialogProvider = {
      getEntity: (peer: string) => Promise<unknown>;
    };
    const provider = client as unknown as DialogProvider;

    const resolved: ITelegramChannel[] = [];
    for (const configuredId of configuredIds) {
      try {
        const entity = await provider.getEntity(configuredId);
        if (!(entity instanceof Api.Channel || entity instanceof Api.Chat)) continue;

        const mapped = this.mapEntityToChannel(entity);
        resolved.push(mapped);
      } catch {
        // Skip channels inaccessible for current account/session.
      }
    }

    return resolved;
  }

  /** Fetch topics for a given channel */
  async getTopics(channelId: string): Promise<ITopic[]> {
    this.ensureInitialized();
    const client = this.getClient();
    return this.executeWithRetry('getTopics', async () => {
      this.logger.info(`Fetching topics for channel ${channelId}...`);
      const channel = await this.getChannelById(channelId);
      if (!channel) throw new Error(`Channel ${channelId} not found`);

      const result = await client.invoke(
        new Api.channels.GetForumTopics({
          channel: new Api.InputChannel({
            channelId: this.toBigInt(channelId),
            accessHash: this.toBigInt(channel.accessHash ? channel.accessHash : '0'),
          }),
          offsetDate: 0,
          offsetId: 0,
          offsetTopic: 0,
          limit: 100,
        })
      );
      const topics: ITopic[] = [];
      if ('topics' in result) {
        for (const t of result.topics) {
          if (t instanceof Api.ForumTopic) {
            const idStr = t.id.toString();
            const title = t.title || '';
            const isGeneral = idStr === '1' || /^(general|общее)$/i.test(title.trim());
            if (isGeneral) continue; // hide General topic
            topics.push({
              id: idStr,
              channelId,
              title,
              name: title,
              iconColor: undefined,
              iconEmojiId: undefined,
              isGeneral,
              isClosed: false,
              isHidden: false,
              totalMessages: 0,
              createdAt: new Date('date' in t ? t.date * 1000 : Date.now()),
              updatedAt: new Date(),
            });
          }
        }
      }
      this.logger.info(`Found ${topics.length} topics in channel ${channelId}`);
      return topics;
    });
  }

  /** Create new forum topic */
  async createTopic(channelId: string, name: string): Promise<ITopic> {
    this.ensureInitialized();
    const client = this.getClient();
    return this.executeWithRetry('createTopic', async () => {
      this.logger.info(`Creating topic "${name}" in channel ${channelId}...`);
      const channel = await this.getChannelById(channelId);
      if (!channel) throw new Error(`Channel ${channelId} not found`);

      await client.invoke(
        new Api.channels.CreateForumTopic({
          channel: new Api.InputChannel({
            channelId: this.toBigInt(channelId),
            accessHash: this.toBigInt(channel.accessHash ? channel.accessHash : '0'),
          }),
          title: name,
          randomId: this.toBigInt(Date.now() + Math.floor(Math.random() * 1000)),
        })
      );
      const topics = await this.getTopics(channelId);
      const created = topics.find(t => (t.title || t.name) === name);
      if (!created) throw new Error(`Failed to create topic "${name}"`);
      return created;
    });
  }

  private getClient(): TelegramClient {
    if (!this.client) {
      throw new Error('Telegram client not initialized');
    }
    return this.client;
  }

  /** Upload a file into a topic */
  async uploadFile(file: IFileInfo, topicId: string, channelId: string): Promise<void> {
    this.ensureInitialized();
    const client = this.getClient();
    // Resolve channel once (avoid repeated GetDialogs flood)
    const channel = await this.getChannelById(channelId);
    if (!channel) throw new Error(`Channel ${channelId} not found`);
    return this.executeWithRetry('uploadFile', async () => {
      this.logger.info(`Uploading file ${file.name} to topic ${topicId}...`);
      // Use high-level sendFile API (GramJS handles chunking)
      try {
        const entity = new Api.InputChannel({
          channelId: this.toBigInt(channelId),
          accessHash: this.toBigInt(channel.accessHash ? channel.accessHash : '0'),
        });
        // sendFile signature: client.sendFile(entity, { file, caption, replyTo, forceDocument, mimeType, attributes })
        const sendFn = (
          client as unknown as {
            sendFile: (
              entity: unknown,
              options: {
                file: string;
                caption?: string;
                replyTo?: number;
                forceDocument?: boolean;
                mimeType?: string;
                attributes?: unknown[];
              }
            ) => Promise<unknown>;
          }
        ).sendFile;
        await sendFn.call(client, entity, {
          file: file.path,
          caption: file.name,
          replyTo: parseInt(topicId, 10),
          // Always send as document to avoid Telegram compressing media
          forceDocument: true,
          // Provide a safe fallback mimeType; Telegram/GramJS may detect by filename
          mimeType: file.mimeType || 'application/octet-stream',
        });
        this.logger.info(`File ${file.name} uploaded successfully`);
      } catch (err) {
        this.logger.error(err as Error, `uploadFile failed for ${file.name}`);
        throw err;
      }
    });
  }

  /** Download files (placeholder implementation) */
  async downloadFiles(
    channelId: string,
    topicId: string,
    targetPath: string,
    _opts?: IDownloadOptions
  ): Promise<IDownloadResult> {
    this.ensureInitialized();
    return this.executeWithRetry('downloadFiles', async () => {
      this.logger.info(`Downloading files from topic ${topicId} to ${targetPath} (stub)...`);
      const result: IDownloadResult = {
        downloadId: `dl_${Date.now()}`,
        totalFiles: 0,
        downloadedFiles: 0,
        failedFiles: [],
        targetPath,
        startedAt: new Date(),
        completedAt: new Date(),
        status: EOperationStatus.COMPLETED,
      };
      return result;
    });
  }

  /** Rename a forum topic */
  async renameTopic(topicId: string, newName: string, channelId: string): Promise<void> {
    this.ensureInitialized();
    const client = this.getClient();
    return this.executeWithRetry('renameTopic', async () => {
      this.logger.info(`Renaming topic ${topicId} to "${newName}"...`);
      const channel = await this.getChannelById(channelId);
      if (!channel) throw new Error(`Channel ${channelId} not found`);
      await client.invoke(
        new Api.channels.EditForumTopic({
          channel: new Api.InputChannel({
            channelId: this.toBigInt(channelId),
            accessHash: this.toBigInt(channel.accessHash ? channel.accessHash : '0'),
          }),
          topicId: parseInt(topicId, 10),
          title: newName,
        })
      );
      this.logger.info(`Topic ${topicId} renamed successfully`);
    });
  }

  /** List files (documents) present in a forum topic */
  async listTopicFiles(channelId: string, topicId: string): Promise<ITopicFileInfo[]> {
    this.ensureInitialized();
    const client = this.getClient();
    return this.executeWithRetry('listTopicFiles', async () => {
      this.logger.info(`Listing files for topic ${topicId} in channel ${channelId}...`);

      const channel = await this.getChannelById(channelId);
      if (!channel) throw new Error(`Channel ${channelId} not found`);

      // Use GetReplies to fetch messages inside the topic
      const result = await client.invoke(
        new Api.messages.GetReplies({
          peer: new Api.InputChannel({
            channelId: this.toBigInt(channelId),
            accessHash: this.toBigInt(channel.accessHash ? channel.accessHash : '0'),
          }),
          msgId: parseInt(topicId, 10),
          offsetId: 0,
          offsetDate: 0,
          addOffset: 0,
          limit: 100,
          maxId: 0,
          minId: 0,
          hash: this.toBigInt(0),
        })
      );

      const files: ITopicFileInfo[] = [];
      if ('messages' in result) {
        for (const m of result.messages) {
          if (
            m instanceof Api.Message &&
            m.media &&
            m.media instanceof Api.MessageMediaDocument &&
            'document' in m.media
          ) {
            const doc = m.media.document as
              | {
                  id?: bigint | number;
                  size?: BigInteger;
                  mimeType?: string;
                  attributes?: unknown[];
                }
              | undefined;
            if (doc) {
              let name: string | undefined;
              if (Array.isArray(doc.attributes)) {
                const fnAttr = doc.attributes.find(
                  (a): a is InstanceType<typeof Api.DocumentAttributeFilename> =>
                    a instanceof Api.DocumentAttributeFilename
                );
                if (fnAttr) name = fnAttr.fileName;
              }
              files.push({
                id: doc.id ? doc.id.toString() : m.id?.toString?.() || '',
                name: name || `file_${doc.id}.bin`,
                size: doc.size ? parseInt(doc.size.toString()) : 0,
                mimeType: doc.mimeType,
                uploadedAt: m.date ? new Date(m.date * 1000) : undefined,
                messageId: m.id,
              });
            }
          }
        }
      }

      this.logger.info(`Found ${files.length} files in topic ${topicId}`);
      return files;
    });
  }

  /** Check active session status */
  async checkSession(): Promise<boolean> {
    if (!this.client) {
      this.logger.debug('checkSession: client not initialized');
      return false;
    }
    if (this.authPhone || this.phoneCodeHash || this.qrAuthPending) {
      this.logger.debug('checkSession: auth flow is pending');
      return false;
    }
    try {
      await this.ensureClientConnected();
      this.logger.debug('checkSession: calling getMe()...');
      await this.getClient().getMe();
      this.logger.info('checkSession: session is active');
      return true;
    } catch (e) {
      this.logger.warn('checkSession: session is invalid or expired', {
        error: (e as Error).message,
      });
      if (this.hasRestoredSession && this.isInvalidStoredSessionError(e)) {
        this.logger.warn('Clearing invalid stored Telegram session');
        await this.storageService.clearTelegramSessions();
        await this.resetToUnauthenticatedClient('stored session invalid');
      }
      return false;
    }
  }

  /** Returns minimal current user info if authenticated */
  async getMeMinimal(): Promise<ITelegramUserMinimal | null> {
    if (!this.client) return null;
    try {
      await this.ensureClientConnected();
      const me = await this.getClient().getMe();
      // me can be an object with properties username, phone, firstName, lastName, id
      // We keep it defensive to avoid direct GramJS type coupling
      const id = (me as unknown as { id?: bigint | number | string })?.id;
      const firstName = (me as unknown as { firstName?: string })?.firstName;
      const lastName = (me as unknown as { lastName?: string })?.lastName;
      const username = (me as unknown as { username?: string })?.username;
      const phone = (me as unknown as { phone?: string })?.phone;
      const displayName =
        [firstName, lastName].filter(Boolean).join(' ') || username || phone || String(id || '');
      return {
        id: id ? id.toString() : '',
        username,
        phone,
        firstName,
        lastName,
        displayName,
      };
    } catch {
      return null;
    }
  }

  /** Downloads single file from topic to specified path */
  async downloadFile(
    channelId: string,
    topicId: string,
    fileId: string,
    targetPath: string,
    fileName: string
  ): Promise<void> {
    this.ensureInitialized();
    return this.executeWithRetry('downloadFile', async () => {
      this.logger.info(`Downloading file ${fileName} (${fileId}) to ${targetPath}...`);

      const channel = await this.getChannelById(channelId);
      if (!channel) throw new Error(`Channel ${channelId} not found`);

      const client = this.getClient();
      const entity = new Api.InputChannel({
        channelId: this.toBigInt(channelId),
        accessHash: this.toBigInt(channel.accessHash || '0'),
      });

      // Find the message with the specific file
      const response = await client.invoke(
        new Api.messages.GetHistory({
          peer: entity,
          offsetId: 0,
          offsetDate: 0,
          addOffset: 0,
          limit: 100,
          maxId: 0,
          minId: 0,
          hash: bigInt(0),
        })
      );

      let targetMessage: Api.Message | null = null;

      if (
        response instanceof Api.messages.MessagesSlice ||
        response instanceof Api.messages.Messages
      ) {
        for (const message of response.messages) {
          if (message instanceof Api.Message && message.media instanceof Api.MessageMediaDocument) {
            const doc = message.media.document;
            if (doc instanceof Api.Document && doc.id.toString() === fileId) {
              // Check if message belongs to the specific topic
              if (message.replyTo instanceof Api.MessageReplyHeader) {
                const replyTopicId = message.replyTo.replyToMsgId?.toString();
                if (replyTopicId !== topicId) continue;
              }
              targetMessage = message;
              break;
            }
          }
        }
      }

      if (!targetMessage) {
        throw new Error(`File ${fileId} not found in topic ${topicId}`);
      }

      // Use client.downloadMedia to download the file
      const fullPath = join(targetPath, fileName);

      // Create directory if it doesn't exist
      const dir = dirname(fullPath);
      await mkdir(dir, { recursive: true }).catch(() => {
        // Directory might already exist, ignore error
      });

      // Download using GramJS downloadMedia
      const downloadFn = (
        client as unknown as {
          downloadMedia: (
            message: Api.Message,
            options?: {
              outputFile?: string;
              progressCallback?: (received: number, total: number) => void;
            }
          ) => Promise<string | Buffer>;
        }
      ).downloadMedia;

      await downloadFn.call(client, targetMessage, {
        outputFile: fullPath,
        progressCallback: (received: number, total: number) => {
          const progress = Math.round((received / total) * 100);
          this.logger.debug(
            `Download progress for ${fileName}: ${progress}% (${received}/${total} bytes)`
          );
        },
      });

      this.logger.info(`Successfully downloaded ${fileName} to ${fullPath}`);
    });
  }

  /**
   * Проверка инициализации сервиса
   */
  private ensureInitialized(): void {
    if (!this.client || !this.isInitialized) {
      throw new Error('TelegramService is not initialized. Call initialize() first.');
    }
  }

  private async ensureClientConnected(): Promise<void> {
    this.ensureInitialized();
    const client = this.getClient();
    await client.connect();
  }

  private async tryRestoreSessionOnStartup(): Promise<void> {
    try {
      this.logger.info('Attempting to restore Telegram session from storage...');
      await this.ensureClientConnected();
      const me = await this.getClient().getMe();
      const id = (me as unknown as { id?: bigint | number | string })?.id;
      this.logger.info('Telegram session restored successfully', {
        userId: id ? id.toString() : undefined,
      });
    } catch (error) {
      this.logger.warn('Stored Telegram session could not be restored', {
        error: (error as Error).message,
      });
      if (this.isInvalidStoredSessionError(error)) {
        this.logger.warn('Clearing invalid stored Telegram session after restore failure');
        await this.storageService.clearTelegramSessions();
        await this.resetToUnauthenticatedClient('stored session restore failed');
      }
    }
  }

  /** Find channel by id (in-memory helper) */
  private async getChannelById(channelId: string): Promise<ITelegramChannel | null> {
    if (this.channelCache) return this.channelCache.find(c => c.id === channelId) || null;
    const channels = await this.getChannels();
    return channels.find(c => c.id === channelId) || null;
  }

  /** Graceful client shutdown */
  async destroy(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
      this.client = null;
      this.isInitialized = false;
      this.authPhone = undefined;
      this.phoneCodeHash = undefined;
      this.authDelivery = undefined;
      this.clearQrAuthState();
      this.logger.info('Telegram client disconnected');
    }
  }

  /** Helper for uploading a local file (currently thin wrapper) */
  private async uploadLocalFile(filePath: string): Promise<Api.TypeInputFile> {
    const client = this.getClient();
    type UploadFn = (params: {
      file: string | { file: string };
      workers?: number;
    }) => Promise<Api.TypeInputFile>;
    const fn: UploadFn = (client as unknown as { uploadFile: UploadFn }).uploadFile.bind(client);
    // gramJS accepts plain path string
    return fn({ file: filePath, workers: 1 });
  }

  private toBigInt(value: string | number | bigint): BigInteger {
    return bigInt(value.toString());
  }

  private async executeWithRetry<T>(name: string, op: () => Promise<T>): Promise<T> {
    return this.retryManager.execute(
      async () => {
        await this.ensureClientConnected();
        return op();
      },
      (attempt, error) => {
        this.logger.warn(`Retry ${name} attempt=${attempt} error=${(error as Error).message}`);
      }
    );
  }
}
