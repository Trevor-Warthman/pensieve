import { NextRequest, NextResponse } from "next/server";
import {
  CognitoIdentityProviderClient,
  ConfirmSignUpCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const cognito = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION ?? "us-east-1" });
const CLIENT_ID = process.env.COGNITO_CLIENT_ID!;

const isLocal = !!process.env.DYNAMODB_ENDPOINT;

export async function POST(req: NextRequest) {
  const { email, code } = await req.json() as { email?: string; code?: string };
  if (!email || !code) {
    return NextResponse.json({ error: "email and code required" }, { status: 400 });
  }

  if (isLocal) {
    // Local dev: no email confirmation step needed (DynamoDB auth skips this)
    return NextResponse.json({ message: "Email confirmed. You can now log in." });
  }

  try {
    await cognito.send(new ConfirmSignUpCommand({
      ClientId: CLIENT_ID,
      Username: email,
      ConfirmationCode: code,
    }));

    return NextResponse.json({ message: "Email confirmed. You can now log in." });
  } catch (err: unknown) {
    const name = err instanceof Error ? (err as Error & { name: string }).name : "";
    if (name === "CodeMismatchException") {
      return NextResponse.json({ error: "Invalid confirmation code" }, { status: 400 });
    }
    if (name === "ExpiredCodeException") {
      return NextResponse.json({ error: "Confirmation code has expired. Please request a new one." }, { status: 400 });
    }
    if (name === "NotAuthorizedException") {
      return NextResponse.json({ error: "User is already confirmed" }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Confirmation error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
