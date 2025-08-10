import bigInt, { type BigInteger } from 'big-integer';
import * as input from 'input';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { Api } from 'telegram/tl';

import createLogger from '../../../../shared/logger';
import type {
  IDownloadOptions,
  IDownloadResult,
  IFileInfo,
  IStorageService,
  ITelegramChannel,
  ITelegramService,
  ITelegramSession,
  ITopic,
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
  private logger = createLogger.child({ module: 'TelegramService' });
  private retryManager: RetryManager;
  private channelCache: ITelegramChannel[] | null = null;

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

  /** Fetch channels that support forums */
  async getChannels(): Promise<ITelegramChannel[]> {
    this.ensureInitialized();
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
            topics.push({
              id: t.id.toString(),
              channelId,
              title: t.title,
              name: t.title,
              iconColor: undefined,
              iconEmojiId: undefined,
              isGeneral: false,
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
        // sendFile signature: client.sendFile(entity, { file, caption, replyTo })
        const sendFn = (
          client as unknown as {
            sendFile: (
              entity: unknown,
              options: { file: string; caption?: string; replyTo?: number }
            ) => Promise<unknown>;
          }
        ).sendFile;
        await sendFn.call(client, entity, {
          file: file.path,
          caption: file.name,
          replyTo: parseInt(topicId, 10),
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
  async listTopicFiles(
    channelId: string,
    topicId: string
  ): Promise<Array<{ id: string; name?: string; size?: number; mimeType?: string }>> {
    this.ensureInitialized();
    const client = this.getClient();
    return this.executeWithRetry('listTopicFiles', async () => {
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
      const files: Array<{ id: string; name?: string; size?: number; mimeType?: string }> = [];
      if ('messages' in result) {
        for (const m of result.messages) {
          if (
            m instanceof Api.Message &&
            m.media &&
            m.media instanceof Api.MessageMediaDocument &&
            'document' in m.media
          ) {
            const doc = m.media.document as
              | { id?: bigint | number; size?: number; mimeType?: string; attributes?: unknown[] }
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
                name,
                size: doc.size,
                mimeType: doc.mimeType,
              });
            }
          }
        }
      }
      return files;
    });
  }

  /** Check active session status */
  async checkSession(): Promise<boolean> {
    if (!this.client) return false;
    try {
      await this.getClient().getMe();
      return true;
    } catch {
      return false;
    }
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
