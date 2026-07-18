import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { CognitoJwtVerifier } from "aws-jwt-verify";
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";

const s3 = new S3Client({});
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const BUCKET = process.env.S3_BUCKET!;
const LEXICONS_TABLE = process.env.DYNAMODB_LEXICONS_TABLE!;
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID!;
const CLIENT_ID = process.env.COGNITO_CLIENT_ID!;

const verifier = CognitoJwtVerifier.create({
  userPoolId: USER_POOL_ID,
  tokenUse: "access",
  clientId: CLIENT_ID,
});

function respond(status: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode: status,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  const auth = event.headers?.authorization ?? event.headers?.Authorization;
  if (!auth?.startsWith("Bearer ")) return respond(401, { error: "Unauthorized" });

  let userId: string;
  try {
    const payload = await verifier.verify(auth.slice(7));
    userId = payload.sub;
  } catch {
    return respond(401, { error: "Unauthorized" });
  }

  const body = event.body ? JSON.parse(event.body) : {};
  const { lexiconSlug, files, allPaths } = body as {
    lexiconSlug: string;
    files: Array<{ path: string; contentType?: string }>;
    allPaths?: string[];
  };

  if (!lexiconSlug || !Array.isArray(files)) {
    return respond(400, { error: "lexiconSlug and files[] required" });
  }

  // Verify user owns this lexicon slug
  const lexiconResult = await dynamo.send(new QueryCommand({
    TableName: LEXICONS_TABLE,
    IndexName: "byUser",
    KeyConditionExpression: "userId = :uid",
    FilterExpression: "slug = :slug",
    ExpressionAttributeValues: { ":uid": userId, ":slug": lexiconSlug },
  }));

  if (!lexiconResult.Items?.length) {
    return respond(404, { error: "Lexicon not found or not owned by user" });
  }

  const lexiconId = lexiconResult.Items[0].lexiconId;
  const prefix = `${userId}/${lexiconId}`;

  // Generate presigned upload URLs for each file (valid 15 min)
  const urls = await Promise.all(
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

  // Also return current S3 object list so CLI can diff
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

  // Delete objects that dropped out of the publishable set (unpublished,
  // renamed, or deleted locally). `allPaths` carries the *complete* set for
  // this sync on every chunked request (files[] is just this chunk's slice) --
  // diffing against files[] alone would treat every other chunk's paths as
  // orphaned and delete them. Older CLI versions that don't send allPaths
  // skip deletion entirely rather than risk deleting the wrong things.
  if (allPaths) {
    const sentPaths = new Set(allPaths);
    const orphanedKeys = Object.keys(existing).filter((relPath) => !sentPaths.has(relPath));
    for (let i = 0; i < orphanedKeys.length; i += 1000) {
      const batch = orphanedKeys.slice(i, i + 1000);
      await s3.send(new DeleteObjectsCommand({
        Bucket: BUCKET,
        Delete: { Objects: batch.map((relPath) => ({ Key: `${prefix}/${relPath}` })) },
      }));
    }
    for (const relPath of orphanedKeys) delete existing[relPath];
  }

  return respond(200, { uploadUrls: urls, existing });
};
