/**
 * Telegram domain interfaces
 */

import type { IDownloadOptions, IDownloadResult, IFileInfo } from '../file-sync/index.js';

import type { IChannelStatus, ITelegramChannel, ITopic } from './models.js';

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
   * Authenticates with phone number
   */
  authenticate(phoneNumber?: string): Promise<{ needsPassword: boolean; needsCode: boolean }>;

  /**
   * Confirms authentication with SMS code
   */
  confirmAuth(code: string): Promise<boolean>;

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
  uploadFile(file: IFileInfo, topicId: string, channelId: string): Promise<void>;

  /**
   * Lists files (documents) inside a forum topic
   */
  listTopicFiles(
    channelId: string,
    topicId: string
  ): Promise<Array<{ id: string; name?: string; size?: number; mimeType?: string }>>;

  /**
   * Downloads files from topic
   */
  downloadFiles(
    channelId: string,
    topicId: string,
    targetPath: string,
    opts?: IDownloadOptions
  ): Promise<IDownloadResult>;

  /**
   * Renames topic
   */
  renameTopic(topicId: string, newName: string, channelId: string): Promise<void>;

  /**
   * Checks session status
   */
  checkSession(): Promise<boolean>;

  /**
   * Disconnects from Telegram
   */
  destroy(): Promise<void>;

  // Legacy methods for backward compatibility
  initSession?(): Promise<void>;
  uploadFileForTopic?(topicId: string, file: IFileInfo): Promise<void>;
  downloadFile?(messageId: string, outputPath: string): Promise<void>;
  downloadTopicFiles?(
    topicId: string,
    targetPath: string,
    opts?: IDownloadOptions
  ): Promise<IDownloadResult>;
  getChannelStatus?(channelId: string): Promise<IChannelStatus>;
  disconnect?(): Promise<void>;
}
