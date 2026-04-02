import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import bcrypt from "bcryptjs";
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
const USERS_TABLE = process.env.DYNAMODB_USERS_TABLE!;
const JWT_SECRET = process.env.JWT_SECRET!;

export async function POST(req: NextRequest) {
  const { email, password } = await req.json() as { email?: string; password?: string };
  if (!email || !password) {
    return NextResponse.json({ error: "email and password required" }, { status: 400 });
  }

  // Check if email already exists (scan byEmail GSI — we'll just scan for now)
  const existing = await dynamo.send(new QueryCommand({
    TableName: USERS_TABLE,
    IndexName: "byEmail",
    KeyConditionExpression: "email = :email",
    ExpressionAttributeValues: { ":email": email },
    Limit: 1,
  }));
  if (existing.Items && existing.Items.length > 0) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  const userId = randomUUID();
  const passwordHash = await bcrypt.hash(password, 10);
  await dynamo.send(new PutCommand({
    TableName: USERS_TABLE,
    Item: { userId, email, passwordHash, createdAt: new Date().toISOString() },
  }));

  const accessToken = jwt.sign({ sub: userId, email }, JWT_SECRET, { expiresIn: "7d" });
  return NextResponse.json({ accessToken }, { status: 201 });
}
