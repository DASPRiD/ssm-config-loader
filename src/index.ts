import {readFile} from 'fs/promises';
import * as path from 'path';
import type {GetParametersByPathCommandOutput, SSM} from '@aws-sdk/client-ssm';

export type SsmConfig = {[key : string] : string | SsmConfig};

const loadConfigFromSsm = async (ssm : SSM, prefix : string) : Promise<SsmConfig> => {
    const config : SsmConfig = {};
    let nextToken : string | undefined = undefined;

    do {
        const result : GetParametersByPathCommandOutput = await ssm.getParametersByPath({
            Path: prefix,
            Recursive: true,
            NextToken: nextToken,
            WithDecryption: true,
        });

        if (!result.Parameters) {
            break;
        }

        for (const parameter of result.Parameters) {
            if (parameter.Name === undefined || parameter.Value === undefined) {
                continue;
            }

            const branchNames = parameter.Name.substring(prefix.length + 1).split('/');
            const leafName = branchNames.pop();

            if (!leafName) {
                continue;
            }

            let branch = config;

            for (const branchName of branchNames) {
                if (typeof branch[branchName] === 'string') {
                    throw new Error(`Parameter "${parameter.Name}" collides with leaf node parameter`);
                }

                if (!branch[branchName]) {
                    branch[branchName] = {};
                }

                branch = branch[branchName] as SsmConfig;
            }

            branch[leafName] = parameter.Value;
        }

        nextToken = result.NextToken;
    } while (nextToken);

    return config;
};

const loadConfigFromFile = async () : Promise<SsmConfig> => {
    const json = await readFile(path.join(process.cwd(), 'ssm-config.json'), {encoding: 'utf8'});
    return JSON.parse(json) as SsmConfig;
};

export const loadSsmConfig = async (ssm : SSM, prefix ?: string) : Promise<SsmConfig> => {
    if (prefix) {
        return loadConfigFromSsm(ssm, prefix);
    }

    return loadConfigFromFile();
};
