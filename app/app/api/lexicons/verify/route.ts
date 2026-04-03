import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import jwt from "jsonwebtoken";
import { pbkdf2Sync } from "crypto";

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

export async function POST(req: NextRequest) {
  const { slug, password } = await req.json() as { slug?: string; password?: string };
  if (!slug || !password) {
    return NextResponse.json({ error: "slug and password required" }, { status: 400 });
  }

  const result = await dynamo.send(new ScanCommand({
    TableName: LEXICONS_TABLE,
    FilterExpression: "slug = :slug AND (#s = :active OR attribute_not_exists(#s))",
    ExpressionAttributeNames: { "#s": "status" },
    ExpressionAttributeValues: { ":slug": slug, ":active": "active" },
  }));

  const lexicon = result.Items?.[0];
  if (!lexicon?.passwordHash) {
    return NextResponse.json({ error: "Not found or not password-protected" }, { status: 404 });
  }

  const [salt, storedHash] = (lexicon.passwordHash as string).split(":");
  const attemptHash = pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  if (attemptHash !== storedHash) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const token = jwt.sign({ lexiconSlug: slug }, JWT_SECRET, { expiresIn: "30d" });
  return NextResponse.json({ token });
}
