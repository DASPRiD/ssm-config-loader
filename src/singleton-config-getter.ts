import type { SSM } from '@aws-sdk/client-ssm';
import type z from 'zod';
import { loadSsmConfig } from './index.js';

export class ConfigError extends Error {
    public wrappedError?: unknown;

    public constructor(message: string, wrappedError?: unknown) {
        if (wrappedError instanceof Error) {
            message += `: ${wrappedError.message}`;
        }

        super(message);
        this.wrappedError = wrappedError;
    }
}

export const createSingletonConfigGetter = <T extends z.ZodType<unknown>>(
    ssm: SSM,
    schema: T,
    prefix?: string,
): (() => Promise<z.infer<T>>) => {
    let configPromise: Promise<z.infer<T>> | undefined;

    return async (): Promise<z.infer<T>> => {
        if (configPromise) {
            return configPromise;
        }

        configPromise = (async () => {
            let rawConfig: unknown;

            try {
                rawConfig = await loadSsmConfig(ssm, prefix);
            } catch (error) {
                throw new ConfigError('Config loading failed', error);
            }

            try {
                return schema.parse(rawConfig);
            } catch (error) {
                throw new ConfigError('Config validation failed', error);
            }
        })();
        return configPromise;
    };
};
