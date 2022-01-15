# SSM Config Loader

[![Node.js CI](https://github.com/dasprid/ssm-config-loader/actions/workflows/ci.yml/badge.svg)](https://github.com/dasprid/ssm-config-loader/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/DASPRiD/ssm-config-loader/branch/main/graph/badge.svg?token=I960P1I5FR)](https://codecov.io/gh/DASPRiD/ssm-config-loader)

This library helps simplifies the use of the SSM parameter store by loading all values of a prefix into a tree
structure. It additionally supports loading the config from a local file, which aids in development.

## Installation

- Install the npm package:

  `npm install ssm-config-loader`

## Quick Start

To load a configuration from SSM, you only have to create an SSM client (v3) and supply it to the loader together with
a prefix:

```typescript
import {SSM} from '@aws-sdk/client-ssm';
import {loadSsmConfig} from 'ssm-config-loader';

const config = await loadSsmConfig(new SSM({}), process.env.SSM_PREFIX);
```

If `process.env.SSM_PREFIX` is set, likely in your production environment, it will use this to load all parameters under
that prefix and put it into a tree structure. This means it will strip the prefix (plus the next character, which should
be a slash) from the name, split the remaining parts by a slash and create a tree structure out of this.

If `process.env.SSM_PREFIX` is undefined, the loader will try to load an `ssm-config.json` file from your CWD. It is up
to you to create that JSON file in the same structure as it will be loaded from SSM, e.g. with the correct tree
structure.

## Validation and type safety

The config loader only returns a generic config object without much type safety. You most likely want to validate that
you get the correct values back from it. An easy way to accomplish this is by utilizing e.g. the
[Zod](https://github.com/colinhacks/zod/) library:


```typescript
import {SSM} from '@aws-sdk/client-ssm';
import {loadSsmConfig} from 'ssm-config-loader';
import {z} from 'zod';

const configSchema = z.object({
    endpoint: z.string().url(),
});

const config = configSchema.parse(
    await loadSsmConfig(new SSM({}), process.env.SSM_PREFIX)
);
```

Now you can be certain that the config is complete and all values are in the format you expect. Additionally, your
compiler can check for typos.

## Complete recipe

As you probably don't want to load the config every time some component needs access to a value, it would make sense to
create a singleton function to always return the same value once it was retrieved. This could look something like this:

```typescript
import {SSM} from '@aws-sdk/client-ssm';
import {loadSsmConfig} from 'ssm-config-loader';
import {z} from 'zod';

const configSchema = z.object({
    endpoint: z.string().url(),
});

export type Config = z.infer<typeof configSchema>;

let configPromise : Promise<Config>;

export const getConfig = async () : Promise<Config> => {
    if (configPromise) {
        return configPromise;
    }
    
    return configPromise = (async () => {
        return configSchema.parse(await loadSsmConfig(
            new SSM({}), process.env.SSM_PREFIX)
        );  
    })();
};
```

## Convenience helper

This library also comes with an opinionated convenience helper which will automatically create a singleton config getter
with built-in schema validation via zod. This removes a lot of boilerplate code you have to write in your projects:

```typescript
import {SSM} from '@aws-sdk/client-ssm';
import {createSingletonConfigGetter} from 'ssm-config-loader/lib/singleton-config-getter';
import {z} from 'zod';

const configSchema = z.object({
    endpoint: z.string().url(),
});

export type Config = z.infer<typeof configSchema>;

export const getConfig = createSingletonConfigGetter(new SSM({}), configSchema, process.env.SSM_PREFIX);
```

In case either loading the config or the validation fails, the getter will throw a `ConfigError` from the same file.
