export async function register() {
  // Only create tables in local dev (DYNAMODB_ENDPOINT points to DynamoDB Local).
  // In production, tables are managed by Terraform.
  if (!process.env.DYNAMODB_ENDPOINT) return;

  const { DynamoDBClient, CreateTableCommand, ResourceInUseException } =
    await import("@aws-sdk/client-dynamodb");

  const client = new DynamoDBClient({
    region: process.env.AWS_REGION ?? "us-east-1",
    endpoint: process.env.DYNAMODB_ENDPOINT,
    credentials: { accessKeyId: "local", secretAccessKey: "local" },
  });

  async function createTable(params: import("@aws-sdk/client-dynamodb").CreateTableCommandInput) {
    try {
      await client.send(new CreateTableCommand(params));
      console.log(`[db] created table: ${params.TableName}`);
    } catch (err) {
      if (err instanceof ResourceInUseException || (err as { name?: string }).name === "ResourceInUseException") {
        // Already exists — fine
      } else {
        throw err;
      }
    }
  }

  await createTable({
    TableName: process.env.DYNAMODB_USERS_TABLE ?? "pensieve-dev-users",
    BillingMode: "PAY_PER_REQUEST",
    AttributeDefinitions: [
      { AttributeName: "userId", AttributeType: "S" },
      { AttributeName: "email", AttributeType: "S" },
    ],
    KeySchema: [{ AttributeName: "userId", KeyType: "HASH" }],
    GlobalSecondaryIndexes: [
      {
        IndexName: "byEmail",
        KeySchema: [{ AttributeName: "email", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
      },
    ],
  });

  await createTable({
    TableName: process.env.DYNAMODB_LEXICONS_TABLE ?? "pensieve-dev-lexicons",
    BillingMode: "PAY_PER_REQUEST",
    AttributeDefinitions: [
      { AttributeName: "lexiconId", AttributeType: "S" },
      { AttributeName: "userId", AttributeType: "S" },
    ],
    KeySchema: [{ AttributeName: "lexiconId", KeyType: "HASH" }],
    GlobalSecondaryIndexes: [
      {
        IndexName: "byUser",
        KeySchema: [{ AttributeName: "userId", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
      },
    ],
  });
}
