var key = process.argv[2];

const validate = require('./validate');

console.log(validate.validate(key) ? 'Right' : 'Wrong');
