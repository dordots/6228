// Base44 Function: sendEmailViaSendGrid
// This is the actual implementation running on Base44 servers

import { createClientFromRequest } from 'npm:@base44/sdk@0.7.0';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { to, subject, htmlContent, textContent, fromName } = body;

        if (!to || !subject) {
            return Response.json({ error: 'Missing required fields: to, subject' }, { status: 400 });
        }

        const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY");
        const SENDGRID_FROM_EMAIL = Deno.env.get("SENDGRID_FROM_EMAIL");

        if (!SENDGRID_API_KEY) {
            return Response.json({ error: 'SendGrid API key not configured' }, { status: 500 });
        }

        if (!SENDGRID_FROM_EMAIL) {
            return Response.json({ error: 'SendGrid from email not configured' }, { status: 500 });
        }

        const emailData = {
            personalizations: [{
                to: [{ email: to }],
                subject: subject
            }],
            from: {
                email: SENDGRID_FROM_EMAIL,
                name: fromName || "ARMORY System"
            },
            content: []
        };

        // Add HTML content if provided
        if (htmlContent) {
            emailData.content.push({
                type: "text/html",
                value: htmlContent
            });
        }

        // Add text content if provided, or create from HTML
        if (textContent) {
            emailData.content.push({
                type: "text/plain",
                value: textContent
            });
        } else if (htmlContent) {
            // Create a simple text version from HTML
            const simpleText = htmlContent
                .replace(/<[^>]*>/g, '') // Remove HTML tags
                .replace(/\s+/g, ' ') // Normalize whitespace
                .trim();
            emailData.content.push({
                type: "text/plain",
                value: simpleText
            });
        }

        const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${SENDGRID_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(emailData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('SendGrid API error:', errorText);
            return Response.json({ 
                error: 'Failed to send email', 
                details: errorText,
                status: response.status 
            }, { status: 500 });
        }

        return Response.json({ 
            success: true, 
            message: 'Email sent successfully',
            messageId: response.headers.get('X-Message-Id')
        });

    } catch (error) {
        console.error('Error sending email:', error);
        return Response.json({ 
            error: 'Internal server error', 
            details: error.message 
        }, { status: 500 });
    }
});
