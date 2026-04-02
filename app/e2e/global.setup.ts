/**
 * Playwright global setup — seeds DynamoDB Local + MinIO with a test lexicon
 * before the test suite runs.
 *
 * Test user:  userId=test-user-id
 * Lexicon:    slug=test-lexicon, lexiconId=test-lexicon-id
 * S3 prefix:  test-user-id/test-lexicon-id/
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client, PutObjectCommand, CreateBucketCommand, HeadBucketCommand } from "@aws-sdk/client-s3";

const DYNAMO_ENDPOINT = process.env.DYNAMODB_ENDPOINT ?? "http://localhost:8000";
const S3_ENDPOINT = process.env.AWS_S3_ENDPOINT ?? "http://localhost:9000";
const BUCKET = process.env.AWS_S3_BUCKET ?? "pensieve-local";
const LEXICONS_TABLE = process.env.DYNAMODB_LEXICONS_TABLE ?? "pensieve-dev-lexicons";
const USERS_TABLE = process.env.DYNAMODB_USERS_TABLE ?? "pensieve-dev-users";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({
  region: "us-east-1",
  endpoint: DYNAMO_ENDPOINT,
  credentials: { accessKeyId: "local", secretAccessKey: "local" },
}));

const s3 = new S3Client({
  region: "us-east-1",
  endpoint: S3_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "minioadmin",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "minioadmin",
  },
});

const TEST_USER_ID = "test-user-id";
const TEST_LEXICON_ID = "test-lexicon-id";
const TEST_LEXICON_SLUG = "test-lexicon";
const S3_PREFIX = `${TEST_USER_ID}/${TEST_LEXICON_ID}`;

const TEST_NOTES = [
  {
    path: "index.md",
    content: `---
title: Welcome
publish: true
tags: [intro]
---

# Welcome to the Test Lexicon

This is the home note. See also [[second-note]].
`,
  },
  {
    path: "second-note.md",
    content: `---
title: Second Note
publish: true
tags: [demo]
---

# Second Note

A second published note. Back to [[index]].
`,
  },
  {
    path: "hidden.md",
    content: `---
title: Hidden Note
publish: false
---

# Hidden

This note should not appear in the published list.
`,
  },
];

async function ensureBucket() {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
  }
}

async function seedDynamo() {
  await dynamo.send(new PutCommand({
    TableName: USERS_TABLE,
    Item: {
      userId: TEST_USER_ID,
      email: "test@example.com",
      passwordHash: "$2b$10$placeholderHashForTestUser000000000000",
      createdAt: new Date().toISOString(),
    },
  }));

  await dynamo.send(new PutCommand({
    TableName: LEXICONS_TABLE,
    Item: {
      lexiconId: TEST_LEXICON_ID,
      userId: TEST_USER_ID,
      slug: TEST_LEXICON_SLUG,
      title: "Test Lexicon",
      publishDefault: true,
      createdAt: new Date().toISOString(),
    },
  }));
}

async function seedMinIO() {
  for (const note of TEST_NOTES) {
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: `${S3_PREFIX}/${note.path}`,
      Body: note.content,
      ContentType: "text/markdown; charset=utf-8",
    }));
  }
}

export default async function globalSetup() {
  await ensureBucket();
  await Promise.all([seedDynamo(), seedMinIO()]);
  console.log(`\n[setup] Seeded DynamoDB + MinIO for test lexicon "/${TEST_LEXICON_SLUG}"\n`);
}
