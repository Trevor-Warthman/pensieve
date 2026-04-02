import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  SignUpCommand,
  ConfirmSignUpCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";

const cognito = new CognitoIdentityProviderClient({});
const CLIENT_ID = process.env.COGNITO_CLIENT_ID!;

function respond(status: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode: status,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  const path = event.rawPath;
  const body = event.body ? JSON.parse(event.body) : {};

  try {
    if (path === "/auth/register") {
      const { email, password } = body;
      if (!email || !password) return respond(400, { error: "email and password required" });

      await cognito.send(new SignUpCommand({
        ClientId: CLIENT_ID,
        Username: email,
        Password: password,
        UserAttributes: [{ Name: "email", Value: email }],
      }));

      return respond(200, { message: "Registration successful. Check your email to verify your account." });
    }

    if (path === "/auth/login") {
      const { email, password } = body;
      if (!email || !password) return respond(400, { error: "email and password required" });

      const result = await cognito.send(new InitiateAuthCommand({
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: CLIENT_ID,
        AuthParameters: { USERNAME: email, PASSWORD: password },
      }));

      const tokens = result.AuthenticationResult;
      if (!tokens) return respond(401, { error: "Authentication failed" });

      return respond(200, {
        accessToken: tokens.AccessToken,
        refreshToken: tokens.RefreshToken,
        expiresIn: tokens.ExpiresIn,
      });
    }

    if (path === "/auth/confirm") {
      const { email, code } = body;
      await cognito.send(new ConfirmSignUpCommand({
        ClientId: CLIENT_ID,
        Username: email,
        ConfirmationCode: code,
      }));
      return respond(200, { message: "Email confirmed. You can now log in." });
    }

    return respond(404, { error: "Not found" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const name = err instanceof Error ? err.name : "Error";
    if (name === "NotAuthorizedException") return respond(401, { error: "Invalid credentials" });
    if (name === "UsernameExistsException") return respond(409, { error: "Email already registered" });
    if (name === "UserNotConfirmedException") return respond(403, { error: "Email not verified" });
    return respond(500, { error: message });
  }
};
