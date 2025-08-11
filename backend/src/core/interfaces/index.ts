/**
 * Internal backend interfaces
 * Backend interfaces for Clean Architecture implementation
 */

import type {
  IFSService,
  ISchedulerService,
  ISocketService,
  IStorageService,
  ITelegramService,
  IUploadOrchestrator,
} from '@/types';

/**
 * Service Registry Interface
 * Registry for managing all service dependencies
 */
export interface IServiceRegistry {
  fsService: IFSService;
  uploadOrchestrator: IUploadOrchestrator;
  telegramService: ITelegramService;
  storageService: IStorageService;
  socketService: ISocketService;
  schedulerService: ISchedulerService;
}

/**
 * Backend Services Interface
 * Main interface for exporting services to frontend
 */
export interface IBackendServices extends IServiceRegistry {
  /**
   * Initializes all services
   */
  initialize(): Promise<void>;

  /**
   * Graceful shutdown of all services
   */
  shutdown(): Promise<void>;

  /**
   * Health check for all services
   */
  healthCheck(): Promise<Record<string, boolean>>;
}

/**
 * Event Emitter Interface
 * Interface for internal event system
 */
export interface IEventEmitter {
  /**
   * Subscribe to event
   */
  on<T>(event: string, handler: (data: T) => void): void;

  /**
   * Unsubscribe from event
   */
  off<T>(event: string, handler: (data: T) => void): void;

  /**
   * Emit event
   */
  emit<T>(event: string, data: T): void;

  /**
   * One-time subscription to event
   */
  once<T>(event: string, handler: (data: T) => void): void;
}

/**
 * Retry Manager Interface
 * Interface for managing retry operations
 */
export interface IRetryManager {
  /**
   * Executes operation with retry logic
   */
  execute<T>(
    operation: () => Promise<T>,
    onRetry?: (attempt: number, error: Error) => void
  ): Promise<T>;

  /**
   * Pauses retry operations
   */
  pause(): void;

  /**
   * Resumes retry operations
   */
  resume(): void;

  /**
   * Stops retry operations
   */
  stop(): void;
}

/**
 * Logger Interface
 * Interface for logging functionality
 */
export interface ILogger {
  debug(message: string, meta?: object): void;
  info(message: string, meta?: object): void;
  warn(message: string, meta?: object): void;
  error(message: string, meta?: object): void;
  child(meta: object): ILogger;
}
