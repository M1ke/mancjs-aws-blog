resource "aws_s3_bucket" "blog" {
  bucket = "${var.blog_domain}"
  acl    = "public-read"

  website {
    index_document = "index.html"
  }

  versioning {
    enabled = true
  }
}

resource "aws_s3_bucket_policy" "blog" {
  bucket = "${aws_s3_bucket.blog.id}"
  policy =  <<POLICY
{
  "Version": "2008-10-17",
  "Id": "MancJsBlogPolicy",
  "Statement": [
    {
      "Sid": "AllowAccessStmt",
      "Effect": "Allow",
      "Principal": {
        "AWS": "*"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::${aws_s3_bucket.blog.bucket}/*"
    }
  ]
}
POLICY
}

resource "aws_iam_role" "api-gateway-logs" {
  name = "api-gateway-logs"
  description = "Allows API Gateway to push logs to CloudWatch Logs."
  assume_role_policy = <<POLICY
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "",
      "Effect": "Allow",
      "Principal": {
        "Service": "apigateway.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
POLICY
}

resource "aws_iam_role_policy_attachment" "api-gateway-logs-cloudwatch" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs"
  role = "${aws_iam_role.api-gateway-logs.name}"
}

resource "aws_iam_role" "mancjs-post-blog" {
  name = "mancjs-post-blog"
  assume_role_policy = <<POLICY
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
POLICY
}

resource "aws_iam_role_policy" "mancjs-post-blog-policy" {
  name = "mancjs-post-blog-policy"
  role = "${aws_iam_role.mancjs-post-blog.name}"
  policy = <<POLICY
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "MancjsLogging",
            "Effect": "Allow",
            "Action": [
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ],
            "Resource": "arn:aws:logs:*:*:*"
        },
        {
            "Sid": "MancjsLoggingCreate",
            "Effect": "Allow",
            "Action": "logs:CreateLogGroup",
            "Resource": "arn:aws:logs:*:*:*"
        },
        {
            "Sid": "MancjsS3",
            "Effect": "Allow",
            "Action": "s3:*",
            "Resource": [
                "arn:aws:s3:::${aws_s3_bucket.blog.bucket}",
                "arn:aws:s3:::${aws_s3_bucket.blog.bucket}/*"
            ]
        }
    ]
}
POLICY
}

data "aws_route53_zone" "blog" {
  name         = "${var.domain}."
}

resource "aws_route53_record" "blog" {
  zone_id = "${data.aws_route53_zone.blog.zone_id}"
  name    = "${var.blog_domain}"
  type    = "A"

  alias {
    evaluate_target_health = false
    name = "${aws_s3_bucket.blog.website_domain}"
    zone_id = "${aws_s3_bucket.blog.hosted_zone_id}"
  }
}

resource "aws_api_gateway_account" "blog" {
  cloudwatch_role_arn = "${aws_iam_role.api-gateway-logs.arn}"
}

resource "aws_api_gateway_rest_api" "blog" {
  name        = "mancjs-blog"
}

resource "aws_api_gateway_resource" "blog-post" {
  rest_api_id = "${aws_api_gateway_rest_api.blog.id}"
  parent_id   = "${aws_api_gateway_rest_api.blog.root_resource_id}"
  path_part   = "post"
}

resource "aws_api_gateway_method" "blog-post-post" {
  rest_api_id   = "${aws_api_gateway_rest_api.blog.id}"
  resource_id   = "${aws_api_gateway_resource.blog-post.id}"
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "blog-post-lambda" {
  rest_api_id             = "${aws_api_gateway_rest_api.blog.id}"
  resource_id             = "${aws_api_gateway_resource.blog-post.id}"
  http_method             = "${aws_api_gateway_method.blog-post-post.http_method}"
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:eu-west-1:lambda:path/2015-03-31/functions/${aws_lambda_function.mancjs-post-blog.arn}/invocations"
}

resource "aws_api_gateway_method_response" "blog-post-200" {
  rest_api_id = "${aws_api_gateway_rest_api.blog.id}"
  resource_id = "${aws_api_gateway_resource.blog-post.id}"
  http_method = "${aws_api_gateway_method.blog-post-post.http_method}"
  status_code = "200"
  response_parameters = { "method.response.header.access-control-allow-origin" = true }
}

resource "aws_api_gateway_deployment" "blog-production" {
  depends_on = ["aws_api_gateway_integration.blog-post-lambda"]

  rest_api_id = "${aws_api_gateway_rest_api.blog.id}"
  stage_name  = "production"
}

resource "aws_lambda_function" "mancjs-post-blog" {
  filename         = "../mancjs-aws-lambda.zip"
  function_name    = "mancjs-post-blog"
  role             = "${aws_iam_role.mancjs-post-blog.arn}"
  handler          = "post-to-blog.handler"
  runtime          = "nodejs6.10"
  source_code_hash = "${base64sha256(file("../mancjs-aws-lambda.zip"))}"

  environment {
    variables = {
      BUCKET = "${var.blog_domain}"
    }
  }
}

resource "aws_lambda_permission" "apigw_lambda" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = "${aws_lambda_function.mancjs-post-blog.arn}"
  principal     = "apigateway.amazonaws.com"

  # More: http://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-control-access-using-iam-policies-to-invoke-api.html
  source_arn = "arn:aws:execute-api:eu-west-1:${var.aws_id}:${aws_api_gateway_rest_api.blog.id}/*/${aws_api_gateway_method.blog-post-post.http_method}${aws_api_gateway_resource.blog-post.path}"
}

output "url" {
  value = "${aws_api_gateway_deployment.blog-production.invoke_url}"
}