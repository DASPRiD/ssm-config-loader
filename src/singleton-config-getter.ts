import type { SSM } from "@aws-sdk/client-ssm";
import type z from "zod";
import { loadSsmConfig } from "./index.js";

export class ConfigError extends Error {
    public constructor(message: string, cause?: unknown) {
        if (cause instanceof Error) {
            message += `: ${cause.message}`;
        }

        super(message, { cause });
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
                throw new ConfigError("Config loading failed", error);
            }

            try {
                return schema.parse(rawConfig);
            } catch (error) {
                throw new ConfigError("Config validation failed", error);
            }
        })().catch((error: unknown) => {
            configPromise = undefined;
            throw error;
        });
        return configPromise;
    };
};
