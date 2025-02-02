import { OperationSchema, ParsedParameter, ParsedParameters } from "./types";

export function floorDecimal(value: number, decimalPlaces: number): number {
    //The multiplier is calculated as 10n, where n is the number of decimal places you want to round to.
    const multiplier = Math.pow(10, decimalPlaces);
    return Math.floor(value * multiplier) / multiplier;
}


function incrementCounterForParamRecursively(paramSchema: ParsedParameter, inputParam: any): void {
    paramSchema.called++;

    if (paramSchema.subParams && inputParam) {
        Object.keys(inputParam).forEach((key: string) => {
            const schema = paramSchema.subParams?.find((i) => i.key === key);
            if (schema) {
                incrementCounterForParamRecursively(schema, inputParam[key]);
            }
        });
        return;
    }

    if (paramSchema.enumValues && inputParam) {
        const schema = paramSchema.enumValues.find(i => i.value == inputParam);
        if (schema) schema.called++;
    }
}

export function incrementCountersInOperationSchema(schema: OperationSchema, inputParams: any[]): void {
    inputParams.forEach((param) => {
        if (param) {
            Object.keys(param).forEach((key) => {
                const paramSchema = schema.inputParams.find(i => i.key === key);
                if (paramSchema) {
                    incrementCounterForParamRecursively(paramSchema, param[key]);
                }
            });
        }
    });
}

function putCoverSign(called: number): string {
    return called > 0 ? '\u2714' : '\u2718'; // mark(✔) and cross(✘) signs
}

export function calculateOperationCoverage(params: ParsedParameters): number {
    let totalCoverageItems = 0;
    let coveredItems = 0;
    const incrementation = (i: ParsedParameter) => {
        totalCoverageItems++;
        if (i.called > 0) coveredItems++;
        if (i.subParams) {
            i.subParams.forEach(param => {
                incrementation(param)
            });
        } else if (i.enumValues) {
            i.enumValues.forEach(ev => {
                totalCoverageItems++;
                if (ev.called > 0) {
                    coveredItems++;
                }
            })
        }
    };

    params.forEach((i) => incrementation(i));

    if (totalCoverageItems === 0) {
        return 100; // coverage for operations without arguments.
    }
    if (coveredItems > totalCoverageItems) {
        throw new Error('Args coverage calculation has an issue!');
    }

    return floorDecimal((coveredItems / totalCoverageItems) * 100, 2);
}

export function buildParamCoverageString(param: ParsedParameter, indent: string = ''): string {
    const currentIndent = indent + '  ';
    let result = `${indent}${param.key} ${putCoverSign(param.called)}`;
    if (param.subParams) {
        result += `: {\n${param.subParams.map(i => buildParamCoverageString(i, currentIndent)).join(',\n')}\n${indent}}`;
    } else if (param.enumValues) {
        result += `: [${param.enumValues.map(i => `${i.value} ${putCoverSign(param.called)}`).join(', ')}]`;
    }

    return result;
}

export function calculateTotalArgsCoverage(coverageList: string[]): string {
    let totalCoverage = 0;
    let count = 0;

    for (const coverage of coverageList) {
        const percentageValue = parseFloat(coverage.replace('%', ''));
        totalCoverage += percentageValue;
        count++;
    }
    const totalArgsCoverage = count > 0 ? totalCoverage / count : 0;

    return `${totalArgsCoverage.toFixed(2)}%`;
}