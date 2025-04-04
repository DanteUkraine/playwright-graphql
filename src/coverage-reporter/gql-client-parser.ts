import * as ts from "typescript";
import { ParsedParameters, EnumValues,OperationSchema } from './types';

function removeOptionalFromKey(key: string): string {
    return key.replace(/\?|\s/g, '');
}

function isTypeCustom(typeString: string) {
    // all not custom types that can be generated in schema:
    // js primitives including bigint https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures
    // possible custom gql scalar types https://www.apollographql.com/docs/apollo-server/schema/custom-scalars
    // never and function are not in lists but in theory may be generated to I was not able to found any proof of opposite.
    return ![
        'id',
        'null',
        'undefined',
        'string',
        'number',
        'bigint',
        'int',
        'float',
        'boolean',
        'date',
        'function',
        'symbol',
        'never',
        'jsonobject',
        'json',
        'file',
    ].includes(typeString.toLowerCase());
}

function parseTypeStatement(typeStatement: ts.Statement): ParsedParameters {
    return typeStatement.getText()
        .replace(/.+=|[\n{}]|\/\**.*\//g, '')
        .split(/;/g)
        .filter(i => i)
        .map((i) => {
            const [key, value] = i.trim().split(/:\s/);
            const narrowedTypeString = value.replace(/.+<|>/g, '').replace(/[A-Za-z]+\['|'.+/g, '');
            return {
                key: removeOptionalFromKey(key),
                type: narrowedTypeString,
                called: 0
            };
        });
}

function parseRootInputParamsType(typeString: string): ParsedParameters {
    // regexp was written to parse key value pairs from raw arguments string like:
    // Exact<{ filters?: CoachingRouterPhoneNumberListFilters; skip: number; sort?: CoachingRouterPhoneNumberSortInput; take: number; }>
    // Exact<{ filters: AgentsCallsMetricsListFilters; gradings: CallsGradingsInput; }>
    // Exact<{ params: AppointmentsAggregatedByAgentListArgs; params1: AppointmentsKpIsParams; }>
    const propertyPattern = /(\w+(\?)?|\[\w+:\s\w+])+:\s\w+/g;
    const propStrings = typeString.match(propertyPattern);
    return propStrings ? propStrings.map(p => {
        const [key, type] = p.split(/:\s(?!\w+])/g);
        return { key: removeOptionalFromKey(key), type, called: 0 };
    }) : [];
}

function isEnum(sourceFile: ts.SourceFile, name: string): boolean {
    return !!sourceFile.statements.find((i) => {
        return ts.isEnumDeclaration(i) && i.name.text === name;
    });
}

function parseEnumStatement(sourceFile: ts.SourceFile, enumName: string): EnumValues {
    const enumDeclaration = sourceFile.statements.find((i) => {
        return ts.isEnumDeclaration(i) && i.name.text === enumName;
    });

    if(!enumDeclaration) return [];

    return enumDeclaration.getText()
        .replace(/.+{|}/g, '')
        .split(/,/g)
        .filter(i => i)
        .map((i) => {
            const [key, value] = i.trim().split(/=\s/);
            return { key: removeOptionalFromKey(key), value: value.replace(/'/g, ''), called: 0 };
        });
}

function parseCustomType(sourceFile: ts.SourceFile, name: string): ParsedParameters {

    const typeDeclaration = sourceFile.statements.find((i) => {
        return ts.isTypeAliasDeclaration(i) && i.name.text === name;
    });

    if (typeDeclaration) {
        const parsedTypes = parseTypeStatement(typeDeclaration);
        return parsedTypes.map((i) => {
            if (isTypeCustom(i.type)) {
                const custom = isEnum(sourceFile, i.type) ?
                    { enumValues: parseEnumStatement(sourceFile, i.type) } :
                    isEnumAsConst(sourceFile, i.type) ?
                        { enumValues: parseEnumAsConstStatement(sourceFile, i.type) } :
                        { subParams: parseCustomType(sourceFile, i.type) };
                return {
                    ...i,
                    ...custom
                };
            }
            return i;
        });
    }

    return [];
}

function isEnumAsConst(sourceFile: ts.SourceFile, name: string): boolean {
    const typeAlias = sourceFile.statements.find(stmt =>
        ts.isTypeAliasDeclaration(stmt) &&
        stmt.name.text === name
    );

    if (typeAlias && ts.isTypeAliasDeclaration(typeAlias)) {
        const typeText = typeAlias.type.getText(sourceFile);
        const pattern = `typeof\\s+${name}\\[keyof typeof\\s+${name}\\]`;
        const regex = new RegExp(pattern);

        return regex.test(typeText);
    }

    return false;
}

function parseEnumAsConstStatement(sourceFile: ts.SourceFile, name: string): EnumValues {
    const constNameMatch = new RegExp(`(export\\s+)?const\\s+${name}\\s*=\\s*\\{`);
    const enumAsConst = sourceFile.statements.find((statement) => {
        return ts.isVariableStatement(statement) && constNameMatch.test(statement.getText());
    });

    if (enumAsConst) {
        return enumAsConst.getText()
            .replace(/.+{|}\sas\sconst;/g, '')
            .split(/,/g)
            .filter(i => i)
            .map((i) => {
                const [key, value] = i.trim().split(/:\s/);

                return { key: removeOptionalFromKey(key), value: value.replace(/'/g, ''), called: 0 };
            });
    }

    return [];
}


export function extractOperationsInputParamsSchema(absolutePath: string, sdkFunctionName: string = 'getSdk'): OperationSchema[] {
    const program: ts.Program = ts.createProgram([absolutePath], { emitDeclarationOnly: true });
    const sourceFile: ts.SourceFile | undefined = program.getSourceFile(absolutePath);
    const typeChecker: ts.TypeChecker = program.getTypeChecker();

    if (!sourceFile) {
        throw new Error(`Source file '${absolutePath}' not found.`);
    }

    const sdkFunction: ts.FunctionDeclaration | undefined = sourceFile.statements.find(
        (s) => ts.isFunctionDeclaration(s) && s.name?.text === sdkFunctionName
    ) as ts.FunctionDeclaration;

    if (!sdkFunction) {
        throw new Error(`Function: '${sdkFunctionName}' not found in file: '${absolutePath}'`);
    }

    const sdkFunctionType = typeChecker.getTypeAtLocation(sdkFunction);

    const returnType = sdkFunctionType.getCallSignatures()[0]?.getReturnType();

    if (!returnType) {
        throw new Error(`The return type of '${sdkFunctionName}' could not be determined.`);
    }

    const operations = typeChecker.getPropertiesOfType(returnType);
    const operationsMap: OperationSchema[] = [];

    for (const operation of operations) { // gql sdk properties loop
        const operationName = operation.getName();
        const propDeclaration = operation.valueDeclaration;
        const operationData: OperationSchema = { name: operationName, inputParams: [] };
        if (propDeclaration) {
            const propType = typeChecker.getTypeOfSymbolAtLocation(operation, propDeclaration);
            const signatures = propType.getCallSignatures();

            for (const signature of signatures) { // operations signature extraction loop
                const parameters = signature.getParameters();
                for (const param of parameters) { // operation input parameters loop
                    if (param.getName() !== 'options') {
                        const inputParamsType = typeChecker.getTypeOfSymbolAtLocation(param, param.valueDeclaration!);
                        const parsedRootParameters = parseRootInputParamsType(typeChecker.typeToString(inputParamsType));

                        parsedRootParameters.forEach(i => {
                            if (isTypeCustom(i.type)) {
                                const parsedParams = isEnum(sourceFile, i.type) ?
                                    { enumValues: parseEnumStatement(sourceFile, i.type) }:
                                    isEnumAsConst(sourceFile, i.type) ?
                                        { enumValues: parseEnumAsConstStatement(sourceFile, i.type) } :
                                        { subParams: parseCustomType(sourceFile, i.type) };
                                operationData.inputParams?.push({
                                    ...i,
                                    ...parsedParams,
                                });
                            } else if (i.type !== 'never') {
                                operationData.inputParams?.push({
                                    ...i,
                                });
                            }
                        });
                    }
                }
            }
        }
        operationsMap.push(operationData);
    }

    return operationsMap;
}