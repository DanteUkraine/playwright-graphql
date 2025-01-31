import type { Reporter } from '@playwright/test/reporter';
import { existsSync } from 'fs';
import { access, rm, writeFile, mkdir, readdir, readFile } from 'fs/promises';
import { generateHtmlReport } from './hrmlGenerator';
import * as ts from 'typescript';
import { join, resolve } from 'path';
import { coverageDir } from './consts';

type EnumValues = { key: string, value: string | number, called: 0 }[];
type ParsedParameter = { key: string, type: string, called: number, subParams?: ParsedParameter[], enumValues?: EnumValues };
type ParsedParameters = ParsedParameter[];
export type OperationSchema = { name: string, inputParams: ParsedParameters };

function floorDecimal(value: number, decimalPlaces: number): number {
  //The multiplier is calculated as 10n, where n is the number of decimal places you want to round to.
  const multiplier = Math.pow(10, decimalPlaces);
  return Math.floor(value * multiplier) / multiplier;
}

function isFileExists(path: string): Promise<boolean> {
  return access(path).then(() => true, () => false);
}

function removeOptionalFromKey(key: string): string {
  return key.replace(/\?|\s/g, '');
}

function isTypeCustom(typeString: string) {
  return ![
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
    'jsonobject'
  ].includes(typeString.toLowerCase());
}

function parseRootInputParamsType(typeString: string): ParsedParameters {
  const propertyPattern = /(\w+(\?)?|\[\w+:\s\w+])+:\s\w+/g;
  const propStrings = typeString.match(propertyPattern);
  return propStrings ? propStrings.map(p => {
    const [key, type] = p.split(/:\s(?!\w+])/g);
    return { key: removeOptionalFromKey(key), type, called: 0 };
  }) : [];
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

function isEnum(sourceFile: ts.SourceFile, name: string): boolean {
  return !!sourceFile.statements.find((i) => {
    return ts.isEnumDeclaration(i) && i.name.text === name;
  });
}

function parseEnumStatement(sourceFile: ts.SourceFile, enumName: string): EnumValues {
  const enumDeclaration = sourceFile.statements.find((i) => {
    return ts.isEnumDeclaration(i) && i.name.text === enumName;
  });

  if(enumDeclaration) {
    return enumDeclaration.getText()
        .replace(/.+{|}/g, '')
        .split(/,/g)
        .filter(i => i)
        .map((i) => {
          const [key, value] = i.trim().split(/=\s/);
          return { key: removeOptionalFromKey(key), value: value.replace(/'/g, ''), called: 0 };
        });
  }

  return [];
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

function extractOperationsInputParamsSchema(absolutePath: string, sdkFunctionName: string = 'getSdk'): OperationSchema[] {
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

function incrementCountersInOperationSchema(schema: OperationSchema, inputParams: any[]): void {
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
  return called > 0 ? '\u2714' : '\u2718';
}

function calculateOperationCoverage(params: ParsedParameters): number {
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

function calculateTotalArgsCoverage(coverageList: string[]): string {
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

export type Summary = {
  coverage?: string,
  coverageTotal?: string,
  covered?: string,
  operationsCoverageSummary?: string,
  operationsArgCoverage: { name: string, argsCoverage: string, covered: boolean }[],
};

export default class GraphqlCoverageReport implements Reporter {

  private readonly operationsSchema: OperationSchema[];
  private readonly logUncoveredOperations: boolean = false;
  private readonly coverageFilePath: string;
  private readonly htmlFilePath: string;
  private readonly minCoveragePerOperation: number;
  private readonly saveGqlCoverageLog: boolean;
  private readonly saveHtmlSummary: boolean;
  private summary: Summary = { operationsArgCoverage: [] };

  constructor(options: {
    graphqlFilePath: string,
    coverageFilePath?: string,
    htmlFilePath?: string,
    logUncoveredOperations?: boolean,
    minCoveragePerOperation?: number,
    saveGqlCoverageLog?: boolean,
    saveHtmlSummary?: boolean,
  }) {
    const absolutePath = resolve(options.graphqlFilePath);
    if (!existsSync(absolutePath)) {
      throw new Error(`Source file '${absolutePath}' does not exist.`);
    }
    this.operationsSchema = extractOperationsInputParamsSchema(absolutePath);
    this.logUncoveredOperations = options.logUncoveredOperations ?? false;
    this.minCoveragePerOperation = options.minCoveragePerOperation ?? 100;
    this.coverageFilePath = options.coverageFilePath ?? './gql-coverage.log';
    this.htmlFilePath = options.htmlFilePath ?? './gql-coverage.html';
    this.saveGqlCoverageLog = options.saveGqlCoverageLog ?? false;
    this.saveHtmlSummary = options.saveHtmlSummary ?? false;
  }

  async onBegin() {
    if (await isFileExists(coverageDir)) await rm(coverageDir, { recursive: true });
    await mkdir(coverageDir);
  }

  async onEnd() {
    if (!await isFileExists(coverageDir)) throw new Error(`Directory with logged coverage was not found: ${coverageDir}`);
    const operationsFiles = await readdir(coverageDir);

    const coveredOperationsWithArgs: { name: string, calls: { name: string, inputParams: any[] }[] }[] = await Promise.all(
        operationsFiles.map(async (fileName) => {
          const operationFile = await readFile(join(coverageDir, fileName), { encoding: 'utf8' });
          return {
            name: fileName,
            calls: JSON.parse(`[${operationFile.slice(0, -1)}]`), // .slice(0, -1) because last char always will be a comma.
          };
        })
    );

    coveredOperationsWithArgs.forEach((operation) => {
      const operationSchema = this.operationsSchema.find(i => i.name === operation.name);
      if (operationSchema) {
        operation.calls.forEach((i) => {
          if (i.inputParams.length) {
            incrementCountersInOperationSchema(operationSchema, i.inputParams);
          }
        });
      }
    });

    if (await isFileExists(this.coverageFilePath)) await rm(this.coverageFilePath);

    const coveredInTests = coveredOperationsWithArgs.map(i => i.name);

    for (const operation of this.operationsSchema) {
      const covered = coveredInTests.includes(operation.name);
      const operationCoverage = covered ? calculateOperationCoverage(operation.inputParams) : 0;
      const opCoverageString = `${operationCoverage}%`;
      this.summary.operationsArgCoverage.push({
        name: operation.name,
        argsCoverage: opCoverageString,
        covered: covered ? operationCoverage >= this.minCoveragePerOperation : false
      });

      const argsMap = `(${operation.inputParams.map(param => buildParamCoverageString(param)).join(',\n')});\n`;
      const operationCoverageString = `Args coverage: ${opCoverageString}\n${operation.name} ${argsMap}`;
      if (this.saveGqlCoverageLog) await writeFile(this.coverageFilePath, operationCoverageString + '\n', { flag: 'a' });
    }

    this.summary.operationsCoverageSummary = `Total arguments coverage: ${calculateTotalArgsCoverage(this.summary.operationsArgCoverage.map(i => i.argsCoverage))}`;
    if (this.saveGqlCoverageLog) await writeFile(this.coverageFilePath, this.summary.operationsCoverageSummary + '\n', { flag: 'a' });

    const coveredOperations = this.summary.operationsArgCoverage
        .filter(i => coveredInTests.includes(i.name) && i.covered).length;
    [ this.summary.coverage, this.summary.coverageTotal, this.summary.covered ] = [
      `GQL Operations coverage in executed tests: ${floorDecimal((coveredOperations / this.operationsSchema.length) * 100, 2)}%`,
      `Total operations: ${this.operationsSchema.length}`,
      `Covered operations: ${coveredOperations}`,
    ];

    if (this.saveHtmlSummary) {
      await writeFile(this.htmlFilePath, generateHtmlReport(this.summary, this.operationsSchema));
    }

    await rm(coverageDir, { recursive: true });
  }

  async onExit(): Promise<void> {
    console.log('\n'+'='.repeat(170));
    console.log(this.summary.coverage);
    console.log(this.summary.coverageTotal);
    console.log(this.summary.covered);
    console.log(this.summary.operationsCoverageSummary);
    if (this.logUncoveredOperations) {
      console.log('='.repeat(75)+' Uncovered operations '+'='.repeat(75));
      console.log(`${this.summary.operationsArgCoverage
          .filter(i => !i.covered)
          .map(({ name, argsCoverage }) => `${name} ${argsCoverage}`)
          .join('\n')}`);
    }
    console.log('='.repeat(170)+'\n');
  }
}
