// Prisma v6 minimal client d.ts (edge/minimal build) doesn't expose model interfaces directly.
// We import the client as default (namespace-like) and use its delegates; for mapping we define
// minimal structural interfaces with only the fields we actually access, avoiding 'any'.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
// Prisma minimal build does not expose model or client types; treat injected prisma as untyped any.
// TODO: Replace with explicit delegate interfaces if/when upgrading to full type emission.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaClient = any;

interface DbChannel {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
interface DbFolderTopicLink {
  id: string;
  folderPath: string;
  topicId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
interface DbUploadSession {
  id: string;
  folderPath: string;
  topicId: string;
  status: string;
  totalFiles: number;
  uploadedFiles: number;
  currentFile: string | null;
  progress: number;
  startedAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  error: string | null;
  realUploadedFiles?: number | null;
  skippedFilesCount?: number | null;
  conflictsSkipped?: number | null;
  conflictsRenamed?: number | null;
  conflictsLogged?: number | null;
}
interface DbTelegramSession {
  id: string;
  stringSession: string;
  phoneNumber: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

import { serviceLoggers } from '../../../../shared/logger';

import type { IStorageService } from '@/types/common';
import type {
  IFileRecord,
  IFolderTopicLink,
  IUploadSession,
  TUploadStatusDB,
} from '@/types/file-sync';
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
          name: channel.name || channel.title,
          isActive: channel.isActive,
          updatedAt: new Date(),
        },
        create: {
          id: channel.id,
          name: channel.name || channel.title,
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
   * Gets file record by topic + file name
   */
  async getFileRecord(topicId: string, fileName: string): Promise<IFileRecord | null> {
    this.logger.debug('Fetching file record', { topicId, fileName });
    try {
      const rec = await this.prisma.fileRecord.findUnique({
        where: { topicId_fileName: { topicId, fileName } },
      });
      if (!rec) return null;
      return this.mapFileRecordFromDb(rec);
    } catch (error) {
      this.logger.error('Error fetching file record', { topicId, fileName, error });
      throw error;
    }
  }

  /**
   * Upserts file record
   */
  async upsertFileRecord(record: IFileRecord): Promise<void> {
    this.logger.debug('Upserting file record', {
      topicId: record.topicId,
      fileName: record.fileName,
    });
    try {
      await this.prisma.fileRecord.upsert({
        where: { topicId_fileName: { topicId: record.topicId, fileName: record.fileName } },
        update: {
          folderPath: record.folderPath,
          size: record.size,
          mtimeMs: BigInt(record.mtimeMs),
          hash: record.hash,
          updatedAt: new Date(),
        },
        create: {
          id: record.id,
          topicId: record.topicId,
          folderPath: record.folderPath,
          fileName: record.fileName,
          size: record.size,
          mtimeMs: BigInt(record.mtimeMs),
          hash: record.hash,
          uploadedAt: record.uploadedAt,
          updatedAt: record.updatedAt,
        },
      });
    } catch (error) {
      this.logger.error('Error upserting file record', {
        topicId: record.topicId,
        fileName: record.fileName,
        error,
      });
      throw error;
    }
  }

  /**
   * Lists file records for a topic
   */
  async getTopicFileRecords(topicId: string): Promise<IFileRecord[]> {
    this.logger.debug('Listing file records for topic', { topicId });
    try {
      const recs = await this.prisma.fileRecord.findMany({
        where: { topicId },
        orderBy: { updatedAt: 'desc' },
      });
      return recs.map(this.mapFileRecordFromDb);
    } catch (error) {
      this.logger.error('Error listing file records', { topicId, error });
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
          realUploadedFiles: session.realUploadedFiles ?? undefined,
          skippedFilesCount: session.skippedFilesCount ?? undefined,
          conflictsSkipped: session.conflictsSkipped ?? undefined,
          conflictsRenamed: session.conflictsRenamed ?? undefined,
          conflictsLogged: session.conflictsLogged ?? undefined,
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
          realUploadedFiles: session.realUploadedFiles ?? 0,
          skippedFilesCount: session.skippedFilesCount ?? 0,
          conflictsSkipped: session.conflictsSkipped ?? 0,
          conflictsRenamed: session.conflictsRenamed ?? 0,
          conflictsLogged: session.conflictsLogged ?? 0,
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
          stringSession: session.stringSession || session.sessionData || '',
          phoneNumber: session.phoneNumber || '',
          isActive: session.isActive,
          updatedAt: new Date(),
        },
        create: {
          id: session.id,
          stringSession: session.stringSession || session.sessionData || '',
          phoneNumber: session.phoneNumber || '',
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

  /** Clears all Telegram sessions (logout) */
  async clearTelegramSessions(): Promise<void> {
    this.logger.debug('Clearing all Telegram sessions');
    try {
      await this.prisma.telegramSession.deleteMany({});
    } catch (error) {
      this.logger.error('Error clearing telegram sessions', { error });
      throw error;
    }
  }

  /**
   * Maps channel from DB to domain model
   */
  private mapChannelFromDb(dbChannel: DbChannel): ITelegramChannel {
    // Prisma Channel model lacks several ITelegramChannel fields; provide defaults
    return {
      id: dbChannel.id,
      title: dbChannel.name,
      name: dbChannel.name,
      isGroup: false,
      isForum: true,
      participantsCount: 0,
      isActive: dbChannel.isActive,
      createdAt: dbChannel.createdAt,
      updatedAt: dbChannel.updatedAt,
    };
  }

  /**
   * Maps folder-topic link from DB to domain model
   */
  private mapFolderTopicLinkFromDb(dbLink: DbFolderTopicLink): IFolderTopicLink {
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
  private mapUploadSessionFromDb(dbSession: DbUploadSession): IUploadSession {
    return {
      id: dbSession.id,
      folderPath: dbSession.folderPath,
      topicId: dbSession.topicId,
      // Prisma returns status as raw uppercase string; cast to our DB enum type
      status: mapUploadStatusFromPrisma(dbSession.status as unknown as TUploadStatusDB),
      totalFiles: dbSession.totalFiles,
      uploadedFiles: dbSession.uploadedFiles,
      currentFile: dbSession.currentFile ?? undefined,
      progress: dbSession.progress,
      startedAt: dbSession.startedAt,
      updatedAt: dbSession.updatedAt,
      completedAt: dbSession.completedAt ?? undefined,
      error: dbSession.error ?? undefined,
      realUploadedFiles: dbSession.realUploadedFiles ?? undefined,
      skippedFilesCount: dbSession.skippedFilesCount ?? undefined,
      conflictsSkipped: dbSession.conflictsSkipped ?? undefined,
      conflictsRenamed: dbSession.conflictsRenamed ?? undefined,
      conflictsLogged: dbSession.conflictsLogged ?? undefined,
    };
  }

  /**
   * Maps Telegram session from DB to domain model
   */
  private mapTelegramSessionFromDb(dbSession: DbTelegramSession): ITelegramSession {
    return {
      id: dbSession.id,
      sessionData: dbSession.stringSession,
      stringSession: dbSession.stringSession,
      phoneNumber: dbSession.phoneNumber,
      isActive: dbSession.isActive,
      lastUsed: dbSession.updatedAt,
      createdAt: dbSession.createdAt,
      updatedAt: dbSession.updatedAt,
    };
  }

  /** Maps FileRecord DB entity to domain */
  private mapFileRecordFromDb(dbRec: {
    id: string;
    topicId: string;
    folderPath: string;
    fileName: string;
    size: number;
    mtimeMs: bigint;
    hash: string | null;
    uploadedAt: Date;
    updatedAt: Date;
  }): IFileRecord {
    return {
      id: dbRec.id,
      topicId: dbRec.topicId,
      folderPath: dbRec.folderPath,
      fileName: dbRec.fileName,
      size: dbRec.size,
      mtimeMs: Number(dbRec.mtimeMs),
      hash: dbRec.hash ?? undefined,
      uploadedAt: dbRec.uploadedAt,
      updatedAt: dbRec.updatedAt,
    };
  }
}
