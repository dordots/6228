# Supabase Migration Guide for Base44 Users

## Quick Start Checklist

### Prerequisites:
- [ ] Access to Base44 admin panel
- [ ] SendGrid API key
- [ ] GitHub account (for deployment)
- [ ] 2 weeks of focused time

## Step-by-Step Migration Guide

### Day 1-2: Supabase Setup

#### 1. Create Supabase Project
```bash
# Visit: https://app.supabase.com
# Click "New Project"
# Choose region closest to your users
# Save connection string and API keys
```

#### 2. Database Schema Creation
```sql
-- Run in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Soldiers table
CREATE TABLE soldiers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  soldier_id VARCHAR(100) UNIQUE NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  phone_number VARCHAR(50),
  street_address TEXT,
  city VARCHAR(100),
  division_name VARCHAR(100),
  team_name VARCHAR(100),
  profession VARCHAR(100),
  enlistment_status VARCHAR(20) DEFAULT 'expected',
  arrival_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Equipment table
CREATE TABLE equipment (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  equipment_id VARCHAR(100) UNIQUE NOT NULL,
  equipment_name VARCHAR(200) NOT NULL,
  equipment_type VARCHAR(100),
  status VARCHAR(50) DEFAULT 'available',
  soldier_id UUID REFERENCES soldiers(id) ON DELETE SET NULL,
  division_name VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Continue with all other tables...
```

#### 3. Enable Row Level Security
```sql
-- Enable RLS
ALTER TABLE soldiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view all soldiers" ON soldiers
  FOR SELECT USING (true);

CREATE POLICY "Only admins can modify soldiers" ON soldiers
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
```

#### 4. Set Up Authentication
```javascript
// In Supabase Dashboard:
// 1. Go to Authentication > Providers
// 2. Enable Phone or Email providers
// 3. Configure JWT settings
// 4. Set up custom claims for roles
```

### Day 3-4: Data Migration

#### 1. Export Base44 Data
```javascript
// Run in your app console
const data = await exportAllData();
// Save the resulting ZIP file
```

#### 2. Create Migration Script
```javascript
// migrate-to-supabase.js
import { createClient } from '@supabase/supabase-js';
import { extractDataFromZip } from './utils';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function migrate() {
  const data = await extractDataFromZip('./base44-export.zip');
  
  // Migrate soldiers
  for (const soldier of data.soldiers) {
    await supabase.from('soldiers').insert({
      soldier_id: soldier.soldier_id,
      first_name: soldier.first_name,
      last_name: soldier.last_name,
      email: soldier.email,
      // ... map all fields
    });
  }
  
  // Continue for all entities...
}
```

### Day 5-7: Backend Functions

#### 1. Set Up Vercel Project
```bash
# Install Vercel CLI
npm i -g vercel

# Create functions directory
mkdir armory-functions
cd armory-functions
npm init -y

# Install dependencies
npm install @supabase/supabase-js @sendgrid/mail otpauth qrcode
```

#### 2. Create Email Function
```javascript
// api/send-email.js
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

export default async function handler(req, res) {
  const { to, subject, html } = req.body;
  
  try {
    await sgMail.send({
      to,
      from: process.env.SENDGRID_FROM_EMAIL,
      subject,
      html
    });
    
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
```

#### 3. Deploy to Vercel
```bash
vercel --prod
# Save the deployment URL
```

### Day 8-9: Frontend Updates

#### 1. Install Supabase Client
```bash
npm uninstall @base44/sdk
npm install @supabase/supabase-js axios
```

#### 2. Create New API Client
```javascript
// src/api/supabase-client.js
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

// src/api/functions-client.js
import axios from 'axios';

const functionsUrl = process.env.REACT_APP_FUNCTIONS_URL;

export const functions = {
  sendEmail: (data) => 
    axios.post(`${functionsUrl}/api/send-email`, data),
  generateTotp: (data) => 
    axios.post(`${functionsUrl}/api/generate-totp`, data),
  // ... other functions
};
```

#### 3. Update API Layer
```javascript
// src/api/entities.js
import { supabase } from './supabase-client';

// Replace Base44 entities
export const Soldier = {
  create: async (data) => {
    const { data: result, error } = await supabase
      .from('soldiers')
      .insert(data)
      .select()
      .single();
    if (error) throw error;
    return result;
  },
  
  findMany: async (options = {}) => {
    let query = supabase.from('soldiers').select('*');
    
    if (options.where) {
      // Apply filters
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
  
  update: async (id, data) => {
    const { data: result, error } = await supabase
      .from('soldiers')
      .update(data)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return result;
  },
  
  delete: async (id) => {
    const { error } = await supabase
      .from('soldiers')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
};

// Repeat for all entities...
```

#### 4. Update Authentication
```javascript
// src/api/auth.js
import { supabase } from './supabase-client';
import { functions } from './functions-client';

export const User = {
  login: async (credentials) => {
    const { emailOrPhone, password, verificationCode } = credentials;
    const isPhone = /^\+?[1-9]\d{1,14}$/.test(emailOrPhone);
    
    if (isPhone) {
      // Phone authentication
      if (!verificationCode) {
        // First step: send OTP
        const { data, error } = await supabase.auth.signInWithOtp({
          phone: emailOrPhone
        });
        if (error) throw error;
        return { requiresVerification: true, ...data };
      } else {
        // Second step: verify OTP
        const { data, error } = await supabase.auth.verifyOtp({
          phone: emailOrPhone,
          token: verificationCode,
          type: 'sms'
        });
        if (error) throw error;
        return data;
      }
    } else {
      // Email authentication
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailOrPhone,
        password: password
      });
      if (error) throw error;
      return data;
    }
  },
  
  me: async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  },
  
  generateTotp: async () => {
    const response = await functions.generateTotp();
    return response.data;
  },
  
  verifyTotp: async (token) => {
    const response = await functions.verifyTotp({ token });
    return response.data;
  }
};
```

### Day 10-14: Testing & Deployment

#### 1. Test Checklist
- [ ] User registration and login
- [ ] TOTP generation and verification
- [ ] All CRUD operations for each entity
- [ ] Email sending functions
- [ ] Data export functionality
- [ ] File uploads
- [ ] Permissions and security

#### 2. Environment Variables
```bash
# .env.production
REACT_APP_SUPABASE_URL=https://xxxxx.supabase.co
REACT_APP_SUPABASE_ANON_KEY=xxxxx
REACT_APP_FUNCTIONS_URL=https://your-functions.vercel.app
```

#### 3. Deploy Frontend
```bash
npm run build
# Deploy to your hosting service
```

## Common Issues & Solutions

### Issue: Authentication Mismatch
```javascript
// Supabase uses different JWT structure
// Solution: Update role checks
const isAdmin = user?.user_metadata?.role === 'admin';
```

### Issue: Query Syntax Differences
```javascript
// Base44: where: { status: 'active' }
// Supabase: .eq('status', 'active')

// Create a query builder wrapper for compatibility
```

### Issue: Real-time Subscriptions
```javascript
// Add real-time updates (bonus feature!)
const subscription = supabase
  .from('soldiers')
  .on('*', (payload) => {
    console.log('Change received!', payload);
  })
  .subscribe();
```

## Post-Migration Checklist

### Week 1 After Migration:
- [ ] Monitor error logs
- [ ] Check performance metrics
- [ ] Gather user feedback
- [ ] Fix any compatibility issues

### Month 1 After Migration:
- [ ] Optimize database queries
- [ ] Review security policies
- [ ] Plan additional features
- [ ] Consider self-hosting options

## Rollback Plan

If issues arise:
1. Keep Base44 active for 1 month
2. Implement dual-write for critical operations
3. Have database backup from Supabase
4. Can switch back via environment variables

## Future Enhancements

### Leveraging Supabase Features:
1. **Real-time Updates**: Live equipment status
2. **Storage**: Better file management
3. **Edge Functions**: Server-side logic
4. **Vector Search**: Advanced equipment search

### Migration to Self-Hosted:
1. Supabase is open source
2. Can deploy on your own servers later
3. No vendor lock-in
4. Same APIs work with self-hosted

## Support Resources

1. **Supabase Documentation**: https://supabase.com/docs
2. **Discord Community**: https://discord.supabase.com
3. **Migration Examples**: https://github.com/supabase/supabase/tree/master/examples
4. **Video Tutorials**: https://www.youtube.com/c/supabase

## Cost Optimization Tips

1. **Use Connection Pooling**: Reduces connection overhead
2. **Implement Caching**: Reduce database reads
3. **Optimize Queries**: Use proper indexes
4. **Monitor Usage**: Stay within free tier limits
5. **Archive Old Data**: Move to cheaper storage

---

This guide provides a practical, step-by-step approach to migrating from Base44 to Supabase in 2 weeks. Follow each step carefully and test thoroughly before switching production traffic.