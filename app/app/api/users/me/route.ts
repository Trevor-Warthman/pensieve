import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

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

function getTokenPayload(req: NextRequest): { sub: string; email: string } | null {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    return jwt.verify(auth.slice(7), JWT_SECRET) as { sub: string; email: string };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const payload = getTokenPayload(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await dynamo.send(new GetCommand({
    TableName: USERS_TABLE,
    Key: { userId: payload.sub },
  }));

  const user = result.Item as { userId: string; email: string; name?: string } | undefined;
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  return NextResponse.json({ email: user.email, name: user.name ?? null });
}

export async function PATCH(req: NextRequest) {
  const payload = getTokenPayload(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { name?: string; email?: string; currentPassword?: string; newPassword?: string };

  // Password change path
  if (body.newPassword !== undefined) {
    if (!body.currentPassword) {
      return NextResponse.json({ error: "currentPassword required" }, { status: 400 });
    }
    if (body.newPassword.length < 8) {
      return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });
    }

    const result = await dynamo.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: { userId: payload.sub },
    }));
    const user = result.Item as { passwordHash: string } | undefined;
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const valid = await bcrypt.compare(body.currentPassword, user.passwordHash);
    if (!valid) return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });

    const passwordHash = await bcrypt.hash(body.newPassword, 10);
    await dynamo.send(new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { userId: payload.sub },
      UpdateExpression: "SET passwordHash = :h",
      ExpressionAttributeValues: { ":h": passwordHash },
    }));

    return NextResponse.json({ ok: true });
  }

  // Profile update path (name and/or email)
  const updates: string[] = [];
  const values: Record<string, string> = {};

  if (body.name !== undefined) {
    updates.push("#n = :name");
    values[":name"] = body.name;
  }

  let newToken: string | undefined;

  if (body.email !== undefined && body.email !== payload.email) {
    // Check email not already taken
    const existing = await dynamo.send(new QueryCommand({
      TableName: USERS_TABLE,
      IndexName: "byEmail",
      KeyConditionExpression: "email = :email",
      ExpressionAttributeValues: { ":email": body.email },
      Limit: 1,
    }));
    if (existing.Items && existing.Items.length > 0) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }
    updates.push("email = :email");
    values[":email"] = body.email;
    newToken = jwt.sign({ sub: payload.sub, email: body.email }, JWT_SECRET, { expiresIn: "7d" });
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  await dynamo.send(new UpdateCommand({
    TableName: USERS_TABLE,
    Key: { userId: payload.sub },
    UpdateExpression: `SET ${updates.join(", ")}`,
    ExpressionAttributeNames: body.name !== undefined ? { "#n": "name" } : undefined,
    ExpressionAttributeValues: values,
  }));

  return NextResponse.json({ ok: true, ...(newToken && { accessToken: newToken }) });
}
