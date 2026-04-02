import {
  CloudFrontClient,
  CreateInvalidationCommand,
} from "@aws-sdk/client-cloudfront";
import type { S3Event } from "aws-lambda";
import { randomUUID } from "crypto";

const cf = new CloudFrontClient({});
const DISTRIBUTION_ID = process.env.CLOUDFRONT_DISTRIBUTION_ID!;

export const handler = async (event: S3Event): Promise<void> => {
  const paths = event.Records.map((r) => {
    const key = decodeURIComponent(r.s3.object.key.replace(/\+/g, " "));
    // Invalidate the note path and the lexicon index above it
    const parts = key.split("/");
    const notePath = `/${key}`;
    const indexPath = parts.length > 2 ? `/${parts.slice(0, -1).join("/")}` : null;
    return [notePath, indexPath].filter(Boolean) as string[];
  }).flat();

  const unique = [...new Set(paths)];

  await cf.send(
    new CreateInvalidationCommand({
      DistributionId: DISTRIBUTION_ID,
      InvalidationBatch: {
        CallerReference: randomUUID(),
        Paths: { Quantity: unique.length, Items: unique },
      },
    })
  );
};
