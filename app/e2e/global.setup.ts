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
  {
    path: "guides/setup.md",
    content: `---
title: Setup Guide
publish: true
tags: [guide]
---

# Setup Guide

A note nested under a "guides" folder, used to exercise the sidebar's
folder-expand behavior (folders have no page of their own).
`,
  },
  {
    path: "guides/deployment.md",
    content: `---
title: Deployment Guide
publish: true
tags: [guide]
---

# Deployment Guide

A second note in the "guides" folder, alongside [[setup]].
`,
  },
  {
    path: "guides/advanced/scaling.md",
    content: `---
title: Scaling Tips
publish: true
tags: [guide, advanced]
---

# Scaling Tips

Nested two levels deep, under "guides/advanced" — exercises multi-level
folder indentation in the sidebar.
`,
  },
  {
    path: "guides/advanced/security.md",
    content: `---
title: Security Hardening
publish: true
tags: [guide, advanced]
---

# Security Hardening

A second note under "guides/advanced".
`,
  },
  {
    path: "api/overview.md",
    content: `---
title: API Overview
publish: true
tags: [api]
---

# API Overview

A separate top-level folder from "guides", to show multiple sibling
folders in the sidebar.
`,
  },
  {
    path: "api/authentication.md",
    content: `---
title: Authentication
publish: true
tags: [api]
---

# Authentication

Covers login flows. See also [[api/overview]].
`,
  },
  {
    path: "recipes/pancakes.md",
    content: `---
title: Pancakes
publish: true
tags: [recipe]
---

# Pancakes

A third top-level folder, unrelated to the others, to show the sidebar
handling several independent folder trees at once.
`,
  },
  {
    path: "recipes/waffles.md",
    content: `---
title: Waffles
publish: true
tags: [recipe]
---

# Waffles

Another recipe note.
`,
  },
  {
    path: "changelog.md",
    content: `---
title: Changelog
publish: true
tags: [meta]
---

# Changelog

A flat top-level note (not in any folder) to show folders and flat
notes rendering side by side in the sidebar.
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
