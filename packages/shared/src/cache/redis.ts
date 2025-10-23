import { createClient, RedisClientType } from 'redis';

import { config } from '../config';
import { logger } from '../utils/logger';

class RedisCache {
  private client: RedisClientType | null = null;

  async connect(): Promise<void> {
    if (this.client) {
      return;
    }

    this.client = createClient({
      url: config.redis.url,
    });

    this.client.on('error', (err) => {
      logger.error('Redis client error', { error: err.message });
    });

    this.client.on('connect', () => {
      logger.info('Redis connection established');
    });

    await this.client.connect();
    logger.info('Redis client initialized');
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      logger.info('Redis client disconnected');
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.client) {
      throw new Error('Redis not connected');
    }
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.client) {
      throw new Error('Redis not connected');
    }
    if (ttlSeconds) {
      await this.client.setEx(key, ttlSeconds, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client) {
      throw new Error('Redis not connected');
    }
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    if (!this.client) {
      throw new Error('Redis not connected');
    }
    const result = await this.client.exists(key);
    return result === 1;
  }

  async incr(key: string): Promise<number> {
    if (!this.client) {
      throw new Error('Redis not connected');
    }
    return this.client.incr(key);
  }

  async expire(key: string, seconds: number): Promise<void> {
    if (!this.client) {
      throw new Error('Redis not connected');
    }
    await this.client.expire(key, seconds);
  }

  async ttl(key: string): Promise<number> {
    if (!this.client) {
      throw new Error('Redis not connected');
    }
    return this.client.ttl(key);
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.client) {
        return false;
      }
      await this.client.ping();
      return true;
    } catch {
      return false;
    }
  }
}

export const redis = new RedisCache();
