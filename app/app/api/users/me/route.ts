import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import jwt from "jsonwebtoken";

const isLocal = !!process.env.DYNAMODB_ENDPOINT;

// DynamoDB client — used in both local and prod for profile storage
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({
  region: process.env.AWS_REGION ?? "us-east-1",
  ...(isLocal && {
    endpoint: process.env.DYNAMODB_ENDPOINT,
    credentials: { accessKeyId: "local", secretAccessKey: "local" },
  }),
}));
const USERS_TABLE = process.env.DYNAMODB_USERS_TABLE!;

// Cognito JWT verifier (prod only — imported lazily to avoid errors in local dev)
async function getCognitoVerifier() {
  const { CognitoJwtVerifier } = await import("aws-jwt-verify");
  return CognitoJwtVerifier.create({
    userPoolId: process.env.COGNITO_USER_POOL_ID!,
    tokenUse: "access",
    clientId: process.env.COGNITO_CLIENT_ID!,
  });
}

async function getTokenPayload(req: NextRequest): Promise<{ sub: string; email: string } | null> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);

  if (isLocal) {
    // Local dev: validate custom JWT
    try {
      return jwt.verify(token, process.env.JWT_SECRET!) as { sub: string; email: string };
    } catch {
      return null;
    }
  }

  // Production: validate Cognito access token
  try {
    const verifier = await getCognitoVerifier();
    const payload = await verifier.verify(token);
    // Cognito access tokens have `username` as email and `sub` as the user's UUID
    return { sub: payload.sub, email: payload.username ?? (payload as Record<string, string>)["cognito:username"] ?? "" };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const payload = await getTokenPayload(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (isLocal) {
    const result = await dynamo.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: { userId: payload.sub },
    }));
    const user = result.Item as { userId: string; email: string; name?: string } | undefined;
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    return NextResponse.json({ email: user.email, name: user.name ?? null });
  }

  // Production: Cognito is the source of truth for identity.
  // Return profile data from DynamoDB if it exists, otherwise synthesize from token.
  try {
    const result = await dynamo.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: { userId: payload.sub },
    }));
    const profile = result.Item as { email: string; name?: string } | undefined;
    return NextResponse.json({
      email: profile?.email ?? payload.email,
      name: profile?.name ?? null,
    });
  } catch {
    // DynamoDB unavailable — fall back to token data
    return NextResponse.json({ email: payload.email, name: null });
  }
}

export async function PATCH(req: NextRequest) {
  const payload = await getTokenPayload(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { name?: string };

  if (body.name === undefined) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  // Store profile data (name, etc.) in DynamoDB alongside Cognito sub as key
  await dynamo.send(new PutCommand({
    TableName: USERS_TABLE,
    Item: {
      userId: payload.sub,
      email: payload.email,
      name: body.name,
      updatedAt: new Date().toISOString(),
    },
  }));

  return NextResponse.json({ ok: true });
}
