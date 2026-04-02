import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import jwt from "jsonwebtoken";

const isLocal = !!process.env.DYNAMODB_ENDPOINT;
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({
  region: process.env.AWS_REGION ?? "us-east-1",
  ...(isLocal && {
    endpoint: process.env.DYNAMODB_ENDPOINT,
    credentials: { accessKeyId: "local", secretAccessKey: "local" },
  }),
}));

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? "us-east-1",
  ...(process.env.AWS_S3_ENDPOINT && {
    endpoint: process.env.AWS_S3_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "local",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "local",
    },
  }),
});

const BUCKET = process.env.AWS_S3_BUCKET!;
const LEXICONS_TABLE = process.env.DYNAMODB_LEXICONS_TABLE!;
const JWT_SECRET = process.env.JWT_SECRET!;

function getUserId(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET) as { sub: string };
    return payload.sub;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { lexiconSlug?: string; files?: Array<{ path: string; contentType?: string }> };
  const { lexiconSlug, files } = body;

  if (!lexiconSlug || !Array.isArray(files)) {
    return NextResponse.json({ error: "lexiconSlug and files[] required" }, { status: 400 });
  }

  const lexiconResult = await dynamo.send(new QueryCommand({
    TableName: LEXICONS_TABLE,
    IndexName: "byUser",
    KeyConditionExpression: "userId = :uid",
    FilterExpression: "slug = :slug",
    ExpressionAttributeValues: { ":uid": userId, ":slug": lexiconSlug },
  }));

  if (!lexiconResult.Items?.length) {
    return NextResponse.json({ error: "Lexicon not found or not owned by user" }, { status: 404 });
  }

  const lexiconId = lexiconResult.Items[0].lexiconId;
  const prefix = `${userId}/${lexiconId}`;

  const uploadUrls = await Promise.all(
    files.map(async (file) => {
      const key = `${prefix}/${file.path.replace(/^\//, "")}`;
      const url = await getSignedUrl(
        s3,
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: key,
          ContentType: file.contentType ?? "text/markdown; charset=utf-8",
        }),
        { expiresIn: 900 }
      );
      return { path: file.path, uploadUrl: url, key };
    })
  );

  const existing: Record<string, string> = {};
  let token: string | undefined;
  do {
    const list = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix,
      ContinuationToken: token,
    }));
    for (const obj of list.Contents ?? []) {
      if (obj.Key && obj.ETag) existing[obj.Key.replace(`${prefix}/`, "")] = obj.ETag;
    }
    token = list.NextContinuationToken;
  } while (token);

  return NextResponse.json({ uploadUrls, existing });
}
