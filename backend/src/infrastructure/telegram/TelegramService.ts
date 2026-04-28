import { mkdir } from 'fs/promises';
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
  ITelegramChannel,
  ITelegramService,
  ITelegramSession,
  ITelegramUserMinimal,
  ITopic,
  ITopicFileInfo,
} from '../../../../types';
import type { RetryConfig } from '../../config/retryConfig';
import { RETRY_CONFIGS, RetryManager } from '../../config/retryConfig';

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
  // Stepwise auth state
  private authPhone?: string;
  private phoneCodeHash?: string;

  constructor(
    private storageService: IStorageService,
    private apiId: number,
    private apiHash: string,
    private retryConfig: RetryConfig = RETRY_CONFIGS.telegram
  ) {
    this.retryManager = new RetryManager(this.retryConfig);
  }

  /** Initializes client restoring existing session if present */
  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Telegram client...');
      const savedSession = await this.storageService.getTelegramSession();
      const stringSession = savedSession?.sessionData || savedSession?.stringSession || '';

      this.client = new TelegramClient(new StringSession(stringSession), this.apiId, this.apiHash, {
        connectionRetries: this.retryConfig.maxAttempts,
      });

      this.isInitialized = true;
      this.logger.info('Telegram client initialized successfully');
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
  async startAuth(phoneNumber: string): Promise<{ needsCode: true; maskedPhone?: string }> {
    if (!this.client || !this.isInitialized) {
      await this.initialize();
    }
    const client = this.getClient();
    await client.connect();
    try {
      this.logger.info('Sending auth code requested', { phoneNumber });
      const res = await client.invoke(
        new Api.auth.SendCode({
          phoneNumber,
          apiId: this.apiId,
          apiHash: this.apiHash,
          settings: new Api.CodeSettings({}),
        })
      );
      this.logger.info('auth.SendCode response received');
      // res.phoneCodeHash contains hash for next step
      // Store state
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyRes: any = res as any;
      this.authPhone = phoneNumber;
      this.phoneCodeHash = anyRes.phoneCodeHash as string | undefined;
      this.logger.debug('Stored auth context', {
        authPhone: this.authPhone,
        hasHash: !!this.phoneCodeHash,
      });
      return {
        needsCode: true,
        maskedPhone: phoneNumber.replace(/(\+?\d{0,2})\d{3}(\d{2,})/, '$1***$2'),
      };
    } catch (error) {
      this.logger.error(error as Error, 'startAuth (sendCode) failed', { phoneNumber });
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
      this.authPhone = undefined;
      this.phoneCodeHash = undefined;
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
        status: 'completed' as any, // Temporary bypass since I changed it to enum
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
    try {
      this.logger.debug('checkSession: calling getMe()...');
      await this.getClient().getMe();
      this.logger.info('checkSession: session is active');
      return true;
    } catch (e) {
      this.logger.warn('checkSession: session is invalid or expired', {
        error: (e as Error).message,
      });
      return false;
    }
  }

  /** Returns minimal current user info if authenticated */
  async getMeMinimal(): Promise<ITelegramUserMinimal | null> {
    if (!this.client) return null;
    try {
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
    return this.retryManager.execute(op, (attempt, error) => {
      this.logger.warn(`Retry ${name} attempt=${attempt} error=${(error as Error).message}`);
    });
  }
}
