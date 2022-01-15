import {SSM} from '@aws-sdk/client-ssm';
import chai, {expect} from 'chai';
import chaiAsPromised from 'chai-as-promised';
import 'mocha';
import {createSandbox} from 'sinon';
import {z} from 'zod';
import {createSingletonConfigGetter} from '../src/singleton-config-getter';

chai.use(chaiAsPromised);

describe('singleton-config-getter', () => {
    const sandbox = createSandbox();

    afterEach(() => {
        sandbox.restore();
    });

    it('should throw error when loading fails', async () => {
        const schema = z.object({});
        const ssm = sandbox.createStubInstance(SSM, {
            // @ts-expect-error TypeScript complains about parameter types not matching
            getParametersByPath: sandbox.stub().returns(Promise.reject('failure')),
        });
        const getConfig = createSingletonConfigGetter(ssm, schema, '/foo');

        return expect(getConfig()).to.eventually.be.rejectedWith('Config loading failed');
    });

    it('should throw error when validation fails', async () => {
        sandbox.stub(process, 'cwd').returns(__dirname);
        const schema = z.object({
            foo: z.literal('invalid'),
        });
        const ssm = sandbox.createStubInstance(SSM);
        const getConfig = createSingletonConfigGetter(ssm, schema);

        return expect(getConfig()).to.eventually.be.rejectedWith('Config validation failed');
    });

    it('should return the same result when executed twice', async () => {
        sandbox.stub(process, 'cwd').returns(__dirname);
        const schema = z.object({
            foo: z.literal('bar'),
        });
        const ssm = sandbox.createStubInstance(SSM);
        const getConfig = createSingletonConfigGetter(ssm, schema);

        const [configA, configB] = await Promise.all([getConfig(), getConfig()]);
        expect(configA).to.equal(configB);
    });
});
