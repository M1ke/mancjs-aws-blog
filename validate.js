const speakeasy = require('speakeasy');
const fs = require('fs');
const dirConfig = `${__dirname}/.config`;
const privateKeyFileName = `${dirConfig}/private-key`;

exports.validate = function(key){
	var secret = fs.readFileSync(privateKeyFileName, "utf8");

	key = key.replace(/[^0-9]/g, '');
	console.log(`Validating input: '${key}'`);

	if (!secret){
		throw 'Secret was empty';
	}

	return speakeasy.totp.verify({
		secret: secret,
		encoding: 'base32',
		token: key,
		window: 2
	});
};

