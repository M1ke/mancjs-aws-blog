# Manchester JS Example - Blog Using AWS Lambda

The package consists of two main routes, each accessed separately as Lambda functions. Each could be a separate package but for ease of use/deployment they are both contained in the same repository.

The system allows posting to a blog-style website, served by static files in Amazon S3. In order to do this we have to be able to post blocks of markdown text which represent blog posts, and we need some authentication so that not just anybody can post on our blog.

There is future scope to expand the tool with the ability to delete blog posts (fairly simple) and edit existing posts (slightly more complicated). You could go further such as allowing images to be uploaded and embeded in the posts.

## Required installs

### nvm

    sudo apt-get update
    sudo apt-get install build-essential libssl-dev
    curl -sL https://raw.githubusercontent.com/creationix/nvm/v0.33.8/install.sh -o install_nvm.sh
    # Feel free to inspect this before running
    bash install_nvm.sh
    source ~/.profile
    nvm ls-remote
    nvm install 6.10.3
    nvm use 6.10.3

### AWS CLI

Using pip:

	pip install awscli --upgrade --user

Other install mechanisms can [be found here](https://docs.aws.amazon.com/cli/latest/userguide/installing.html)

Once installed

	aws configure

Enter your region (this tutorial assumes `eu-west-1`), access key/secret and return type (`json` is generally best)

### Terraform

Terraform is provided as a single binary for [many different operating systems](https://www.terraform.io/downloads.html)

E.g. on Linux (64 bit)

	cd /tmp
	curl https://releases.hashicorp.com/terraform/0.11.5/terraform_0.11.5_linux_amd64.zip > terraform.zip
	unzip terraform.zip
	chmod +x terraform
	sudo mv terraform /usr/local/bin/

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

### Testing locally

Run `npm install` first

We can run `bash run-test-post "My subject" "My post" "123456"` where the final argument is the code generated from our OTP generator.

The bash script calls `offline-post.js` using an environment variable to simulate Lambda's environment vars.

The AWS functions are stubed locally using `offline-aws.js` which allows an easy way to custom define different local behaviours for various AWS operations. For S3 these will often be simple file operations, but if we wanted to expand to use AWS Simple Email Service or Simple Notification Service to send emails or SMS messages we might want to stub these differently - maybe we'd write files, or send to a local email server such as mailcatcher.

## Setting up on AWS 

### IAM - permissions to use our account

All of the following services will require roles and policies generated inside AWS Identity and Access Management. Most will be generated by the console for you but it's good to know what these do, and what access they allow to your AWS account

### Lambda - where the function runs

* We upload our JS and associated resource files to Lambda, and set an entry point for a request
* To upload a package including node modules we must zip content and upload via the console
  * Use the shortcut `bash pack-to-deploy` in order to build this zip file

### API Gateway - provides mapping from HTTP to a function

* To allow our lambda funciton to be called we create an API gateway path to the function
* We determine how this request is routed
* We set up a domain name for it in Route53
* This process can be laborious for each path we want to generate!

### S3 - stores generated data and serves our website

* Bucket must have the same name as our domain name
* Enable public access to bucket (note, this means our private key must be in a different bucket)
* Set up a Route53 alias to the bucket
* If we wanted more robust HTTP web serving, e.g. HTTPS, caching we could put CloudFront in front of S3 and point our domain name there instead

## Automating the process

* Zipping JS files and uploading via web for each iteration is slow
* We can lose track of how different resources in our AWS account relate to each other
* Adding other features in future, such as DynamoDB databases for storing editable content, or CloudFront distributions for speeding up content delivery will further complicate managing through the console

A tool called Terraform can help us to manage our infrastructure as code.

* Each entity in our stack has a representation in our Terraform code
* Terraform will upload a zip file, but we still need to zip the code
* We can write a wrapper that compiles and packages our code before Terraform runs. Terraform will check the modification state of the zip file and redeploy if needed.

### Other automation tools

* Most popular is [Serverless](https://serverless.com/) which supports multiple providers and multiple languages. It assumes a whole serverless infrastructure, so unlike Terraform doesn't have separate options for managing your IAM users, DNS, S3 buckets etc. However for a pure serverless project it is more powerful. Underneath the hood it uses AWS CloudFormation stacks, which are similar in function to Terraform.
* [Serverless Application Model Local](https://github.com/awslabs/aws-sam-local) provides similar local functions to Serverless, but is written directly by AWS and provides pre-made mocks of: S3, DynamoDB, API Gateway and a few other mainline AWS services.