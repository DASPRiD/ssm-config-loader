import {SSM} from '@aws-sdk/client-ssm';
import type z from 'zod';
import {loadSsmConfig} from './index';

export class ConfigError extends Error {
    public wrappedError ?: unknown;

    public constructor(message : string, wrappedError ?: unknown) {
        if (wrappedError instanceof Error) {
            message += `: ${wrappedError.message}`;
        }

        super(message);
        this.wrappedError = wrappedError;
    }
}

export const createSingletonConfigGetter = <T extends z.ZodType<unknown>>(
    ssm : SSM,
    schema : T,
    prefix ?: string
) : () => Promise<z.infer<T>> => {
    let configPromise : Promise<z.infer<T>> | undefined;

    return async () : Promise<z.infer<T>> => {
        if (configPromise) {
            return configPromise;
        }

        return configPromise = (async () => {
            let rawConfig;

            try {
                rawConfig = await loadSsmConfig(new SSM({}), prefix);
            } catch (error) {
                throw new ConfigError('Config loading failed', error);
            }

            try {
                return schema.parse(rawConfig);
            } catch (error) {
                throw new ConfigError('Config validation failed', error);
            }
        })();
    };
};
