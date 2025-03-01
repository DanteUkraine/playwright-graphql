import { Summary } from './report';
import { OperationSchema } from './types';
import { buildParamCoverageString } from './coverage-calculation-helpers';

export function generateHtmlReport(summary: Summary, operationsSchema: OperationSchema[]): string {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>GraphQL Coverage Report</title>
        <style>
            :root {
                --primary-color: #007BFF;
                --covered-color: #28A745;
                --uncovered-color: #DC3545;
                --gray-color: #E9ECEF;
                --bg-color: #F8F9FA;
                --text-color: #212529;
                --border-radius: 8px;
            }

            body {
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 0;
                background-color: var(--bg-color);
                color: var(--text-color);
            }

            .container {
                max-width: 1200px;
                margin: 0 auto;
                padding: 20px;
            }

            .header {
                text-align: center;
                background-color: var(--primary-color);
                color: white;
                padding: 20px;
                border-radius: var(--border-radius);
            }

            .header h1 {
                margin: 0;
            }

            .summary {
                display: flex;
                justify-content: space-between;
                margin-top: 20px;
                padding: 15px;
                background-color: white;
                border-radius: var(--border-radius);
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }

            .summary div {
                text-align: center;
            }

            .operations {
                margin-top: 30px;
            }

            .operation {
                padding: 15px;
                margin-bottom: 20px;
                background-color: white;
                border-radius: var(--border-radius);
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }

            .operation h3 {
                margin-bottom: 10px;
            }

            .operation.covered {
                border-left: 5px solid var(--covered-color);
            }

            .operation.uncovered {
                border-left: 5px solid var(--uncovered-color);
            }

            pre {
                background-color: #f1f1f1;
                padding: 10px;
                border-radius: var(--border-radius);
                overflow-x: auto;
            }

            .empty-field {
                background-color: var(--gray-color);
                color: transparent; /* Make text invisible */
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>GraphQL Coverage Report</h1>
            </div>
            
            <div class="summary">
              <div><strong>Coverage:</strong><br>${summary.coverage}</div>
              <div><strong>Total Operations:</strong><br>${summary.coverageTotal}</div>
              <div><strong>Covered:</strong><br>${summary.covered}</div>
              <div><strong>Total Args Coverage:</strong><br>${summary.operationsCoverageSummary}</div>
          </div>

          <div class="operations">
              ${operationsSchema.map(operation => {
        const coverageInfo = summary.operationsArgCoverage
            .find(op => op.name === operation.name);

        const isCovered = coverageInfo?.covered;

        const argsMap = `(${operation.inputParams.map(param => buildParamCoverageString(param)).join(',\n')});\n`;
        return `
                      <div class="operation ${isCovered ? 'covered' : 'uncovered'}">
                          <h3>${operation.name} 
                              <span style="float:right; color:${isCovered ? 'var(--covered-color)' : 'var(--uncovered-color)'};">
                                  ${coverageInfo?.argsCoverage || 'N/A'}
                              </span>
                          </h3>
                          <pre class="${argsMap.trim() ? '' : 'empty-field'}">${argsMap.trim() || 'No arguments provided'}</pre>
                      </div>`;
    }).join('')}
          </div>
        </div>
    </body>
    </html>`;
}