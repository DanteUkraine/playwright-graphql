import { join } from 'path';

export const coverageDir = join(process.cwd(), process.env.PW_GQL_TEMP_DIR ?? '.gql-coverage');