import type {
  Channel,
  PrismaClient,
  FolderTopicLink as PrismaFolderTopicLink,
  TelegramSession as PrismaTelegramSession,
  UploadSession as PrismaUploadSession,
} from '@prisma/client';

import { serviceLoggers } from '../../../../shared/logger.js';

import type { IStorageService } from '@/types/common';
import type { IFolderTopicLink, IUploadSession } from '@/types/file-sync';
import { mapUploadStatusFromPrisma, mapUploadStatusToPrisma } from '@/types/file-sync';
import type { ITelegramChannel, ITelegramSession } from '@/types/telegram';

/**
 * Storage Service
 * Manages data in PostgreSQL via Prisma ORM
 */
export class StorageService implements IStorageService {
  private readonly logger = serviceLoggers.storage;

  constructor(private readonly prisma: PrismaClient) {
    this.logger.info('StorageService initialized');
  }

  /**
   * Gets list of channels
   */
  async getChannels(): Promise<ITelegramChannel[]> {
    this.logger.debug('Fetching channels from database');

    try {
      const channels = await this.prisma.channel.findMany({
        orderBy: { createdAt: 'desc' },
      });

      return channels.map(this.mapChannelFromDb);
    } catch (error) {
      this.logger.error('Error fetching channels', { error });
      throw error;
    }
  }

  /**
   * Saves channel
   */
  async saveChannel(channel: ITelegramChannel): Promise<void> {
    this.logger.debug('Saving channel to database', { channelId: channel.id });

    try {
      await this.prisma.channel.upsert({
        where: { id: channel.id },
        update: {
          name: channel.name,
          isActive: channel.isActive,
          updatedAt: new Date(),
        },
        create: {
          id: channel.id,
          name: channel.name,
          isActive: channel.isActive,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      this.logger.debug('Channel saved successfully', { channelId: channel.id });
    } catch (error) {
      this.logger.error('Error saving channel', { channelId: channel.id, error });
      throw error;
    }
  }

  /**
   * Gets folder-topic links
   */
  async getFolderTopicLinks(): Promise<IFolderTopicLink[]> {
    this.logger.debug('Fetching folder-topic links from database');

    try {
      const links = await this.prisma.folderTopicLink.findMany({
        orderBy: { createdAt: 'desc' },
      });

      return links.map(this.mapFolderTopicLinkFromDb);
    } catch (error) {
      this.logger.error('Error fetching folder-topic links', { error });
      throw error;
    }
  }

  /**
   * Saves folder-topic link
   */
  async saveFolderTopicLink(link: IFolderTopicLink): Promise<void> {
    this.logger.debug('Saving folder-topic link to database', {
      linkId: link.id,
      folderPath: link.folderPath,
      topicId: link.topicId,
    });

    try {
      await this.prisma.folderTopicLink.upsert({
        where: { id: link.id },
        update: {
          folderPath: link.folderPath,
          topicId: link.topicId,
          isActive: link.isActive,
          updatedAt: new Date(),
        },
        create: {
          id: link.id,
          folderPath: link.folderPath,
          topicId: link.topicId,
          isActive: link.isActive,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      this.logger.debug('Folder-topic link saved successfully', { linkId: link.id });
    } catch (error) {
      this.logger.error('Error saving folder-topic link', {
        linkId: link.id,
        error,
      });
      throw error;
    }
  }

  /**
   * Gets upload sessions
   */
  async getUploadSessions(): Promise<IUploadSession[]> {
    this.logger.debug('Fetching upload sessions from database');

    try {
      const sessions = await this.prisma.uploadSession.findMany({
        orderBy: { createdAt: 'desc' },
      });

      return sessions.map(this.mapUploadSessionFromDb);
    } catch (error) {
      this.logger.error('Error fetching upload sessions', { error });
      throw error;
    }
  }

  /**
   * Saves upload session
   */
  async saveUploadSession(session: IUploadSession): Promise<void> {
    this.logger.debug('Saving upload session to database', {
      sessionId: session.id,
      status: session.status,
    });

    try {
      await this.prisma.uploadSession.upsert({
        where: { id: session.id },
        update: {
          folderPath: session.folderPath,
          topicId: session.topicId,
          status: mapUploadStatusToPrisma(session.status),
          totalFiles: session.totalFiles,
          uploadedFiles: session.uploadedFiles,
          currentFile: session.currentFile,
          progress: session.progress,
          error: session.error,
          updatedAt: new Date(),
          completedAt: session.completedAt,
        },
        create: {
          id: session.id,
          folderPath: session.folderPath,
          topicId: session.topicId,
          status: mapUploadStatusToPrisma(session.status),
          totalFiles: session.totalFiles,
          uploadedFiles: session.uploadedFiles,
          currentFile: session.currentFile,
          progress: session.progress,
          error: session.error,
          startedAt: session.startedAt,
          createdAt: new Date(),
          updatedAt: new Date(),
          completedAt: session.completedAt,
        },
      });

      this.logger.debug('Upload session saved successfully', { sessionId: session.id });
    } catch (error) {
      this.logger.error('Error saving upload session', {
        sessionId: session.id,
        error,
      });
      throw error;
    }
  }

  /**
   * Gets Telegram session
   */
  async getTelegramSession(): Promise<ITelegramSession | null> {
    this.logger.debug('Fetching Telegram session from database');

    try {
      const session = await this.prisma.telegramSession.findFirst({
        where: { isActive: true },
        orderBy: { updatedAt: 'desc' },
      });

      if (!session) {
        this.logger.debug('No active Telegram session found');
        return null;
      }

      return this.mapTelegramSessionFromDb(session);
    } catch (error) {
      this.logger.error('Error fetching Telegram session', { error });
      throw error;
    }
  }

  /**
   * Saves Telegram session
   */
  async saveTelegramSession(session: ITelegramSession): Promise<void> {
    this.logger.debug('Saving Telegram session to database', {
      sessionId: session.id,
      phoneNumber: session.phoneNumber,
    });

    try {
      // Deactivate all previous sessions
      await this.prisma.telegramSession.updateMany({
        where: { isActive: true },
        data: { isActive: false, updatedAt: new Date() },
      });

      // Save new session
      await this.prisma.telegramSession.upsert({
        where: { id: session.id },
        update: {
          stringSession: session.stringSession,
          phoneNumber: session.phoneNumber,
          isActive: session.isActive,
          updatedAt: new Date(),
        },
        create: {
          id: session.id,
          stringSession: session.stringSession,
          phoneNumber: session.phoneNumber,
          isActive: session.isActive,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      this.logger.debug('Telegram session saved successfully', { sessionId: session.id });
    } catch (error) {
      this.logger.error('Error saving Telegram session', {
        sessionId: session.id,
        error,
      });
      throw error;
    }
  }

  /**
   * Maps channel from DB to domain model
   */
  private mapChannelFromDb(dbChannel: Channel): ITelegramChannel {
    return {
      id: dbChannel.id,
      name: dbChannel.name,
      isActive: dbChannel.isActive,
    };
  }

  /**
   * Maps folder-topic link from DB to domain model
   */
  private mapFolderTopicLinkFromDb(dbLink: PrismaFolderTopicLink): IFolderTopicLink {
    return {
      id: dbLink.id,
      folderPath: dbLink.folderPath,
      topicId: dbLink.topicId,
      isActive: dbLink.isActive,
      createdAt: dbLink.createdAt,
      updatedAt: dbLink.updatedAt,
    };
  }

  /**
   * Maps upload session from DB to domain model
   */
  private mapUploadSessionFromDb(dbSession: PrismaUploadSession): IUploadSession {
    return {
      id: dbSession.id,
      folderPath: dbSession.folderPath,
      topicId: dbSession.topicId,
      status: mapUploadStatusFromPrisma(dbSession.status),
      totalFiles: dbSession.totalFiles,
      uploadedFiles: dbSession.uploadedFiles,
      currentFile: dbSession.currentFile ?? undefined,
      progress: dbSession.progress,
      startedAt: dbSession.startedAt,
      updatedAt: dbSession.updatedAt,
      completedAt: dbSession.completedAt ?? undefined,
      error: dbSession.error ?? undefined,
    };
  }

  /**
   * Maps Telegram session from DB to domain model
   */
  private mapTelegramSessionFromDb(dbSession: PrismaTelegramSession): ITelegramSession {
    return {
      id: dbSession.id,
      stringSession: dbSession.stringSession,
      phoneNumber: dbSession.phoneNumber,
      isActive: dbSession.isActive,
      createdAt: dbSession.createdAt,
      updatedAt: dbSession.updatedAt,
    };
  }
}
