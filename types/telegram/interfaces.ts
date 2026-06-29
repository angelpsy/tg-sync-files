/**
 * Telegram domain interfaces
 */

import type {
  IDownloadOptions,
  IDownloadResult,
  IFileInfo,
  ITopicFileInfo,
} from '../file-sync/index.js';

import type { IChannelStatus, ITelegramChannel, ITopic } from './models.js';

export type TTelegramAuthCodeDeliveryType =
  | 'app'
  | 'sms'
  | 'call'
  | 'flash_call'
  | 'missed_call'
  | 'email'
  | 'email_setup'
  | 'fragment_sms'
  | 'firebase_sms'
  | 'sms_word'
  | 'sms_phrase'
  | 'unknown';

export interface ITelegramAuthCodeDelivery {
  type: TTelegramAuthCodeDeliveryType;
  label: string;
  rawType?: string;
  nextType?: TTelegramAuthCodeDeliveryType;
  nextLabel?: string;
  rawNextType?: string;
  timeoutSec?: number;
  length?: number;
  pattern?: string;
  resendUnavailable?: boolean;
  resendUnavailableReason?: string;
}

export interface ITelegramStartAuthResult {
  needsCode: true;
  maskedPhone?: string;
  delivery?: ITelegramAuthCodeDelivery;
}

export interface ITelegramQrAuthToken {
  url: string;
  expiresAt: string;
  expiresInSec?: number;
}

export interface ITelegramQrAuthStartResult {
  qr: ITelegramQrAuthToken;
}

export type ITelegramQrAuthWaitResult =
  { success: true; maskedPhone?: string } | { needsPassword: true; maskedPhone?: string };

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
   * Starts stepwise authentication by sending a code to the phone.
   * Returns when code is sent and next step is required.
   */
  startAuth?(phoneNumber: string): Promise<ITelegramStartAuthResult>;

  /**
   * Requests Telegram to resend the current auth code, usually switching from app code to SMS/call
   * when Telegram allows another delivery method.
   */
  resendAuthCode?(): Promise<ITelegramStartAuthResult>;

  /**
   * Starts QR login by exporting a short-lived Telegram login token.
   */
  startQrAuth?(): Promise<ITelegramQrAuthStartResult>;

  /**
   * Waits for a QR login scan to complete.
   */
  waitForQrAuth?(): Promise<ITelegramQrAuthWaitResult>;

  /**
   * Cancels a pending QR login flow.
   */
  cancelQrAuth?(): Promise<void>;

  /**
   * Submits the received code. If 2FA password is required, returns that requirement.
   */
  submitCode?(
    code: string
  ): Promise<
    { success: true; maskedPhone?: string } | { needsPassword: true; maskedPhone?: string }
  >;

  /**
   * Submits the 2FA password to complete login.
   */
  submitPassword?(password: string): Promise<{ success: true; maskedPhone?: string }>;

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
   * Returns detailed file information for UI selection
   */
  listTopicFiles(channelId: string, topicId: string): Promise<ITopicFileInfo[]>;

  /**
   * Downloads single file from topic to specified path
   */
  downloadFile(
    channelId: string,
    topicId: string,
    fileId: string,
    targetPath: string,
    fileName: string
  ): Promise<void>;

  /**
   * Downloads files from topic (batch operation)
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
  downloadTopicFiles?(
    topicId: string,
    targetPath: string,
    opts?: IDownloadOptions
  ): Promise<IDownloadResult>;
  getChannelStatus?(channelId: string): Promise<IChannelStatus>;
  disconnect?(): Promise<void>;
}
