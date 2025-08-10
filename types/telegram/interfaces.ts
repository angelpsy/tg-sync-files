/**
 * Telegram domain interfaces
 */

import type { IDownloadOptions, IDownloadResult, IFileInfo } from '../file-sync/index.js';

import type { IChannelStatus, ITelegramChannel, ITelegramSession, ITopic } from './models.js';

/**
 * Telegram Service Interface
 * Manages Telegram MTProto connections and operations
 */
export interface ITelegramService {
  /**
   * Initializes Telegram client
   */
  initialize(): Promise<void>;

  /**
   * Initializes Telegram session
   */
  initSession(): Promise<void>;

  /**
   * Authenticates with phone number
   */
  authenticate(phoneNumber: string): Promise<{ needsCode: boolean }>;

  /**
   * Confirms authentication with SMS code
   */
  confirmAuth(code: string): Promise<ITelegramSession>;

  /**
   * Gets available channels
   */
  getChannels(): Promise<ITelegramChannel[]>;

  /**
   * Gets topics for a channel
   */
  getTopics(channelId: string): Promise<ITopic[]>;

  /**
   * Creates new topic in channel
   */
  createTopic(channelId: string, name: string): Promise<ITopic>;

  /**
   * Uploads file to topic
   */
  uploadFile(filePath: string, topicId: string): Promise<{ messageId: string }>;

  /**
   * Uploads file for topic (legacy method)
   */
  uploadFileForTopic(topicId: string, file: IFileInfo): Promise<void>;

  /**
   * Downloads file from message
   */
  downloadFile(messageId: string, outputPath: string): Promise<void>;

  /**
   * Downloads files from topic
   */
  downloadTopicFiles(
    topicId: string,
    targetPath: string,
    opts?: IDownloadOptions
  ): Promise<IDownloadResult>;

  /**
   * Renames topic
   */
  renameTopic(topicId: string, newName: string): Promise<void>;

  /**
   * Gets channel connection status
   */
  getChannelStatus(channelId: string): Promise<IChannelStatus>;

  /**
   * Disconnects from Telegram
   */
  disconnect(): Promise<void>;
}
