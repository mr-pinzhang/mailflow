import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { createStorage } from "./storage";
import { createQueues } from "./queues";
import { createDatabaseTables } from "./database";
import { createLambdaRole, createApiLambdaRole } from "./iam";
import { createLambdaFunction, createApiLambda } from "./lambda";
import { createSesConfiguration } from "./ses";
import { createMonitoring } from "./monitoring";
import { createApiGateway } from "./api";
import { createDashboard } from "./dashboard";

// Load configuration
const config = new pulumi.Config();
const environment = config.require("environment");
const domains = config.requireObject<string[]>("domains");
const apps = config.requireObject<string[]>("apps");
const allowedSenderDomains = config.getObject<string[]>("allowedSenderDomains") || [];
const jwtIssuer = config.get("jwtIssuer") || "mailflow";
const dashboardDomain = config.get("dashboardDomain");
const dashboardApiDomain = config.get("dashboardApiDomain");
const certArn = config.get("certArn");

console.log(`Deploying Mailflow infrastructure for environment: ${environment}`);
console.log(`Apps: ${apps.join(", ")}`);
console.log(`Domains: ${domains.join(", ")}`);
if (allowedSenderDomains.length > 0) {
    console.log(`Allowed sender domains: ${allowedSenderDomains.join(", ")}`);
}

// 1. Create S3 storage
const storage = createStorage(environment);

// 2. Create SQS queues
const queues = createQueues(environment, apps);

// 3. Create DynamoDB tables
const database = createDatabaseTables(environment);
export const testHistoryTableName = database.testHistoryTable.name;

// 4. Create IAM role for Lambda
const allQueueArns = [
    queues.outboundQueue.arn,
    queues.defaultQueue.arn,
    queues.dlq.arn,
    ...Object.values(queues.appQueues).map((q) => q.arn),
];

const iam = createLambdaRole(
    environment,
    storage.bucket.arn,
    storage.attachmentsBucket.arn,
    allQueueArns,
    database.idempotencyTable.arn
);

// 5. Create Lambda function
const lambda = createLambdaFunction({
    role: iam.role,
    rawEmailsBucket: storage.bucket,
    attachmentsBucket: storage.attachmentsBucket,
    appQueues: queues.appQueues,
    outboundQueue: queues.outboundQueue,
    defaultQueue: queues.defaultQueue,
    dlq: queues.dlq,
    idempotencyTable: database.idempotencyTable,
    domains,
    allowedSenderDomains,
    environment,
});

// 6. Configure SES
const ses = createSesConfiguration({
    lambdaFunction: lambda.function,
    rawEmailsBucket: storage.bucket,
    domains,
    environment,
});

// 7. Create monitoring and alarms
const monitoring = createMonitoring({
    lambdaFunction: lambda.function,
    dlq: queues.dlq,
    environment,
});

// 8. Create API Lambda for dashboard
const region = aws.getRegionOutput().name;
const accountId = aws.getCallerIdentityOutput().accountId;

const apiIam = createApiLambdaRole(
    environment,
    allQueueArns,
    [storage.bucket.arn, storage.attachmentsBucket.arn],
    [database.idempotencyTable.arn, database.testHistoryTable.arn],
    region,
    accountId
);

const apiLambda = createApiLambda({
    role: apiIam.role,
    environment,
    jwtIssuer,
    outboundQueueUrl: queues.outboundQueue.url,
    testHistoryTableName: database.testHistoryTable.name,
    allowedDomains: domains,
});

// 9. Create API Gateway
const api = createApiGateway({
    apiLambda: apiLambda.function,
    environment,
    customDomain: dashboardApiDomain,
    certArn,
});

// 10. Create Dashboard (S3 + CloudFront)
const dashboard = createDashboard({
    apiUrl: api.apiUrl,
    environment,
    customDomain: dashboardDomain,
    certArn,
});

// Exports
export const lambdaFunctionName = lambda.function.name;
export const lambdaFunctionArn = lambda.function.arn;
export const rawEmailsBucketName = storage.bucket.bucket;
export const outboundQueueUrl = queues.outboundQueue.url;
export const defaultQueueUrl = queues.defaultQueue.url;
export const dlqUrl = queues.dlq.url;
export const idempotencyTableName = database.idempotencyTable.name;

// Export app queue URLs
export const appQueueUrls = pulumi.output(
    Object.entries(queues.appQueues).reduce(
        (acc, [appName, queue]) => {
            acc[appName] = queue.url;
            return acc;
        },
        {} as Record<string, pulumi.Output<string>>
    )
);

// Export app queue names for easy reference
export const appQueueNames = Object.keys(queues.appQueues);

// Dashboard exports
export const apiLambdaName = apiLambda.function.name;
export const apiUrl = api.apiUrl;
export const dashboardUrl = dashboard.dashboardUrl;
export const dashboardBucketName = dashboard.bucket.bucket;
export const cdnDistributionId = dashboard.cdn.id;

// Custom domain exports (if configured)
export const dashboardDomainConfigured = dashboardDomain || "not configured";
export const dashboardApiDomainConfigured = dashboardApiDomain || "not configured";
export const cloudfrontDomainName = dashboard.cloudfrontDomainName;
export const apiGatewayDomainTarget = api.apiDomainTarget;

// Summary
export const summary = pulumi.all([
    lambda.function.name,
    apiLambda.function.name,
    storage.bucket.bucket,
    queues.outboundQueue.name,
    dashboard.dashboardUrl,
    api.apiUrl,
    dashboard.cloudfrontDomainName,
    api.apiDomainTarget
]).apply(([workerLambda, apiLambdaFunc, rawBucket, outboundQ, dashUrl, apiUrlVal, cfDomain, apiTarget]) => {
    let dnsInstructions = "";

    if (dashboardDomain) {
        dnsInstructions += `\nDNS Configuration Required:\n`;
        dnsInstructions += `  Dashboard Domain (${dashboardDomain}):\n`;
        dnsInstructions += `    Create CNAME record: ${dashboardDomain} -> ${cfDomain}\n`;
    }

    if (dashboardApiDomain && apiTarget) {
        if (!dnsInstructions) dnsInstructions += `\nDNS Configuration Required:\n`;
        dnsInstructions += `  API Domain (${dashboardApiDomain}):\n`;
        dnsInstructions += `    Create CNAME record: ${dashboardApiDomain} -> ${apiTarget}\n`;
    }

    return `
Mailflow Infrastructure Deployed Successfully!

Environment: ${environment}
Apps: ${appQueueNames.join(", ")}
Domains: ${domains.join(", ")}

Worker Lambda: ${workerLambda}
API Lambda: ${apiLambdaFunc}
Raw Emails Bucket: ${rawBucket}
Outbound Queue: ${outboundQ}

Dashboard URL: https://${dashUrl}
API URL: https://${apiUrlVal}
${dnsInstructions}
To deploy dashboard:
  make dashboard-build dashboard-deploy

To send test email:
  aws ses send-email --from test@${domains[0]} --destination ToAddresses=_${appQueueNames[0]}@${domains[0]} --message "Subject={Data=Test},Body={Text={Data=Hello}}"

To check app queue:
  aws sqs receive-message --queue-url <queue-url>

To access dashboard:
  1. Open https://${dashUrl}
  2. Get JWT token from your identity provider
  3. Set Authorization header: Bearer <token>
`;
});
