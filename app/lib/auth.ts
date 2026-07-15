import jwt from "jsonwebtoken";

const isLocal = !!process.env.DYNAMODB_ENDPOINT;

/** Resolve the userId behind an access token — local dev (custom JWT) or prod (Cognito). */
export async function getUserIdFromToken(token: string | undefined): Promise<string | null> {
  if (!token) return null;

  if (isLocal) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as { sub: string };
      return payload.sub;
    } catch {
      return null;
    }
  }

  try {
    const { CognitoJwtVerifier } = await import("aws-jwt-verify");
    const verifier = CognitoJwtVerifier.create({
      userPoolId: process.env.COGNITO_USER_POOL_ID!,
      tokenUse: "access",
      clientId: process.env.COGNITO_CLIENT_ID!,
    });
    const payload = await verifier.verify(token);
    return payload.sub;
  } catch {
    return null;
  }
}
