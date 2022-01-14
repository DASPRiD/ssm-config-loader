import {Parameter, SSM} from '@aws-sdk/client-ssm';
import chai, {expect} from 'chai';
import chaiAsPromised from 'chai-as-promised'
import 'mocha';
import {createSandbox} from 'sinon';
import {loadSsmConfig} from '../src';

chai.use(chaiAsPromised);

describe('loadSsmConfig', () => {
    const sandbox = createSandbox();

    const createSsmStub = (parameters : Parameter[] | undefined) => {
        return sandbox.createStubInstance(SSM, {
            // @ts-expect-error TypeScript complains about parameter types not matching
            getParametersByPath: sandbox.stub().withArgs({
                Path: '/foo',
                Recursive: true,
                WithDecryption: true,
                NextToken: undefined,
            }).returns(Promise.resolve({
                $metadata: {},
                Parameters: parameters,
            })),
        });
    };

    afterEach(() => {
        sandbox.restore();
    });

    it('should ignore undefined parameters', async () => {
        const ssm = createSsmStub(undefined);

        return expect(loadSsmConfig(ssm, '/foo')).to.eventually.eql({});
    });

    it('should ignore parameters with undefined name or value', async () => {
        const ssm = createSsmStub([
            {Name: undefined, Value: '1'},
            {Name: '/foo/bar', Value: undefined},
            {Name: '/foo/baz', Value: 'bat'},
        ]);

        return expect(loadSsmConfig(ssm, '/foo')).to.eventually.eql({baz: 'bat'});
    });

    it('should ignore parameters without leaf', async () => {
        const ssm = createSsmStub([
            {Name: '/foo', Value: '1'},
            {Name: '/foo/baz', Value: 'bat'},
        ]);

        return expect(loadSsmConfig(ssm, '/foo')).to.eventually.eql({baz: 'bat'});
    });

    it('should report colliding names', async () => {
        const ssm = createSsmStub([
            {Name: '/foo/bar/baz', Value: '1'},
            {Name: '/foo/bar/baz/bat', Value: '2'},
        ]);

        return expect(loadSsmConfig(ssm, '/foo')).to.eventually.be.rejectedWith(
            'Parameter "/foo/bar/baz/bat" collides with leaf node parameter'
        );
    });

    it('should map flat parameters to tree', async () => {
        const ssm = createSsmStub([
            {Name: '/foo/bar/baz', Value: '1'},
            {Name: '/foo/bar/bat', Value: '2'},
            {Name: '/foo/baz/baf/bag', Value: '3'},
        ]);

        return expect(loadSsmConfig(ssm, '/foo')).to.eventually.eql({
            bar: {baz: '1', bat: '2'},
            baz: {baf: {bag: '3'}},
        });
    });

    it('should paginate result', async () => {
        const getParametersByPath = sandbox.stub();
        getParametersByPath.withArgs({
            Path: '/foo',
            Recursive: true,
            WithDecryption: true,
            NextToken: undefined,
        }).returns(Promise.resolve({
            $metadata: {},
            Parameters: [{Name: '/foo/bar', Value: '1'}],
            NextToken: 'token',
        }));
        getParametersByPath.withArgs({
            Path: '/foo',
            Recursive: true,
            WithDecryption: true,
            NextToken: 'token',
        }).returns(Promise.resolve({
            $metadata: {},
            Parameters: [{Name: '/foo/baz', Value: '2'}],
            NextToken: undefined,
        }));

        const ssm = sandbox.createStubInstance(SSM, {
            // @ts-expect-error TypeScript complains about parameter types not matching
            getParametersByPath,
        });

        return expect(loadSsmConfig(ssm, '/foo')).to.eventually.eql({
            bar: '1',
            baz: '2',
        });
    });

    it('should load config from file without provided prefix', async () => {
        sandbox.stub(process, 'cwd').returns(__dirname);
        const ssm = sandbox.createStubInstance(SSM);

        return expect(loadSsmConfig(ssm)).to.eventually.eql({
            foo: 'bar',
        });
    });
});
