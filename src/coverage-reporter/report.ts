import type { Reporter } from '@playwright/test/reporter';
import { existsSync } from 'fs';
import { access, rm, writeFile, mkdir, readdir, readFile } from 'fs/promises';
import { generateHtmlReport } from './html-generator';
import { extractOperationsInputParamsSchema } from './gql-client-parser';
import { join, resolve } from 'path';
import { OperationSchema } from './types';
import {
  incrementCountersInOperationSchema,
  calculateOperationCoverage,
  buildParamCoverageString,
  calculateTotalArgsCoverage,
  floorDecimal
} from './coverage-calculation-helpers';
import { getPathToTmpCoverageStash } from './coverageStashPath';

function isFileExists(path: string): Promise<boolean> {
  return access(path).then(() => true, () => false);
}

export type Summary = {
  coverage?: string,
  coverageTotal?: string,
  covered?: string,
  operationsCoverageSummary?: string,
  operationsArgCoverage: { name: string, argsCoverage: string, covered: boolean }[],
};

export default class GraphqlCoverageReport implements Reporter {

  private readonly coverageDir: string;
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
    this.coverageDir = getPathToTmpCoverageStash(options.graphqlFilePath);
    this.operationsSchema = extractOperationsInputParamsSchema(absolutePath);
    this.logUncoveredOperations = options.logUncoveredOperations ?? false;
    this.minCoveragePerOperation = options.minCoveragePerOperation ?? 100;
    this.coverageFilePath = options.coverageFilePath ?? './gql-coverage.log';
    this.htmlFilePath = options.htmlFilePath ?? './gql-coverage.html';
    this.saveGqlCoverageLog = options.saveGqlCoverageLog ?? false;
    this.saveHtmlSummary = options.saveHtmlSummary ?? false;
  }

  async onBegin() {
    if (await isFileExists(this.coverageDir)) await rm(this.coverageDir, { recursive: true });
    await mkdir(this.coverageDir);
  }

  async onEnd() {
    if (!await isFileExists(this.coverageDir)) throw new Error(`Directory with logged coverage was not found: ${this.coverageDir}`);
    const operationsFiles = await readdir(this.coverageDir);

    const coveredOperationsWithArgs: { name: string, calls: { name: string, inputParams: any[] }[] }[] = await Promise.all(
        operationsFiles.map(async (fileName) => {
          const operationFile = await readFile(join(this.coverageDir, fileName), { encoding: 'utf8' });
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
      const operationCoverage = covered ?
          !operation.inputParams.length ? 100 : calculateOperationCoverage(operation.inputParams) : 0;
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

    await rm(this.coverageDir, { recursive: true });
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
