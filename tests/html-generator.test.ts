import { generateHtmlReport } from '../src/coverage-reporter/html-generator';
import { Summary } from '../src/coverage-reporter/report';
import { OperationSchema } from '../src/coverage-reporter/types';

describe('HTML Generator', () => {
    const baseSummary: Summary = {
        coverage: '85.5%',
        coverageTotal: '4',
        covered: '3',
        operationsArgCoverage: [],
        operationsCoverageSummary: '85.50%',
    };

    const baseOperations: OperationSchema[] = [];

    test('should generate HTML report with basic structure', () => {
        const html = generateHtmlReport(baseSummary, baseOperations);

        expect(html).toContain('<!DOCTYPE html>');
        expect(html).toContain('<html lang="en">');
        expect(html).toContain('<title>GraphQL Coverage Report</title>');
        expect(html).toContain('GraphQL Coverage Report');
    });

    test('should include summary information', () => {
        const html = generateHtmlReport(baseSummary, baseOperations);

        expect(html).toContain('Coverage:</strong>');
        expect(html).toContain(baseSummary.coverage);
        expect(html).toContain('Total Operations:</strong>');
        expect(html).toContain(baseSummary.coverageTotal);
        expect(html).toContain('Covered:</strong>');
        expect(html).toContain(baseSummary.covered);
        expect(html).toContain('Total Args Coverage:</strong>');
        expect(html).toContain(baseSummary.operationsCoverageSummary);
    });

    test('should include CSS styles', () => {
        const html = generateHtmlReport(baseSummary, baseOperations);

        expect(html).toContain('<style>');
        expect(html).toContain('--primary-color');
        expect(html).toContain('--covered-color');
        expect(html).toContain('--uncovered-color');
    });

    test('should display operations with coverage status', () => {
        const operations: OperationSchema[] = [
            {
                name: 'getUser',
                inputParams: [
                    { key: 'id', type: 'string', called: 5 },
                    { key: 'name', type: 'string', called: 0 },
                ],
            },
            {
                name: 'createUser',
                inputParams: [],
            },
        ];

        const summary: Summary = {
            ...baseSummary,
            operationsArgCoverage: [
                { name: 'getUser', argsCoverage: '50%', covered: true },
                { name: 'createUser', argsCoverage: '100%', covered: true },
            ],
        };

        const html = generateHtmlReport(summary, operations);

        expect(html).toContain('getUser');
        expect(html).toContain('createUser');
        expect(html).toContain('50%');
        expect(html).toContain('100%');
    });

    test('should mark operations as covered or uncovered', () => {
        const operations: OperationSchema[] = [
            { name: 'coveredOp', inputParams: [] },
            { name: 'uncoveredOp', inputParams: [] },
        ];

        const summary: Summary = {
            ...baseSummary,
            operationsArgCoverage: [
                { name: 'coveredOp', argsCoverage: '100%', covered: true },
                { name: 'uncoveredOp', argsCoverage: '0%', covered: false },
            ],
        };

        const html = generateHtmlReport(summary, operations);

        expect(html).toContain('class="operation covered"');
        expect(html).toContain('class="operation uncovered"');
    });

    test('should handle empty operations list', () => {
        const html = generateHtmlReport(baseSummary, []);

        expect(html).toContain('<div class="operations">');
        expect(html).not.toContain('<div class="operation">');
    });

    test('should handle operations with no input parameters', () => {
        const operations: OperationSchema[] = [
            { name: 'noParamsOp', inputParams: [] },
        ];

        const summary: Summary = {
            ...baseSummary,
            operationsArgCoverage: [
                { name: 'noParamsOp', argsCoverage: '100%', covered: true },
            ],
        };

        const html = generateHtmlReport(summary, operations);

        expect(html).toContain('noParamsOp');
        // When inputParams is empty, argsMap becomes "()"
        expect(html).toContain('()');
    });

    test('should display enum values correctly', () => {
        const operations: OperationSchema[] = [
            {
                name: 'search',
                inputParams: [
                    {
                        key: 'status',
                        type: 'StatusEnum',
                        called: 0,
                        enumValues: [
                            { key: 'ACTIVE', value: 'ACTIVE', called: 5 },
                            { key: 'INACTIVE', value: 'INACTIVE', called: 0 },
                        ],
                    },
                ],
            },
        ];

        const summary: Summary = {
            ...baseSummary,
            operationsArgCoverage: [
                { name: 'search', argsCoverage: '50%', covered: false },
            ],
        };

        const html = generateHtmlReport(summary, operations);

        expect(html).toContain('status');
        expect(html).toContain('ACTIVE');
        expect(html).toContain('INACTIVE');
    });

    test('should display nested parameters correctly', () => {
        const operations: OperationSchema[] = [
            {
                name: 'complexQuery',
                inputParams: [
                    {
                        key: 'filter',
                        type: 'FilterInput',
                        called: 0,
                        subParams: [
                            { key: 'name', type: 'string', called: 5 },
                            { key: 'age', type: 'number', called: 0 },
                        ],
                    },
                ],
            },
        ];

        const summary: Summary = {
            ...baseSummary,
            operationsArgCoverage: [
                { name: 'complexQuery', argsCoverage: '50%', covered: false },
            ],
        };

        const html = generateHtmlReport(summary, operations);

        expect(html).toContain('filter');
        expect(html).toContain('name');
        expect(html).toContain('age');
    });
});
