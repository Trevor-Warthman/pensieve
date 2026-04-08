import { NextRequest, NextResponse } from "next/server";
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const cognito = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION ?? "us-east-1" });
const CLIENT_ID = process.env.COGNITO_CLIENT_ID!;

const isLocal = !!process.env.DYNAMODB_ENDPOINT;

export async function POST(req: NextRequest) {
  const { email, password } = await req.json() as { email?: string; password?: string };
  if (!email || !password) {
    return NextResponse.json({ error: "email and password required" }, { status: 400 });
  }

  if (isLocal) {
    // Local dev: use local DynamoDB-backed registration (keeps working without Cognito)
    const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
    const { DynamoDBDocumentClient, PutCommand, QueryCommand } = await import("@aws-sdk/lib-dynamodb");
    const { default: bcrypt } = await import("bcryptjs");
    const { default: jwt } = await import("jsonwebtoken");
    const { randomUUID } = await import("crypto");

    const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({
      region: process.env.AWS_REGION ?? "us-east-1",
      endpoint: process.env.DYNAMODB_ENDPOINT,
      credentials: { accessKeyId: "local", secretAccessKey: "local" },
    }));

    const existing = await dynamo.send(new QueryCommand({
      TableName: process.env.DYNAMODB_USERS_TABLE!,
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
      TableName: process.env.DYNAMODB_USERS_TABLE!,
      Item: { userId, email, passwordHash, createdAt: new Date().toISOString() },
    }));

    const accessToken = jwt.sign({ sub: userId, email }, process.env.JWT_SECRET!, { expiresIn: "7d" });
    return NextResponse.json({ accessToken }, { status: 201 });
  }

  // Production: register via Cognito
  try {
    await cognito.send(new SignUpCommand({
      ClientId: CLIENT_ID,
      Username: email,
      Password: password,
      UserAttributes: [{ Name: "email", Value: email }],
    }));

    return NextResponse.json(
      { message: "Registration successful. Check your email for a confirmation code." },
      { status: 200 }
    );
  } catch (err: unknown) {
    const name = err instanceof Error ? (err as Error & { name: string }).name : "";
    if (name === "UsernameExistsException") {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }
    if (name === "InvalidPasswordException") {
      return NextResponse.json({ error: "Password does not meet requirements (min 8 chars, 1 number)" }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Registration error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
