import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, DeleteCommand, UpdateCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import jwt from "jsonwebtoken";
import { pbkdf2Sync, randomBytes } from "crypto";

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

  const body = await req.json() as {
    status?: "active" | "unpublished";
    title?: string;
    description?: string | null;
    publishDefault?: boolean;
    slug?: string;
    password?: string | null;
    sortOrder?: number;
  };

  // Validate individual fields
  if (body.status !== undefined && !["active", "unpublished"].includes(body.status)) {
    return NextResponse.json({ error: "status must be 'active' or 'unpublished'" }, { status: 400 });
  }
  if (body.slug !== undefined) {
    if (!/^[a-z0-9-]+$/.test(body.slug)) {
      return NextResponse.json({ error: "slug must be lowercase letters, numbers, and hyphens" }, { status: 400 });
    }
    if (body.slug !== existing.Item.slug) {
      const taken = await dynamo.send(new ScanCommand({
        TableName: LEXICONS_TABLE,
        FilterExpression: "slug = :slug",
        ExpressionAttributeValues: { ":slug": body.slug },
      }));
      if ((taken.Items?.length ?? 0) > 0) {
        return NextResponse.json({ error: "Slug already taken" }, { status: 409 });
      }
    }
  }

  // Build dynamic UpdateExpression
  const sets: string[] = [];
  const removes: string[] = [];
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};

  if (body.status !== undefined) {
    sets.push("#status = :status");
    names["#status"] = "status";
    values[":status"] = body.status;
  }
  if (body.title !== undefined && body.title.trim()) {
    sets.push("#title = :title");
    names["#title"] = "title";
    values[":title"] = body.title.trim();
  }
  if (body.description !== undefined) {
    if (body.description === null || body.description === "") {
      removes.push("#description");
      names["#description"] = "description";
    } else {
      sets.push("#description = :description");
      names["#description"] = "description";
      values[":description"] = body.description.trim();
    }
  }
  if (body.publishDefault !== undefined) {
    sets.push("#pd = :pd");
    names["#pd"] = "publishDefault";
    values[":pd"] = body.publishDefault;
  }
  if (body.slug !== undefined) {
    sets.push("#slug = :slug");
    names["#slug"] = "slug";
    values[":slug"] = body.slug;
  }
  if (body.password !== undefined) {
    if (body.password === null) {
      removes.push("#passwordHash");
      names["#passwordHash"] = "passwordHash";
    } else {
      const salt = randomBytes(16).toString("hex");
      const hash = pbkdf2Sync(body.password, salt, 100000, 64, "sha512").toString("hex");
      sets.push("#passwordHash = :passwordHash");
      names["#passwordHash"] = "passwordHash";
      values[":passwordHash"] = `${salt}:${hash}`;
    }
  }
  if (body.sortOrder !== undefined) {
    sets.push("#sortOrder = :sortOrder");
    names["#sortOrder"] = "sortOrder";
    values[":sortOrder"] = body.sortOrder;
  }

  if (sets.length === 0 && removes.length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  let UpdateExpression = "";
  if (sets.length > 0) UpdateExpression += `SET ${sets.join(", ")}`;
  if (removes.length > 0) UpdateExpression += ` REMOVE ${removes.join(", ")}`;

  const result = await dynamo.send(new UpdateCommand({
    TableName: LEXICONS_TABLE,
    Key: { lexiconId: id },
    UpdateExpression: UpdateExpression.trim(),
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: Object.keys(values).length > 0 ? values : undefined,
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
