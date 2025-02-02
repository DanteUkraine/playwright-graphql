export type EnumValues = { key: string, value: string | number, called: 0 }[];
export type ParsedParameter = { key: string, type: string, called: number, subParams?: ParsedParameter[], enumValues?: EnumValues };
export type ParsedParameters = ParsedParameter[];
export type OperationSchema = { name: string, inputParams: ParsedParameters };