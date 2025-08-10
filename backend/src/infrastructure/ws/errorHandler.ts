import type { Socket } from 'socket.io';

import { serviceLoggers } from '../../../../shared/logger';

/**
 * Типы ошибок WebSocket
 */
export enum SocketErrorType {
  CONNECTION = 'connection',
  AUTHENTICATION = 'authentication',
  VALIDATION = 'validation',
  OPERATION = 'operation',
  INTERNAL = 'internal',
}

/**
 * Структура ошибки для клиента
 */
export interface SocketError {
  type: SocketErrorType;
  code: string;
  message: string;
  details?: unknown;
  timestamp: string;
}

/**
 * Обработчик ошибок для WebSocket соединений
 */
export class SocketErrorHandler {
  private readonly logger = serviceLoggers.socket;

  /**
   * Обрабатывает ошибку и отправляет её клиенту
   */
  handleError(socket: Socket, error: Error | SocketError, context?: string): void {
    const socketError = this.normalizeError(error);

    // Логируем ошибку
    this.logger.error('Socket error occurred', {
      socketId: socket.id,
      context,
      error: socketError,
      userAgent: socket.handshake.headers['user-agent'],
      ip: socket.handshake.address,
    });

    // Отправляем ошибку клиенту
    socket.emit('error', socketError);

    // В зависимости от типа ошибки может потребоваться отключение
    if (this.shouldDisconnect(socketError)) {
      this.logger.warn('Disconnecting socket due to error', {
        socketId: socket.id,
        errorType: socketError.type,
      });
      socket.disconnect(true);
    }
  }

  /**
   * Создает обработчик ошибок для конкретного сокета
   */
  createSocketHandler(socket: Socket) {
    return {
      /**
       * Обрабатывает ошибку операции
       */
      handleOperationError: (error: Error, operation: string) => {
        this.handleError(socket, error, `operation:${operation}`);
      },

      /**
       * Обрабатывает ошибку валидации
       */
      handleValidationError: (message: string, details?: unknown) => {
        const error: SocketError = {
          type: SocketErrorType.VALIDATION,
          code: 'VALIDATION_ERROR',
          message,
          details,
          timestamp: new Date().toISOString(),
        };
        this.handleError(socket, error, 'validation');
      },

      /**
       * Обрабатывает ошибку аутентификации
       */
      handleAuthError: (message: string) => {
        const error: SocketError = {
          type: SocketErrorType.AUTHENTICATION,
          code: 'AUTH_ERROR',
          message,
          timestamp: new Date().toISOString(),
        };
        this.handleError(socket, error, 'authentication');
      },

      /**
       * Обрабатывает внутренние ошибки
       */
      handleInternalError: (error: Error, operation: string) => {
        const socketError: SocketError = {
          type: SocketErrorType.INTERNAL,
          code: 'INTERNAL_ERROR',
          message: 'Internal server error occurred',
          timestamp: new Date().toISOString(),
        };

        // Логируем полную ошибку, но клиенту отправляем безопасную версию
        this.logger.error('Internal socket error', {
          socketId: socket.id,
          operation,
          originalError: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
        });

        socket.emit('error', socketError);
      },
    };
  }

  /**
   * Приводит ошибку к стандартному формату
   */
  private normalizeError(error: Error | SocketError): SocketError {
    if (this.isSocketError(error)) {
      return error;
    }

    // Преобразуем обычную ошибку в SocketError
    return {
      type: SocketErrorType.OPERATION,
      code: error.name || 'UNKNOWN_ERROR',
      message: error.message || 'Unknown error occurred',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Проверяет, является ли объект SocketError
   */
  private isSocketError(error: unknown): error is SocketError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'type' in error &&
      'code' in error &&
      'message' in error &&
      'timestamp' in error
    );
  }

  /**
   * Определяет, нужно ли отключать сокет после ошибки
   */
  private shouldDisconnect(error: SocketError): boolean {
    return (
      error.type === SocketErrorType.AUTHENTICATION ||
      (error.type === SocketErrorType.INTERNAL && error.code === 'CRITICAL_ERROR')
    );
  }
}

/**
 * Глобальный экземпляр обработчика ошибок
 */
export const socketErrorHandler = new SocketErrorHandler();

/**
 * Middleware для обработки ошибок в Socket.IO обработчиках
 */
export function withErrorHandling<T extends unknown[]>(
  socket: Socket,
  handler: (...args: T) => Promise<void> | void,
  operation: string
) {
  const errorHandler = socketErrorHandler.createSocketHandler(socket);

  return async (...args: T) => {
    try {
      await handler(...args);
    } catch (error) {
      if (error instanceof Error) {
        errorHandler.handleOperationError(error, operation);
      } else {
        errorHandler.handleInternalError(new Error(`Unknown error: ${String(error)}`), operation);
      }
    }
  };
}
