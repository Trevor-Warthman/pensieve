import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

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
  const { userCode, accessToken, refreshToken, email } = await req.json() as {
    userCode?: string;
    accessToken?: string;
    refreshToken?: string;
    email?: string;
  };
  if (!userCode || !accessToken || !email) {
    return NextResponse.json({ error: "userCode, accessToken and email required" }, { status: 400 });
  }

  const now = Math.floor(Date.now() / 1000);
  const result = await dynamo.send(new QueryCommand({
    TableName: TABLE,
    IndexName: "byUserCode",
    KeyConditionExpression: "userCode = :userCode",
    ExpressionAttributeValues: { ":userCode": userCode },
  }));

  const item = result.Items?.[0];
  if (!item || item.expiresAt < now) {
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 404 });
  }
  if (item.status !== "pending") {
    return NextResponse.json({ error: "Code already used" }, { status: 409 });
  }

  await dynamo.send(new UpdateCommand({
    TableName: TABLE,
    Key: { deviceCode: item.deviceCode },
    UpdateExpression: "SET #s = :approved, accessToken = :at, refreshToken = :rt, email = :email",
    ExpressionAttributeNames: { "#s": "status" },
    ExpressionAttributeValues: {
      ":approved": "approved",
      ":at": accessToken,
      ":rt": refreshToken ?? null,
      ":email": email,
    },
  }));

  return NextResponse.json({ message: "Device approved" });
}
