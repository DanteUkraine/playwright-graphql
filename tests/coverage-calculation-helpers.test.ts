import {
    floorDecimal,
    incrementCountersInOperationSchema,
    calculateOperationCoverage,
    buildParamCoverageString,
    calculateTotalArgsCoverage,
} from '../src/coverage-reporter/coverage-calculation-helpers';
import { OperationSchema, ParsedParameter } from '../src/coverage-reporter/types';

describe('Coverage Calculation Helpers', () => {
    describe('floorDecimal', () => {
        test('should floor to 0 decimal places', () => {
            expect(floorDecimal(5.7, 0)).toBe(5);
            expect(floorDecimal(5.2, 0)).toBe(5);
            expect(floorDecimal(-5.7, 0)).toBe(-6);
        });

        test('should floor to 1 decimal place', () => {
            expect(floorDecimal(5.77, 1)).toBe(5.7);
            expect(floorDecimal(5.74, 1)).toBe(5.7);
            expect(floorDecimal(5.79, 1)).toBe(5.7);
        });

        test('should floor to 2 decimal places', () => {
            expect(floorDecimal(5.777, 2)).toBe(5.77);
            expect(floorDecimal(5.774, 2)).toBe(5.77);
            expect(floorDecimal(5.779, 2)).toBe(5.77);
        });

        test('should handle negative numbers', () => {
            expect(floorDecimal(-5.777, 2)).toBe(-5.78);
            expect(floorDecimal(-5.1, 0)).toBe(-6);
        });

        test('should handle zero', () => {
            expect(floorDecimal(0, 2)).toBe(0);
            expect(floorDecimal(0.0, 2)).toBe(0);
        });
    });

    describe('incrementCountersInOperationSchema', () => {
        test('should increment counters for simple parameters', () => {
            const schema: OperationSchema = {
                name: 'testOp',
                inputParams: [
                    { key: 'id', type: 'string', called: 0 },
                    { key: 'name', type: 'string', called: 0 },
                ],
            };

            const inputParams = [
                { id: '123', name: 'test' },
            ];

            incrementCountersInOperationSchema(schema, inputParams);

            expect(schema.inputParams[0].called).toBe(1);
            expect(schema.inputParams[1].called).toBe(1);
        });

        test('should increment counters for nested parameters', () => {
            const schema: OperationSchema = {
                name: 'testOp',
                inputParams: [
                    {
                        key: 'filter',
                        type: 'FilterInput',
                        called: 0,
                        subParams: [
                            { key: 'name', type: 'string', called: 0 },
                            { key: 'age', type: 'number', called: 0 },
                        ],
                    },
                ],
            };

            const inputParams = [
                { filter: { name: 'John', age: 30 } },
            ];

            incrementCountersInOperationSchema(schema, inputParams);

            expect(schema.inputParams[0].called).toBe(1);
            expect(schema.inputParams[0].subParams?.[0].called).toBe(1);
            expect(schema.inputParams[0].subParams?.[1].called).toBe(1);
        });

        test('should increment counters for enum values', () => {
            const schema: OperationSchema = {
                name: 'testOp',
                inputParams: [
                    {
                        key: 'status',
                        type: 'StatusEnum',
                        called: 0,
                        enumValues: [
                            { key: 'ACTIVE', value: 'ACTIVE', called: 0 },
                            { key: 'INACTIVE', value: 'INACTIVE', called: 0 },
                        ],
                    },
                ],
            };

            const inputParams = [
                { status: 'ACTIVE' },
                { status: 'INACTIVE' },
                { status: 'ACTIVE' },
            ];

            incrementCountersInOperationSchema(schema, inputParams);

            expect(schema.inputParams[0].called).toBe(3);
            expect(schema.inputParams[0].enumValues?.[0].called).toBe(2);
            expect(schema.inputParams[0].enumValues?.[1].called).toBe(1);
        });

        test('should handle multiple calls', () => {
            const schema: OperationSchema = {
                name: 'testOp',
                inputParams: [
                    { key: 'id', type: 'string', called: 0 },
                ],
            };

            const inputParams = [
                { id: '1' },
                { id: '2' },
                { id: '3' },
            ];

            incrementCountersInOperationSchema(schema, inputParams);

            expect(schema.inputParams[0].called).toBe(3);
        });

        test('should handle undefined input parameters', () => {
            const schema: OperationSchema = {
                name: 'testOp',
                inputParams: [
                    { key: 'id', type: 'string', called: 0 },
                ],
            };

            const inputParams = [
                undefined,
                null,
                {},
            ] as any[];

            incrementCountersInOperationSchema(schema, inputParams);

            expect(schema.inputParams[0].called).toBe(0);
        });

        test('should handle missing parameters', () => {
            const schema: OperationSchema = {
                name: 'testOp',
                inputParams: [
                    { key: 'id', type: 'string', called: 0 },
                    { key: 'name', type: 'string', called: 0 },
                ],
            };

            const inputParams = [
                { id: '123' }, // name is missing
            ];

            incrementCountersInOperationSchema(schema, inputParams);

            expect(schema.inputParams[0].called).toBe(1);
            expect(schema.inputParams[1].called).toBe(0);
        });
    });

    describe('calculateOperationCoverage', () => {
        test('should return 100 for operations without parameters', () => {
            const params: ParsedParameter[] = [];
            expect(calculateOperationCoverage(params)).toBe(100);
        });

        test('should calculate 100% coverage when all parameters are called', () => {
            const params: ParsedParameter[] = [
                { key: 'id', type: 'string', called: 1 },
                { key: 'name', type: 'string', called: 1 },
            ];
            expect(calculateOperationCoverage(params)).toBe(100);
        });

        test('should calculate 50% coverage when half parameters are called', () => {
            const params: ParsedParameter[] = [
                { key: 'id', type: 'string', called: 1 },
                { key: 'name', type: 'string', called: 0 },
            ];
            expect(calculateOperationCoverage(params)).toBe(50);
        });

        test('should calculate coverage with nested parameters', () => {
            const params: ParsedParameter[] = [
                {
                    key: 'filter',
                    type: 'FilterInput',
                    called: 1,
                    subParams: [
                        { key: 'name', type: 'string', called: 1 },
                        { key: 'age', type: 'number', called: 0 },
                    ],
                },
            ];
            // Total items: filter (1) + name (1) + age (1) = 3
            // Covered: filter (1) + name (1) = 2
            // Coverage: floor(2/3 * 100, 2) = floor(66.666..., 2) = 66.66
            expect(calculateOperationCoverage(params)).toBe(66.66);
        });

        test('should calculate coverage with enum values', () => {
            const params: ParsedParameter[] = [
                {
                    key: 'status',
                    type: 'StatusEnum',
                    called: 1,
                    enumValues: [
                        { key: 'ACTIVE', value: 'ACTIVE', called: 1 },
                        { key: 'INACTIVE', value: 'INACTIVE', called: 0 },
                    ],
                },
            ];
            // Total items: status (1) + ACTIVE (1) + INACTIVE (1) = 3
            // Covered: status (1) + ACTIVE (1) = 2
            // Coverage: floor(2/3 * 100, 2) = floor(66.666..., 2) = 66.66
            expect(calculateOperationCoverage(params)).toBe(66.66);
        });

        test('should not throw error for valid coverage values', () => {
            const params: ParsedParameter[] = [
                { key: 'id', type: 'string', called: 1 },
            ];
            expect(() => calculateOperationCoverage(params)).not.toThrow();
        });

        test('should handle deeply nested parameters', () => {
            const params: ParsedParameter[] = [
                {
                    key: 'level1',
                    type: 'Level1',
                    called: 1,
                    subParams: [
                        {
                            key: 'level2',
                            type: 'Level2',
                            called: 1,
                            subParams: [
                                { key: 'level3', type: 'string', called: 1 },
                                { key: 'level3b', type: 'string', called: 0 },
                            ],
                        },
                    ],
                },
            ];
            // Total: level1 (1) + level2 (1) + level3 (1) + level3b (1) = 4
            // Covered: level1 (1) + level2 (1) + level3 (1) = 3
            // Coverage: 3/4 * 100 = 75%
            expect(calculateOperationCoverage(params)).toBe(75);
        });
    });

    describe('buildParamCoverageString', () => {
        test('should build string for simple parameter', () => {
            const param: ParsedParameter = { key: 'id', type: 'string', called: 5 };
            const result = buildParamCoverageString(param);
            expect(result).toBe('id ✔');
        });

        test('should build string for uncovered parameter', () => {
            const param: ParsedParameter = { key: 'id', type: 'string', called: 0 };
            const result = buildParamCoverageString(param);
            expect(result).toBe('id ✘');
        });

        test('should build string for parameter with subParams', () => {
            const param: ParsedParameter = {
                key: 'filter',
                type: 'FilterInput',
                called: 1,
                subParams: [
                    { key: 'name', type: 'string', called: 1 },
                    { key: 'age', type: 'number', called: 0 },
                ],
            };
            const result = buildParamCoverageString(param);
            expect(result).toContain('filter ✔');
            expect(result).toContain('name ✔');
            expect(result).toContain('age ✘');
            expect(result).toContain(':');
            expect(result).toContain('{');
            expect(result).toContain('}');
        });

        test('should build string for parameter with enumValues', () => {
            const param: ParsedParameter = {
                key: 'status',
                type: 'StatusEnum',
                called: 0,
                enumValues: [
                    { key: 'ACTIVE', value: 'ACTIVE', called: 5 },
                    { key: 'INACTIVE', value: 'INACTIVE', called: 0 },
                ],
            };
            const result = buildParamCoverageString(param);
            expect(result).toBe('status ✘: [ACTIVE ✔, INACTIVE ✘]');
        });

        test('should apply indentation for nested parameters', () => {
            const param: ParsedParameter = {
                key: 'filter',
                type: 'FilterInput',
                called: 1,
                subParams: [
                    { key: 'name', type: 'string', called: 1 },
                ],
            };
            const result = buildParamCoverageString(param, '  ');
            expect(result).toContain('  filter ✔');
            expect(result).toContain('    name ✔');
        });
    });

    describe('calculateTotalArgsCoverage', () => {
        test('should calculate average from single coverage value', () => {
            expect(calculateTotalArgsCoverage(['100%'])).toBe('100.00%');
        });

        test('should calculate average from multiple coverage values', () => {
            expect(calculateTotalArgsCoverage(['50%', '100%'])).toBe('75.00%');
            expect(calculateTotalArgsCoverage(['0%', '100%'])).toBe('50.00%');
        });

        test('should handle empty list', () => {
            expect(calculateTotalArgsCoverage([])).toBe('0.00%');
        });

        test('should handle decimal values', () => {
            expect(calculateTotalArgsCoverage(['66.67%', '33.33%'])).toBe('50.00%');
        });

        test('should handle many values', () => {
            expect(calculateTotalArgsCoverage(['100%', '100%', '0%', '0%'])).toBe('50.00%');
        });
    });
});
