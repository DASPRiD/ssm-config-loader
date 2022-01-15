import {SSM} from '@aws-sdk/client-ssm';
import type {ZodType} from 'zod';
import {loadSsmConfig} from './index';

export class ConfigError extends Error {
    public wrappedError ?: unknown;

    public constructor(message : string, wrappedError ?: unknown) {
        super(message);
        this.wrappedError = wrappedError;
    }
}

export const createSingletonConfigGetter = <T>(
    ssm : SSM,
    schema : ZodType<T>,
    prefix ?: string
) : () => Promise<T> => {
    let configPromise : Promise<T> | undefined;

    return async () : Promise<T> => {
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
