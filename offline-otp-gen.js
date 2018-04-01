const speakeasy = require('speakeasy');
const fs = require('fs');

const dirConfig = `${__dirname}/.config`;
const privateKeyFileName = `${dirConfig}/private-key`;

if (!fs.existsSync){
	fs.mkdirSync(dirConfig);
}

if (fs.existsSync(privateKeyFileName)){
	console.log(`Private key file '${privateKeyFileName}' exists, exiting`);
	return;
}

var secret = speakeasy.generateSecret({
	name: 'MancJS Lambda'
});

var QRCode = require('qrcode');

// Get the data URL of the authenticator URL
var qrFilePath = `${dirConfig}/qr.png`;
QRCode.toFile(qrFilePath, secret.otpauth_url);

fs.writeFile(privateKeyFileName, secret.base32);

console.log(`Open ${qrFilePath} to scan a QR code`);
