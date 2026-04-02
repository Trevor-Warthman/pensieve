import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

const isLocal = !!process.env.DYNAMODB_ENDPOINT;
const client = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region: process.env.AWS_REGION ?? "us-east-1",
    ...(isLocal && {
      endpoint: process.env.DYNAMODB_ENDPOINT,
      credentials: { accessKeyId: "local", secretAccessKey: "local" },
    }),
  })
);

const LEXICONS_TABLE = process.env.DYNAMODB_LEXICONS_TABLE ?? "pensieve-lexicons";

export interface Lexicon {
  lexiconId: string;
  userId: string;
  slug: string;
  title: string;
  publishDefault: boolean;
  status: "active" | "unpublished";
  createdAt: string;
}

/** Resolve a public slug to its S3 prefix (userId/lexiconId). Only returns active lexicons. */
export async function getLexiconBySlug(slug: string): Promise<Lexicon | null> {
  const result = await client.send(
    new ScanCommand({
      TableName: LEXICONS_TABLE,
      FilterExpression: "slug = :slug AND (#s = :active OR attribute_not_exists(#s))",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: { ":slug": slug, ":active": "active" },
    })
  );
  return (result.Items?.[0] as Lexicon) ?? null;
}

export function lexiconS3Prefix(lexicon: Lexicon): string {
  return `${lexicon.userId}/${lexicon.lexiconId}`;
}
