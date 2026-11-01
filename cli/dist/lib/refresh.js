"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshAccessToken = refreshAccessToken;
const config_1 = require("../config");
/**
 * Exchange the stored Cognito refresh token for a new access token (REFRESH_TOKEN_AUTH).
 * The CLI stores a 30-day refresh token at login; without this every expired access
 * token forced a full device-flow login. Returns the new access token, or null if
 * refresh is impossible (no refresh token, revoked, offline) so callers can fall back to login.
 */
async function refreshAccessToken() {
    const refreshToken = config_1.config.get("refreshToken");
    const clientId = config_1.config.get("cognitoClientId");
    if (!refreshToken || !clientId)
        return null;
    try {
        const res = await fetch("https://cognito-idp.us-east-1.amazonaws.com/", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-amz-json-1.1",
                "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth",
            },
            body: JSON.stringify({
                AuthFlow: "REFRESH_TOKEN_AUTH",
                ClientId: clientId,
                AuthParameters: { REFRESH_TOKEN: refreshToken },
            }),
        });
        if (!res.ok)
            return null;
        const body = (await res.json());
        const accessToken = body.AuthenticationResult?.AccessToken;
        if (!accessToken)
            return null;
        config_1.config.set("accessToken", accessToken);
        return accessToken;
    }
    catch {
        return null;
    }
}
