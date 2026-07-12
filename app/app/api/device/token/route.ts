import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";

const isLocal = !!process.env.DYNAMODB_ENDPOINT;
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({
  region: process.env.AWS_REGION ?? "us-east-1",
  ...(isLocal && {
    endpoint: process.env.DYNAMODB_ENDPOINT,
    credentials: { accessKeyId: "local", secretAccessKey: "local" },
  }),
}));
const TABLE = process.env.DYNAMODB_DEVICE_CODES_TABLE ?? "pensieve-dev-device-codes";

export async function POST(req: NextRequest) {
  const { deviceCode } = await req.json() as { deviceCode?: string };
  if (!deviceCode) return NextResponse.json({ error: "deviceCode required" }, { status: 400 });

  const now = Math.floor(Date.now() / 1000);
  const result = await dynamo.send(new GetCommand({ TableName: TABLE, Key: { deviceCode } }));

  const item = result.Item;
  if (!item || item.expiresAt < now) {
    return NextResponse.json({ error: "expired_token" }, { status: 400 });
  }
  if (item.status === "pending") {
    return NextResponse.json({ error: "authorization_pending" }, { status: 400 });
  }

  // One-time read: delete immediately after handing off tokens.
  await dynamo.send(new DeleteCommand({ TableName: TABLE, Key: { deviceCode } }));

  return NextResponse.json({
    accessToken: item.accessToken,
    refreshToken: item.refreshToken ?? undefined,
    email: item.email,
  });
}
