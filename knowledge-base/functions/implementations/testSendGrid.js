// Base44 Function: testSendGrid
// This is the actual implementation running on Base44 servers

import { createClientFromRequest } from 'npm:@base44/sdk@0.7.0';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { testEmail } = await req.json();
        
        if (!testEmail) {
            return Response.json({ error: 'Please provide a testEmail to send to' }, { status: 400 });
        }

        console.log('Testing SendGrid with email:', testEmail);

        const sendGridApiKey = Deno.env.get("SENDGRID_API_KEY");
        const sendGridFromEmail = Deno.env.get("SENDGRID_FROM_EMAIL");

        // Enhanced debugging
        console.log('SendGrid API Key exists:', !!sendGridApiKey);
        console.log('SendGrid From Email raw value:', JSON.stringify(sendGridFromEmail));
        console.log('SendGrid From Email type:', typeof sendGridFromEmail);
        console.log('SendGrid From Email length:', sendGridFromEmail?.length);

        if (!sendGridApiKey) {
            return Response.json({ error: 'SendGrid API key not configured' }, { status: 500 });
        }
        if (!sendGridFromEmail) {
            return Response.json({ error: "SendGrid 'from' email not configured (SENDGRID_FROM_EMAIL)" }, { status: 500 });
        }

        // Trim and validate the email
        const cleanFromEmail = sendGridFromEmail.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        if (!emailRegex.test(cleanFromEmail)) {
            return Response.json({ 
                error: 'Invalid from email format', 
                details: `The SENDGRID_FROM_EMAIL value "${cleanFromEmail}" is not a valid email address. Please ensure it follows the format: noreply@yourdomain.com`,
                rawValue: JSON.stringify(sendGridFromEmail)
            }, { status: 500 });
        }

        console.log(`Using cleaned 'from' email: ${cleanFromEmail}`);

        const emailData = {
            personalizations: [{
                to: [{ email: testEmail }],
                subject: "Test Email from ARMORY System (Domain Test)"
            }],
            from: {
                email: cleanFromEmail,
                name: "ARMORY System Test"
            },
            content: [{
                type: "text/html",
                value: `
                    <h1>SendGrid Domain Authentication Test</h1>
                    <p>This is a test email sent from the ARMORY system at ${new Date().toISOString()}</p>
                    <p>It was sent from the email address: <b>${cleanFromEmail}</b>.</p>
                    <p>If you received this, your SendGrid domain authentication is working correctly.</p>
                `
            }]
        };

        console.log('Email payload:', JSON.stringify(emailData, null, 2));
        console.log('Sending email to SendGrid API...');

        const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${sendGridApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(emailData)
        });

        const responseText = await response.text();
        
        console.log('SendGrid response status:', response.status);
        console.log('SendGrid response text:', responseText);

        if (response.ok) {
            return Response.json({ 
                success: true, 
                message: `Success! Test email sent to ${testEmail} from ${cleanFromEmail}. SendGrid Response: ${response.status}`,
                sendGridStatus: response.status,
                sendGridResponse: responseText || 'No response body (this is normal for successful sends)',
                fromEmailUsed: cleanFromEmail
            });
        } else {
            return Response.json({ 
                error: 'SendGrid API error',
                status: response.status,
                details: responseText,
                fromEmailUsed: cleanFromEmail,
                rawFromEmail: JSON.stringify(sendGridFromEmail)
            }, { status: response.status });
        }

    } catch (error) {
        console.error('Test SendGrid error:', error);
        return Response.json({ 
            error: 'Function error',
            details: error.message,
            stack: error.stack
        }, { status: 500 });
    }
});
