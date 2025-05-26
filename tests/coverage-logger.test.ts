import { resolve } from 'path';
import { coverageLogger } from '../src';

jest.mock('fs/promises');

describe('Coverage logger', () => {
    const mockObject = {
        async testMethod(param1: string, param2: number) {
            return `Result: ${param1}, ${param2}`;
        },
    };

    const dirStashPath = 'some-path';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should call the original method and return its result', async () => {
        const proxiedObject = coverageLogger(mockObject, dirStashPath);

        const result = await proxiedObject.testMethod('test', 42);

        expect(result).toBe('Result: test, 42');
    });

    test('should log coverage to the correct file', async () => {
        const proxiedObject = coverageLogger(mockObject, dirStashPath);

        const writeFileMock = jest.spyOn(require('fs/promises'), 'writeFile').mockResolvedValue(undefined);

        await proxiedObject.testMethod('test', 42);

        const expectedLogPath = resolve(dirStashPath, 'testMethod');
        const expectedLogContent = `${JSON.stringify({ name: 'testMethod', inputParams: ['test', 42] })},`;

        expect(writeFileMock).toHaveBeenCalledWith(expectedLogPath, expectedLogContent, { flag: 'a' });
    });

    test('should ensure logging happens before returning the result', async () => {
        const proxiedObject = coverageLogger(mockObject, dirStashPath);

        const writeFileMock = jest.spyOn(require('fs/promises'), 'writeFile').mockImplementation(async () => {
            return new Promise((resolve) => setTimeout(resolve, 100));
        });

        const resultPromise = proxiedObject.testMethod('test', 42);

        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(writeFileMock).toHaveBeenCalled();

        const result = await resultPromise;
        expect(result).toBe('Result: test, 42');
    });

    test('should not log coverage for non-function properties', () => {
        const objWithProperties = { value: 42 };
        const proxiedObjWithProperties = coverageLogger(objWithProperties, dirStashPath);

        expect(proxiedObjWithProperties.value).toBe(42);
    });
});
