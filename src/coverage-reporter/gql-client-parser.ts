// ts-morph provides a higher-level, more maintainable API for TypeScript AST manipulation
// and avoids compatibility issues with TypeScript version changes.
import { Project, SourceFile, SyntaxKind, TypeAliasDeclaration } from "ts-morph";

import { ParsedParameters, EnumValues, OperationSchema } from './types';

// Type guards for ts-morph nodes
function hasGetMembers(node: unknown): node is { getMembers: () => unknown[] } {
    return typeof node === 'object' && node !== null && 'getMembers' in node;
}

function hasGetKind(node: unknown): node is { getKind: () => SyntaxKind } {
    return typeof node === 'object' && node !== null && 'getKind' in node;
}

function hasGetName(node: unknown): node is { getName: () => string } {
    return typeof node === 'object' && node !== null && 'getName' in node;
}

function hasGetNameNode(node: unknown): node is { getNameNode: () => { getText?: () => string } } {
    return typeof node === 'object' && node !== null && 'getNameNode' in node;
}

function hasGetTypeNode(node: unknown): node is { getTypeNode: () => { getText?: () => string } } {
    return typeof node === 'object' && node !== null && 'getTypeNode' in node;
}

function hasGetText(node: unknown): node is { getText: () => string } {
    return typeof node === 'object' && node !== null && 'getText' in node;
}

function hasGetTypeArguments(node: unknown): node is { getTypeArguments: () => unknown[] } {
    return typeof node === 'object' && node !== null && 'getTypeArguments' in node;
}

function hasGetDescendantsOfKind(node: unknown): node is { getDescendantsOfKind: (kind: SyntaxKind) => unknown[] } {
    return typeof node === 'object' && node !== null && 'getDescendantsOfKind' in node;
}

function hasGetParameters(node: unknown): node is { getParameters: () => unknown[] } {
    return typeof node === 'object' && node !== null && 'getParameters' in node;
}

function removeOptionalFromKey(key: string): string {
    // Remove optional modifier and whitespace using string methods
    return key.replace('?', '').replace(/\s/g, '');
}

function isTypeCustom(typeString: string): boolean {
    // all not custom types that can be generated in schema:
    // js primitives including bigint https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures
    // possible custom gql scalar types https://www.apollographql.com/docs/apollo-server/schema/custom-scalars
    // never and function are not in lists but in theory may be generated to I was not able to found any proof of opposite.
    const primitiveTypes = [
        'id', 'null', 'undefined', 'string', 'number', 'bigint',
        'int', 'float', 'boolean', 'date', 'function', 'symbol',
        'never', 'jsonobject', 'json', 'file', 'maybe', 'inputmaybe',
        'exact', 'makeoptional', 'makeempty', 'incremental'
    ];
    return !primitiveTypes.includes(typeString.toLowerCase());
}

function getBaseTypeName(typeText: string): string {
    if (typeText.includes('[')) {
        // Handle indexed access types like Scalars['String']['input']
        const base = typeText.split('[')[0];
        if (!isTypeCustom(base)) {
            return base.toLowerCase();
        }
        // Try to extract from inside the brackets using string methods
        const openBracketIndex = typeText.indexOf('[');
        if (openBracketIndex !== -1) {
            const bracketContent = typeText.slice(openBracketIndex);
            // Find the first quoted string in brackets
            const singleQuoteMatch = bracketContent.match(/\['([^']+)'\]/);
            const doubleQuoteMatch = bracketContent.match(/["]([^"]+)["]]/);
            
            if (singleQuoteMatch) {
                return singleQuoteMatch[1].toLowerCase();
            } else if (doubleQuoteMatch) {
                return doubleQuoteMatch[1].toLowerCase();
            }
        }
        return base;
    }
    if (typeText.includes('<')) {
        const base = typeText.split('<')[0];
        if (!isTypeCustom(base)) {
            // For wrapper types like InputMaybe<T>, extract T using string methods
            const openAngleIndex = typeText.indexOf('<');
            const closeAngleIndex = typeText.indexOf('>', openAngleIndex);
            if (openAngleIndex !== -1 && closeAngleIndex !== -1) {
                const innerType = typeText.slice(openAngleIndex + 1, closeAngleIndex);
                return getBaseTypeName(innerType);
            }
        }
        return base;
    }
    return typeText;
}

function getTypeNameFromTypeNode(typeString: string): string {
    const baseType = getBaseTypeName(typeString);
    if (!baseType || !isTypeCustom(baseType)) {
        return baseType.toLowerCase();
    }
    return baseType;
}

function parseTypeLiteralUsingMorph(typeLiteral: unknown): ParsedParameters {
    const result: ParsedParameters = [];
    if (!hasGetMembers(typeLiteral)) return result;
    
    const members = typeLiteral.getMembers();
    
    for (const member of members) {
        // Skip method signatures and call signatures
        if (hasGetKind(member) && (member.getKind() === SyntaxKind.MethodSignature || member.getKind() === SyntaxKind.CallSignature)) continue;
        
        // Try to get the name - different member types have different ways
        let key = '';
        if (hasGetName(member)) {
            key = member.getName();
        } else if (hasGetNameNode(member)) {
            const nameNode = member.getNameNode();
            if (nameNode && hasGetText(nameNode)) {
                key = nameNode.getText();
            }
        }
        
        if (!key) continue;
        
        let typeText = '';
        if (hasGetTypeNode(member)) {
            const typeNode = member.getTypeNode();
            if (typeNode && hasGetText(typeNode)) {
                typeText = typeNode.getText();
            }
        }
        
        result.push({
            key: removeOptionalFromKey(key),
            type: getTypeNameFromTypeNode(typeText),
            called: 0
        });
    }
    
    return result;
}

function parseExactTypeUsingMorph(typeNode: unknown): ParsedParameters {
    // Check if it's a TypeReference to Exact
    if (hasGetKind(typeNode) && typeNode.getKind() === SyntaxKind.TypeReference) {
        // Get the type name from the text
        const typeText = hasGetText(typeNode) ? typeNode.getText() : '';
        const typeName = typeText.split('<')[0];
        
        if (typeName === 'Exact') {
            if (hasGetTypeArguments(typeNode)) {
                const typeArgs = typeNode.getTypeArguments();
                if (typeArgs.length > 0) {
                    const firstArg = typeArgs[0];
                    // First argument should be a TypeLiteral
                    if (hasGetKind(firstArg) && firstArg.getKind() === SyntaxKind.TypeLiteral) {
                        return parseTypeLiteralUsingMorph(firstArg);
                    }
                }
            }
        }
    }
    
    // If not Exact, try to parse as a regular type literal
    if (hasGetKind(typeNode) && typeNode.getKind() === SyntaxKind.TypeLiteral) {
        return parseTypeLiteralUsingMorph(typeNode);
    }
    
    return [];
}

function findTypeAliasInSourceFile(sourceFile: SourceFile, name: string): TypeAliasDeclaration | undefined {
    try {
        return sourceFile.getTypeAlias(name);
    } catch (e) {
        return undefined;
    }
}

function parseEnumStatementUsingMorph(sourceFile: SourceFile, enumName: string): EnumValues {
    const enumDeclaration = sourceFile.getEnum(enumName);
    if (!enumDeclaration) return [];
    
    const result: EnumValues = [];
    const members = enumDeclaration.getMembers();
    
    for (const member of members) {
        const name = member.getName();
        const initializer = member.getInitializer();
        let value = name;
        if (initializer && hasGetText(initializer)) {
            value = initializer.getText().split("'").join('');
        }
        
        result.push({
            key: removeOptionalFromKey(name),
            value: value.split("'").join(''),
            called: 0
        });
    }
    
    return result;
}

function parseEnumAsConstStatementUsingMorph(sourceFile: SourceFile, name: string): EnumValues {
    const variableDeclarations = sourceFile.getVariableDeclarations();
    for (const declaration of variableDeclarations) {
        if (declaration.getName() === name) {
            const initializer = declaration.getInitializer();
            if (!initializer) continue;
            
            const objectLiteral = initializer.getFirstChildByKind(SyntaxKind.ObjectLiteralExpression);
            if (!objectLiteral) continue;
            
            const result: EnumValues = [];
            const propertyAssignments = objectLiteral.getDescendantsOfKind(SyntaxKind.PropertyAssignment);
            
            for (const property of propertyAssignments) {
                const propNameNode = property.getNameNode();
                if (!propNameNode || !hasGetText(propNameNode)) continue;
                
                const propName = propNameNode.getText();
                const valueNode = property.getInitializer();
                let value = propName;
                if (valueNode && hasGetText(valueNode)) {
                    value = valueNode.getText().split("'").join('');
                }
                
                result.push({
                    key: removeOptionalFromKey(propName),
                    value: value.split("'").join(''),
                    called: 0
                });
            }
            
            return result;
        }
    }
    return [];
}

function isEnumUsingMorph(sourceFile: SourceFile, name: string): boolean {
    return sourceFile.getEnum(name) !== undefined;
}

function isEnumAsConstUsingMorph(sourceFile: SourceFile, name: string): boolean {
    const variableDeclarations = sourceFile.getVariableDeclarations();
    for (const declaration of variableDeclarations) {
        if (declaration.getName() === name) {
            const initializer = declaration.getInitializer();
            if (initializer && hasGetText(initializer) && initializer.getText().includes('as const')) {
                return true;
            }
        }
    }
    return false;
}

function parseCustomTypeUsingMorph(sourceFile: SourceFile, name: string): ParsedParameters {
    const result: ParsedParameters = [];
    const typeAlias = findTypeAliasInSourceFile(sourceFile, name);
    if (!typeAlias) return result;
    
    const typeNode = typeAlias.getTypeNode();
    if (!typeNode) return result;
    
    const parsedParams = parseExactTypeUsingMorph(typeNode);
    
    for (const param of parsedParams) {
        if (isTypeCustom(param.type)) {
            const typeText = param.type;
            const customProps: { enumValues?: EnumValues; subParams?: ParsedParameters } = {};
            
            if (isEnumUsingMorph(sourceFile, typeText)) {
                customProps.enumValues = parseEnumStatementUsingMorph(sourceFile, typeText);
            } else if (isEnumAsConstUsingMorph(sourceFile, typeText)) {
                customProps.enumValues = parseEnumAsConstStatementUsingMorph(sourceFile, typeText);
            } else {
                customProps.subParams = parseCustomTypeUsingMorph(sourceFile, typeText);
            }
            
            result.push({ ...param, ...customProps });
        } else {
            result.push(param);
        }
    }
    
    return result;
}

function parseRootInputParamsType(typeString: string, sourceFile: SourceFile): ParsedParameters {
    // Try to find the type alias in the source file
    const baseTypeName = getTypeNameFromTypeNode(typeString);
    const typeAlias = findTypeAliasInSourceFile(sourceFile, baseTypeName);
    
    if (typeAlias) {
        const typeNode = typeAlias.getTypeNode();
        if (typeNode) {
            return parseExactTypeUsingMorph(typeNode);
        }
    }
    
    // Fallback: try to parse from the type string using regex (for complex types)
    // This handles cases like Exact<{ id: Scalars['String']['input'] }>
    const exactMatch = typeString.match(/Exact<\{([^}]*)\}>/);
    if (exactMatch) {
        const innerContent = exactMatch[1];
        const properties = innerContent.split(';')
            .map(p => p.trim())
            .filter(p => p);
        
        const result: ParsedParameters = [];
        for (const prop of properties) {
            const [key, type] = prop.split(/:\s/);
            if (key && type) {
                result.push({
                    key: removeOptionalFromKey(key),
                    type: getTypeNameFromTypeNode(type),
                    called: 0
                });
            } else if (key) {
                result.push({
                    key: removeOptionalFromKey(key),
                    type: '',
                    called: 0
                });
            }
        }
        return result;
    }
    
    return [];
}

function getTypeFromTypeNodeUsingMorph(typeNode: unknown): string {
    if (!hasGetText(typeNode)) {
        return '';
    }
    
    return typeNode.getText();
}

export function extractOperationsInputParamsSchema(absolutePath: string, sdkFunctionName: string = 'getSdk'): OperationSchema[] {
    const project = new Project({
        compilerOptions: {
            target: 10,
            module: 6,
        } as const,
    });
    
    const sourceFile = project.addSourceFileAtPath(absolutePath);
    if (!sourceFile) {
        throw new Error(`Source file '${absolutePath}' not found.`);
    }
    
    const sdkFunction = sourceFile.getFunction(sdkFunctionName);
    if (!sdkFunction) {
        throw new Error(`Function: '${sdkFunctionName}' not found in file: '${absolutePath}'`);
    }
    
    const operationsMap: OperationSchema[] = [];
    const functionBody = sdkFunction.getBody();
    
    if (functionBody) {
        const returnStatements = functionBody.getDescendantsOfKind(SyntaxKind.ReturnStatement);
        if (returnStatements.length > 0) {
            const returnStatement = returnStatements[0];
            const expression = returnStatement.getExpression();
            if (expression && hasGetKind(expression)) {
                // The expression is the object literal itself
                let objectLiteral: unknown = expression;
                
                // If it's not an object literal, try to get the first child
                if (expression.getKind() !== SyntaxKind.ObjectLiteralExpression) {
                    objectLiteral = expression.getFirstChildByKind(SyntaxKind.ObjectLiteralExpression);
                }
                
                if (objectLiteral && hasGetDescendantsOfKind(objectLiteral)) {
                    const methodDeclarations = objectLiteral.getDescendantsOfKind(SyntaxKind.MethodDeclaration);
                    
                    for (const methodDeclaration of methodDeclarations) {
                        if (!hasGetName(methodDeclaration)) continue;
                        
                        const operationName = methodDeclaration.getName();
                        const operationData: OperationSchema = { name: operationName, inputParams: [] };
                        
                        if (hasGetParameters(methodDeclaration)) {
                            const parameters = methodDeclaration.getParameters();
                            
                            for (const param of parameters) {
                                if (!hasGetName(param)) continue;
                                
                                const paramName = param.getName();
                                if (paramName === 'options') continue;
                                
                                if (hasGetTypeNode(param)) {
                                    const paramTypeNode = param.getTypeNode();
                                    // Get the type as text from ts-morph
                                    const typeText = getTypeFromTypeNodeUsingMorph(paramTypeNode);
                                    
                                    // Parse the type to extract parameters
                                    const parsedRootParameters = parseRootInputParamsType(typeText, sourceFile);
                                    
                                    parsedRootParameters.forEach(i => {
                                        if (isTypeCustom(i.type)) {
                                            const parsedParams = isEnumUsingMorph(sourceFile, i.type) ?
                                                { enumValues: parseEnumStatementUsingMorph(sourceFile, i.type) } :
                                                isEnumAsConstUsingMorph(sourceFile, i.type) ?
                                                    { enumValues: parseEnumAsConstStatementUsingMorph(sourceFile, i.type) } :
                                                    { subParams: parseCustomTypeUsingMorph(sourceFile, i.type) };
                                            
                                            operationData.inputParams.push({ ...i, ...parsedParams });
                                        } else if (i.type !== 'never') {
                                            operationData.inputParams.push({ ...i });
                                        }
                                    });
                                }
                            }
                        }
                        
                        operationsMap.push(operationData);
                    }
                }
            }
        }
    }
    
    return operationsMap;
}

// Export helper functions for testing
export { isTypeCustom, getBaseTypeName, getTypeNameFromTypeNode };