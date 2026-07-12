import {
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { randomUUID, randomInt } from "crypto";
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.DYNAMODB_DEVICE_CODES_TABLE!;
const APP_URL = process.env.APP_URL!;

const EXPIRES_IN = 600; // seconds
const INTERVAL = 5; // seconds
const USER_CODE_CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // no 0/O/1/I/L

function respond(status: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode: status,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function generateUserCode(): string {
  let code = "";
  for (let i = 0; i < 8; i++) {
    if (i === 4) code += "-";
    code += USER_CODE_CHARS[randomInt(USER_CODE_CHARS.length)];
  }
  return code;
}

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  const path = event.rawPath;
  const body = event.body ? JSON.parse(event.body) : {};

  try {
    if (path === "/device/code") {
      const deviceCode = randomUUID();
      const userCode = generateUserCode();
      const now = Math.floor(Date.now() / 1000);
      const expiresAt = now + EXPIRES_IN;

      await ddb.send(new PutCommand({
        TableName: TABLE,
        Item: { deviceCode, userCode, status: "pending", expiresAt },
      }));

      return respond(200, {
        deviceCode,
        userCode,
        verificationUri: `${APP_URL}/device`,
        verificationUriComplete: `${APP_URL}/device?code=${encodeURIComponent(userCode)}`,
        expiresIn: EXPIRES_IN,
        interval: INTERVAL,
      });
    }

    if (path === "/device/verify") {
      const { userCode, accessToken, refreshToken, email } = body;
      if (!userCode || !accessToken || !email) {
        return respond(400, { error: "userCode, accessToken and email required" });
      }

      const now = Math.floor(Date.now() / 1000);
      const result = await ddb.send(new QueryCommand({
        TableName: TABLE,
        IndexName: "byUserCode",
        KeyConditionExpression: "userCode = :userCode",
        ExpressionAttributeValues: { ":userCode": userCode },
      }));

      const item = result.Items?.[0];
      if (!item || item.expiresAt < now) {
        return respond(404, { error: "Invalid or expired code" });
      }
      if (item.status !== "pending") {
        return respond(409, { error: "Code already used" });
      }

      await ddb.send(new UpdateCommand({
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

      return respond(200, { message: "Device approved" });
    }

    if (path === "/device/token") {
      const { deviceCode } = body;
      if (!deviceCode) return respond(400, { error: "deviceCode required" });

      const now = Math.floor(Date.now() / 1000);
      const result = await ddb.send(new GetCommand({
        TableName: TABLE,
        Key: { deviceCode },
      }));

      const item = result.Item;
      if (!item || item.expiresAt < now) {
        return respond(400, { error: "expired_token" });
      }
      if (item.status === "pending") {
        return respond(400, { error: "authorization_pending" });
      }

      // One-time read: delete immediately after handing off tokens.
      await ddb.send(new DeleteCommand({ TableName: TABLE, Key: { deviceCode } }));

      return respond(200, {
        accessToken: item.accessToken,
        refreshToken: item.refreshToken ?? undefined,
        email: item.email,
      });
    }

    return respond(404, { error: "Not found" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return respond(500, { error: message });
  }
};
