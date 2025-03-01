const fs = require('fs');
const path = require('path');

module.exports.hello = fs.readFileSync(path.join(__dirname, 'hello.gql'), 'utf8');
