const post = require('./post-to-blog');

var subject = process.argv[2];
var content = process.argv[3];
var auth = process.argv[4];

post.handler({body: `subject=${subject}&content=${content}&auth=${auth}`}, null, (status, response) => {
	console.log('Response sent to Lambda: ', response);
});
