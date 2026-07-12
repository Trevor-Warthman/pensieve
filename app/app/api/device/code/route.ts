import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID, randomInt } from "crypto";

const isLocal = !!process.env.DYNAMODB_ENDPOINT;
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({
  region: process.env.AWS_REGION ?? "us-east-1",
  ...(isLocal && {
    endpoint: process.env.DYNAMODB_ENDPOINT,
    credentials: { accessKeyId: "local", secretAccessKey: "local" },
  }),
}));
const TABLE = process.env.DYNAMODB_DEVICE_CODES_TABLE ?? "pensieve-dev-device-codes";

const EXPIRES_IN = 600; // seconds
const INTERVAL = 5; // seconds
const USER_CODE_CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // no 0/O/1/I/L

function generateUserCode(): string {
  let code = "";
  for (let i = 0; i < 8; i++) {
    if (i === 4) code += "-";
    code += USER_CODE_CHARS[randomInt(USER_CODE_CHARS.length)];
  }
  return code;
}

export async function POST(req: NextRequest) {
  const deviceCode = randomUUID();
  const userCode = generateUserCode();
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + EXPIRES_IN;

  await dynamo.send(new PutCommand({
    TableName: TABLE,
    Item: { deviceCode, userCode, status: "pending", expiresAt },
  }));

  const origin = req.nextUrl.origin;

  return NextResponse.json({
    deviceCode,
    userCode,
    verificationUri: `${origin}/device`,
    verificationUriComplete: `${origin}/device?code=${encodeURIComponent(userCode)}`,
    expiresIn: EXPIRES_IN,
    interval: INTERVAL,
  });
}
