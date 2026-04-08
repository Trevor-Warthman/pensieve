import { NextRequest, NextResponse } from "next/server";
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const cognito = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION ?? "us-east-1" });
const CLIENT_ID = process.env.COGNITO_CLIENT_ID!;

// Local dev fallback: if COGNITO_CLIENT_ID is not set, proxy to local Lambda-like auth
const isLocal = !!process.env.DYNAMODB_ENDPOINT;

export async function POST(req: NextRequest) {
  const { email, password } = await req.json() as { email?: string; password?: string };
  if (!email || !password) {
    return NextResponse.json({ error: "email and password required" }, { status: 400 });
  }

  if (isLocal) {
    // Local dev: use local DynamoDB-backed auth (keep working for local development)
    const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
    const { DynamoDBDocumentClient, QueryCommand } = await import("@aws-sdk/lib-dynamodb");
    const { default: bcrypt } = await import("bcryptjs");
    const { default: jwt } = await import("jsonwebtoken");

    const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({
      region: process.env.AWS_REGION ?? "us-east-1",
      endpoint: process.env.DYNAMODB_ENDPOINT,
      credentials: { accessKeyId: "local", secretAccessKey: "local" },
    }));

    const result = await dynamo.send(new QueryCommand({
      TableName: process.env.DYNAMODB_USERS_TABLE!,
      IndexName: "byEmail",
      KeyConditionExpression: "email = :email",
      ExpressionAttributeValues: { ":email": email },
      Limit: 1,
    }));

    const user = result.Items?.[0] as { userId: string; email: string; passwordHash: string } | undefined;
    if (!user) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });

    const accessToken = jwt.sign({ sub: user.userId, email: user.email }, process.env.JWT_SECRET!, { expiresIn: "7d" });
    return NextResponse.json({ accessToken });
  }

  // Production: authenticate via Cognito
  try {
    const result = await cognito.send(new InitiateAuthCommand({
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: CLIENT_ID,
      AuthParameters: { USERNAME: email, PASSWORD: password },
    }));

    const tokens = result.AuthenticationResult;
    if (!tokens?.AccessToken) {
      return NextResponse.json({ error: "Authentication failed" }, { status: 401 });
    }

    return NextResponse.json({
      accessToken: tokens.AccessToken,
      refreshToken: tokens.RefreshToken,
      expiresIn: tokens.ExpiresIn,
    });
  } catch (err: unknown) {
    const name = err instanceof Error ? (err as Error & { name: string }).name : "";
    if (name === "NotAuthorizedException") {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    if (name === "UserNotConfirmedException") {
      return NextResponse.json({ error: "Email not verified. Check your inbox for a confirmation code." }, { status: 403 });
    }
    const message = err instanceof Error ? err.message : "Authentication error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
