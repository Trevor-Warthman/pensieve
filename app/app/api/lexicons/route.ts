import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";

const isLocal = !!process.env.DYNAMODB_ENDPOINT;
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({
  region: process.env.AWS_REGION ?? "us-east-1",
  ...(isLocal && {
    endpoint: process.env.DYNAMODB_ENDPOINT,
    credentials: { accessKeyId: "local", secretAccessKey: "local" },
  }),
}));
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

export async function GET(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await dynamo.send(new QueryCommand({
    TableName: LEXICONS_TABLE,
    IndexName: "byUser",
    KeyConditionExpression: "userId = :uid",
    ExpressionAttributeValues: { ":uid": userId },
  }));
  return NextResponse.json({ lexicons: result.Items ?? [] });
}

export async function POST(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, title, publishDefault = true } = await req.json() as { slug?: string; title?: string; publishDefault?: boolean };
  if (!slug || !title) return NextResponse.json({ error: "slug and title required" }, { status: 400 });

  const item = {
    lexiconId: randomUUID(),
    userId,
    slug,
    title,
    publishDefault,
    createdAt: new Date().toISOString(),
  };
  await dynamo.send(new PutCommand({ TableName: LEXICONS_TABLE, Item: item }));
  return NextResponse.json(item, { status: 201 });
}
