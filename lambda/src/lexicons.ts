import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
  UpdateCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { CognitoJwtVerifier } from "aws-jwt-verify";
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { randomUUID } from "crypto";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const LEXICONS_TABLE = process.env.DYNAMODB_LEXICONS_TABLE!;
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID!;
const CLIENT_ID = process.env.COGNITO_CLIENT_ID!;

const verifier = CognitoJwtVerifier.create({
  userPoolId: USER_POOL_ID,
  tokenUse: "access",
  clientId: CLIENT_ID,
});

function respond(status: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode: status,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

async function getUserId(event: APIGatewayProxyEventV2): Promise<string | null> {
  const auth = event.headers?.authorization ?? event.headers?.Authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    const payload = await verifier.verify(auth.slice(7));
    return payload.sub;
  } catch {
    return null;
  }
}

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  const userId = await getUserId(event);
  if (!userId) return respond(401, { error: "Unauthorized" });

  const method = event.requestContext.http.method;
  const lexiconId = event.pathParameters?.id;
  const body = event.body ? JSON.parse(event.body) : {};

  try {
    if (method === "GET") {
      const result = await dynamo.send(new QueryCommand({
        TableName: LEXICONS_TABLE,
        IndexName: "byUser",
        KeyConditionExpression: "userId = :uid",
        ExpressionAttributeValues: { ":uid": userId },
      }));
      return respond(200, { lexicons: result.Items ?? [] });
    }

    if (method === "POST") {
      const { slug, title, publishDefault = true } = body;
      if (!slug || !title) return respond(400, { error: "slug and title required" });

      const item = {
        lexiconId: randomUUID(),
        userId,
        slug,
        title,
        publishDefault,
        createdAt: new Date().toISOString(),
      };
      await dynamo.send(new PutCommand({ TableName: LEXICONS_TABLE, Item: item }));
      return respond(201, item);
    }

    if (method === "PATCH" && lexiconId) {
      const existing = await dynamo.send(new GetCommand({
        TableName: LEXICONS_TABLE,
        Key: { lexiconId },
      }));
      if (!existing.Item) return respond(404, { error: "Not found" });
      if (existing.Item.userId !== userId) return respond(403, { error: "Forbidden" });

      const { status } = body as { status?: string };
      if (!status || !["active", "unpublished"].includes(status)) {
        return respond(400, { error: "status must be 'active' or 'unpublished'" });
      }

      const result = await dynamo.send(new UpdateCommand({
        TableName: LEXICONS_TABLE,
        Key: { lexiconId },
        UpdateExpression: "SET #s = :status",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":status": status },
        ReturnValues: "ALL_NEW",
      }));
      return respond(200, result.Attributes);
    }

    if (method === "DELETE" && lexiconId) {
      // Verify ownership before deleting
      const existing = await dynamo.send(new GetCommand({
        TableName: LEXICONS_TABLE,
        Key: { lexiconId },
      }));
      if (!existing.Item) return respond(404, { error: "Not found" });
      if (existing.Item.userId !== userId) return respond(403, { error: "Forbidden" });

      await dynamo.send(new DeleteCommand({
        TableName: LEXICONS_TABLE,
        Key: { lexiconId },
      }));
      return respond(204, null);
    }

    return respond(404, { error: "Not found" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return respond(500, { error: message });
  }
};
