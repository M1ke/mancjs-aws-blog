# Manchester JS Example - Blog Using AWS Lambda

The package consists of two main routes, each accessed separately as Lambda functions. Each could be a separate package but for ease of use/deployment they are both contained in the same repository.

The system allows posting to a blog-style website, served by static files in Amazon S3. In order to do this we have to be able to post blocks of markdown text which represent blog posts, and we need some authentication so that not just anybody can post on our blog.

There is future scope to expand the tool with the ability to delete blog posts (fairly simple) and edit existing posts (slightly more complicated). You could go further such as allowing images to be uploaded and embeded in the posts.

## Authentication

Even in example systems we should make sure we have some method to authenticate users - you never know when an example ends up in real life usage!

For a blog with one user it would be overkill to design an entire user management system, emails, passwords etc. Instead we can use a common authtication paradigm, that of time based one time passwords, as a simple auth mechanism.

The system will resolve around a single private key, which can both be used to derive one time passwords, and which we can use to generate a temporary authentication token. The system will need to store this key somewhere, so we can upload it to S3, then fetch from there when we use the key.

### Initiating our one time password

* Run `offline-otp-gen.js` and input the generated code in to your OTP device (e.g. Google Authenticator)
* Run `offline-otp-gen.js --key NUMBER` where the NUMBER is generated from your authentication app
* Upload the generated `private-key` file to an S3 bucket

### Checking our one time password

Our function will follow a simple pattern:

* Check an input request from the user for a numeric code
* Fetch the key from S3
* Check the entered code matches the current time code from the key
* Return a string known as a JSON web token for further requests to use

## Posting to the blog

The blog takes a simple structure:

* index.html - lists blog titles along with a date and link to view
* DATE-TITLE.html - shows a blog post

We make some assumptions with this format:

* New posts always take place date-wise after previous posts
* Post titles will not change
* Posts will not be deleted

Working on these assumptions then our post function needs to do the following:

* Confirm user is authenticated
* Generate a HTML page with the new blog content
* Add the date, title and link to the index page

To generate a HTML page and the index we will need template pages, with placeholders where our generated list will be filled.

To subsequently edit the index we can use the same template page, fetch the previous index, pull out the list and amend it to the template. This would let us redesign our index page.

Our HTML pages can link locally to JS/CSS files, which we assume will be accessible in the root of the same S3 bucket. Deploying these will be handled separately.

### Setting up on Lambda

* We upload our JS and associated resource files to Lambda, and set an entry point for a request
* To upload a package including node modules we must zip content and upload via the console

### Setting up on API Gateway

* To allow our lambda funciton to be called we create an API gateway path to the function
* We determine how this request is routed
* We set up a domain name for it in Route53

### Setting up S3 for public web access

* Bucket must have the same name as our domain name
* Enable public access to bucket (note, this means our private key must be in a different bucket)
* Set up a Route53 alias to the bucket

## Automating the process

* Zipping JS files and uploading via web for each iteration is slow
* We can lose track of how different resources in our AWS account relate to each other
* Adding other features in future, such as DynamoDB databases for storing editable content, or CloudFront distributions for speeding up content delivery will further complicate managing through the console

A tool called Terraform can help us to manage our infrastructure as code.

* Each entity in our stack has a representation in our Terraform code
* Terraform will upload a zip file, but we still need to zip the code
* We can write a wrapper that compiles and packages our code before Terraform runs. Terraform will check the modification state of the zip file and redeploy if needed.