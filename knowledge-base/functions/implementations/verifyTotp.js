// Base44 Function: verifyTotp
// This is the actual implementation running on Base44 servers

import { createClientFromRequest } from "npm:@base44/sdk@0.5.0";
import * as OTPAuth from "npm:otpauth@9.2.2";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { token, isSetup } = await req.json();
    if (!token) {
      return new Response(JSON.stringify({ error: "Token is required" }), {
        status: 400,
      });
    }

    const secretBase32 = isSetup ? user.totp_temp_secret : user.totp_secret;

    if (!secretBase32) {
      return new Response(
        JSON.stringify({ error: "No TOTP secret found for this user." }),
        { status: 400 }
      );
    }

    const totp = new OTPAuth.TOTP({
      issuer: "ArmoryApp",
      label: user.email,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secretBase32),
    });

    const delta = totp.validate({ token });

    if (delta === null) {
      return new Response(
        JSON.stringify({ success: false, message: "Invalid token." }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // If this was the first-time setup verification, make the secret permanent.
    if (isSetup) {
      await base44.asServiceRole.entities.User.update(user.id, {
        totp_secret: user.totp_temp_secret,
        totp_temp_secret: null, // Clear the temporary secret
        totp_enabled: true,
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error.message && error.message.includes("Rate limit exceeded")) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "rate_limit_exceeded",
          message: "Too many attempts. Please wait a minute and try again.",
        }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: "Failed to verify token",
        message: error.message,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
