// Base44 Function: generateTotp
// This is the actual implementation running on Base44 servers

import { createClientFromRequest } from "npm:@base44/sdk@0.5.0";
import * as OTPAuth from "npm:otpauth@9.2.2";
import * as qrcode from "npm:qrcode@1.5.3";

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

    // Generate a new secret instance
    const secret = new OTPAuth.Secret();

    // Generate a new TOTP instance using the new secret
    const totp = new OTPAuth.TOTP({
      issuer: "ArmoryApp",
      label: user.email,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: secret, // Use the new secret object
    });

    // Store the temporary secret's base32 representation on the user record
    await base44.asServiceRole.entities.User.update(user.id, {
      totp_temp_secret: secret.base32,
    });

    // Generate the QR code
    const otpauthUrl = totp.toString();
    const qrCodeDataURL = await qrcode.toDataURL(otpauthUrl);

    return new Response(
      JSON.stringify({
        qrCodeUrl: qrCodeDataURL,
        secret: secret.base32, // Also return the secret for manual entry
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Failed to generate TOTP secret",
        details: error.message,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
