const AWS = (() => {
	try {
		let aws = require('./offline-aws');
		console.log('Loading AWS stub');
		return aws;
	}
	catch (e){
		return require('aws-sdk');	
	}
})();

const querystring = require('querystring');
const mustache = require('mustache');
const fs = require('fs');
const showdown = require('showdown');
const moment = require('moment');

const validate = require('./validate');

const dirTemplate = `${__dirname}/templates`;
const dirPublic = `${__dirname}/public`;

// Set this to the region you upload the Lambda function to.
AWS.config.region = 'eu-west-1';

const MyBucketName = process.env.BUCKET;
if (!MyBucketName){
	throw 'Env "BUCKET" was not set';
}

function makeHtml(subject, content){
	const date = moment();

	const converter = new showdown.Converter();
	let contentHtml = converter.makeHtml(content);

	let template = fs.readFileSync(`${dirTemplate}/post.mst`, 'utf8');
	
	return mustache.render(template, {subject: subject, content: contentHtml, date: date.format('dddd, MMMM Do YYYY \\a\\t h:mma')});
}

function makeFileName(subject){
	const date = moment();

	let subjectFile = subject.toLowerCase().replace(/[^0-9a-z]/g, '-');
	let dateFile = date.format('YYYY-MM-DD');
	
	return `${dateFile}-${subjectFile}.html`;
}

function saveToS3(s3, fileName, content, contentType, callback){
	if (!fileName){
		throw 'No valid file name provided for upload';
	}

	s3.upload({
		Key: fileName,
		Body: content,
		ACL: 'public-read',
		ContentType: contentType
	}, (err, data) => {
		let response = {success: true, file: fileName};
		
		if (err) {
			response.success = false;
			response.error = err.message;
			console.log('There was an error uploading the file: ', err.message);
		}
		else {
			console.log('Successfully created file ', fileName);
		}

		callback(response);
	});
}

function validateAuth(auth){
	if (!validate.validate(auth)){
		throw 'Incorrect auth';
	}
}

function validateRequest(subject, content){
	if (!content || !subject){
		throw 'You must enter valid a subject and text content';
	}
}

function makeLambdaResponse(response, httpStatusCode){
	if (!httpStatusCode){
		httpStatusCode = 200;		
	}

	return {
	    "isBase64Encoded": false,
	    "statusCode": httpStatusCode,
	    "headers": {
            "access-control-allow-origin": "*"
        },
	    "body": JSON.stringify(response)
	};
}

exports.handler = (event, context, lambdaCallback) => {
	var s3;

	function sendLambdaResponse(response, httpStatusCode){
		response = makeLambdaResponse(response, httpStatusCode);
		lambdaCallback(null, response);
	}

	function pageIndex(fileName){
		s3.getObject({
			Key: 'index.json',
		}, (err, data) => {
			let index;

			try {
				if (err){
					console.log('Get index.json error: ', err.message);
					throw '';
				}
				index = JSON.parse(data.Body);
			}
			catch (e){
				index = [];
			}

			var hasThisArticle = index.reduce((carry, item) => {
				return carry || item.fileName===fileName;
			}, false);

			if (!hasThisArticle){
				const date = moment();

				index.push({subject: subject, fileName: fileName, date: date.format('Do MMMM YYYY, ha')});
			}

			indexJson = JSON.stringify(index);

			saveToS3(s3, 'index.json', indexJson, 'application/json', (response) => {
				if (!response.success){
					sendLambdaResponse(response, 500);
				}

				generateIndex(index, fileName);
			});
		});
	}

	function generateIndex(index, fileName){
		try {
			console.log('Rendering index.html');

			let template = fs.readFileSync(`${dirTemplate}/index.mst`, 'utf8');
			var compiled = mustache.render(template, {list: index});
		}
		catch (e){
			console.log('There was an error generating the index: ', e);

			response.success = false;
			response.error = e;

			sendLambdaResponse(response, 500);
		}

		saveToS3(s3, 'index.html', compiled, 'text/html', (response) => {
			if (!response.success){
				sendLambdaResponse(response, 500);
			}

			sendLambdaResponse({file: fileName}, 200);
		});
	}

	const params = querystring.parse(event.body);
	console.log(event);

	// Our field from the request.
	const auth = params['auth'];
	const content = params['content'];
	const subject = params['subject'];

	try {
		validateAuth(auth);
		validateRequest(subject, content);
	}
	catch (e){
		console.log('Request was not valid', e);

		sendLambdaResponse({error: e}, 400);
		return;
	}

	try {
		s3 = new AWS.S3({
			apiVersion: 'latest',
			params: {
				Bucket: MyBucketName
			}
		});

		let compiled = makeHtml(subject, content);
		let fileName = makeFileName(subject);

		saveToS3(s3, fileName, compiled, 'text/html', (response) => {
			if (!response.success){
				sendLambdaResponse(response, 500);
			}

			pageIndex(fileName);
		});
	}
	catch (e){
		console.log('Failed during page creation', e);

		sendLambdaResponse({error: e}, 500);
	}
};
