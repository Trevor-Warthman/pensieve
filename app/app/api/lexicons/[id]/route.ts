import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, DeleteCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import jwt from "jsonwebtoken";

const isLocal = !!process.env.DYNAMODB_ENDPOINT;
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({
  region: process.env.AWS_REGION ?? "us-east-1",
  ...(isLocal && {
    endpoint: process.env.DYNAMODB_ENDPOINT,
    credentials: { accessKeyId: "local", secretAccessKey: "local" },
  }),
}));
const LEXICONS_TABLE = process.env.DYNAMODB_LEXICONS_TABLE!;
const JWT_SECRET = process.env.JWT_SECRET!;

function getUserId(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET) as { sub: string };
    return payload.sub;
  } catch {
    return null;
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await dynamo.send(new GetCommand({ TableName: LEXICONS_TABLE, Key: { lexiconId: id } }));
  if (!existing.Item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.Item.userId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { status } = await req.json() as { status?: "active" | "unpublished" };
  if (!status || !["active", "unpublished"].includes(status)) {
    return NextResponse.json({ error: "status must be 'active' or 'unpublished'" }, { status: 400 });
  }

  const result = await dynamo.send(new UpdateCommand({
    TableName: LEXICONS_TABLE,
    Key: { lexiconId: id },
    UpdateExpression: "SET #s = :status",
    ExpressionAttributeNames: { "#s": "status" },
    ExpressionAttributeValues: { ":status": status },
    ReturnValues: "ALL_NEW",
  }));
  return NextResponse.json(result.Attributes);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await dynamo.send(new GetCommand({ TableName: LEXICONS_TABLE, Key: { lexiconId: id } }));
  if (!existing.Item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.Item.userId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await dynamo.send(new DeleteCommand({ TableName: LEXICONS_TABLE, Key: { lexiconId: id } }));
  return new NextResponse(null, { status: 204 });
}
