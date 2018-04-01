const fs = require('fs');

const awsDir = `${__dirname}/.aws`;
if (!fs.existsSync(awsDir)){
	fs.mkdirSync(awsDir);
}

exports.config = {
	region: ''
};

exports.S3 = function(opts){
	console.log('Creating S3 test stub');

	if (!opts.region && !exports.config.region){
		throw 'AWS region is not set';
	}

	const bucketDir = ((opts) => {
		if (!opts.params.Bucket){
			return '';
		}

		let bucket = opts.params.Bucket;
	 	let bucketDir = `${awsDir}/s3-${bucket}`;

		if (!fs.existsSync(bucketDir)){
			fs.mkdirSync(bucketDir);
		}

		return bucketDir;
	})(opts);

	return {
		getObject: (args, callback) => {
			try {
				var filePath = `${bucketDir}/${args.Key}`;
				var content = fs.readFileSync(filePath);
			}
			catch (e){
				callback({message: e});
				return;
			}

			callback(null, {Body: content});
		},
		upload: (args, callback) => {
			try {
				let filePath = `${bucketDir}/${args.Key}`;
				console.log(`Writing to file ${filePath}`);
				fs.writeFile(filePath, args.Body);
			}
			catch (e){
				callback({message: e});
				return;
			}

			callback();
		}
	};
};
