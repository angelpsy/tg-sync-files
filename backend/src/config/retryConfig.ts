/**
 * Retry configuration with exponential backoff
 */
export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  exponentialFactor: number;
  jitter: boolean;
}

/**
 * Retry operation state
 */
export interface RetryState {
  attempt: number;
  isPaused: boolean;
  isStopped: boolean;
  lastError?: Error;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  exponentialFactor: 2,
  jitter: true,
};

/**
 * Retry settings for different operations
 */
export const RETRY_CONFIGS = {
  telegram: {
    ...DEFAULT_RETRY_CONFIG,
    maxAttempts: 5,
    baseDelay: 2000,
    maxDelay: 60000,
  },
  fileUpload: {
    ...DEFAULT_RETRY_CONFIG,
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 15000,
  },
  database: {
    ...DEFAULT_RETRY_CONFIG,
    maxAttempts: 3,
    baseDelay: 500,
    maxDelay: 5000,
  },
} as const;

/**
 * Calculates delay for next retry attempt
 */
export function calculateDelay(attempt: number, config: RetryConfig): number {
  const delay = Math.min(
    config.baseDelay * Math.pow(config.exponentialFactor, attempt - 1),
    config.maxDelay
  );

  if (config.jitter) {
    // Add random deviation ±25%
    const jitterRange = delay * 0.25;
    const jitter = (Math.random() - 0.5) * 2 * jitterRange;
    return Math.max(0, delay + jitter);
  }

  return delay;
}

/**
 * Utility for retry operations with pause/stop support
 */
export class RetryManager {
  private state: RetryState = {
    attempt: 0,
    isPaused: false,
    isStopped: false,
  };

  constructor(private config: RetryConfig = DEFAULT_RETRY_CONFIG) {}

  /**
   * Executes operation with retry logic
   */
  async execute<T>(
    operation: () => Promise<T>,
    onRetry?: (attempt: number, error: Error) => void
  ): Promise<T> {
    this.state = { attempt: 0, isPaused: false, isStopped: false };

    while (this.state.attempt < this.config.maxAttempts) {
      if (this.state.isStopped) {
        throw new Error('Operation was stopped');
      }

      this.state.attempt++;

      try {
        return await operation();
      } catch (error) {
        this.state.lastError = error as Error;

        if (this.state.attempt >= this.config.maxAttempts) {
          throw error;
        }

        onRetry?.(this.state.attempt, error as Error);

        // Wait before next attempt
        await this.waitWithPauseSupport();
      }
    }

    throw this.state.lastError || new Error('Max retry attempts exceeded');
  }

  /**
   * Pauses retry operations
   */
  pause(): void {
    this.state.isPaused = true;
  }

  /**
   * Resumes retry operations
   */
  resume(): void {
    this.state.isPaused = false;
  }

  /**
   * Stops retry operations
   */
  stop(): void {
    this.state.isStopped = true;
  }

  /**
   * Returns current state
   */
  getState(): Readonly<RetryState> {
    return { ...this.state };
  }

  /**
   * Waits with pause support
   */
  private async waitWithPauseSupport(): Promise<void> {
    const delay = calculateDelay(this.state.attempt, this.config);
    const startTime = Date.now();

    while (Date.now() - startTime < delay) {
      if (this.state.isStopped) {
        return;
      }

      if (this.state.isPaused) {
        // Wait 100ms and check again
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }

      // Wait remaining time or 100ms, whichever is less
      const remainingTime = delay - (Date.now() - startTime);
      const waitTime = Math.min(remainingTime, 100);

      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
}
