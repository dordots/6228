# Base44 Implementation Questions

## Overview
These questions are for learning about Base44's internal workings to understand the system better.

## 1. Database & Entity Operations

### General Entity Behavior
1. **I just want to ask - how do you handle database transactions internally?**
   - Are operations wrapped in transactions automatically?
   - What happens if multiple operations fail?
   - Is there automatic rollback support?

2. **I just want to ask - what are the exact query capabilities of `findMany()` and `findFirst()`?**
   - What query operators are supported (gt, gte, lt, lte, contains, startsWith)?
   - How does nested filtering work?
   - What's the maximum number of results returned?
   - How does pagination work internally?

3. **I just want to ask - how are entity relationships handled?**
   - How does the `include` parameter work in queries?
   - Are there automatic joins or separate queries?
   - What's the depth limit for nested includes?
   - How are circular references prevented?

4. **I just want to ask - what validation rules are automatically applied to entities?**
   - Are there built-in validations beyond the schema?
   - How are unique constraints enforced?
   - What happens when validation fails?

5. **I just want to ask - how do you handle timestamps?**
   - Are createdAt/updatedAt fields automatic?
   - What timezone is used for timestamps?
   - How are date fields parsed and formatted?

### Specific Entity Questions

6. **I just want to ask - for the Soldier entity:**
   - Is the `soldier_id` field case-sensitive?
   - What happens if email is null vs empty string?
   - Are there any automatic transformations on phone numbers?

7. **I just want to ask - for Equipment/Weapon/SerializedGear:**
   - How is the assignment to soldiers tracked internally?
   - Can items be assigned to multiple soldiers?
   - What happens to assignments when a soldier is deleted?

8. **I just want to ask - for ActivityLog:**
   - What triggers automatic activity logging?
   - What's the structure of the `context` JSON field?
   - Is there a retention policy for logs?

9. **I just want to ask - for DailyVerification:**
   - How are verification records linked to soldiers?
   - What prevents duplicate verifications?
   - How is the verification timestamp validated?

## 2. Authentication & Authorization

### User Management
10. **I just want to ask - how does `auth.me()` work internally?**
    - What data is included in the user object?
    - How is the current user determined from the request?
    - What happens if the token is expired?

11. **I just want to ask - what fields are stored on the User entity?**
    - Full schema of the User table
    - Which fields are required vs optional?
    - How are passwords hashed and stored?

12. **I just want to ask - how does your JWT token system work?**
    - What's included in the JWT payload?
    - What's the token expiration time?
    - How are refresh tokens handled?
    - What's the signing algorithm used?

### Service Role & Permissions
13. **I just want to ask - how does `asServiceRole` work?**
    - What elevated permissions does it provide?
    - How is it authenticated differently?
    - Are there any operations it cannot perform?

14. **I just want to ask - what role/permission system exists?**
    - Are there predefined roles?
    - How are permissions checked?
    - Can custom roles be created?

### TOTP Implementation
15. **I just want to ask - for TOTP (2FA) functionality:**
    - Where exactly is `totp_temp_secret` stored?
    - How long are temporary secrets valid?
    - What happens to temp secrets after verification?
    - How many verification attempts are allowed?

## 3. Functions Implementation

### Data Operations
16. **I just want to ask - for deleteAll* functions:**
    - Are these soft deletes or hard deletes?
    - Is there cascade deletion?
    - Are activity logs created for bulk deletes?
    - What authorization is required?

17. **I just want to ask - for `exportAllData` function:**
    - What exact format is the exported data?
    - Are relationships included in the export?
    - Is there a size limit on exports?
    - How are files/attachments handled?

### Form Generation
18. **I just want to ask - for `generateSigningForm` and `generateReleaseForm`:**
    - What template engine is used?
    - Where are the form templates stored?
    - What data is passed to the templates?
    - What PDF generation library is used?
    - Can you share the actual template structure?

### Email System
19. **I just want to ask - for SendGrid integration:**
    - What are the exact template IDs used?
    - What dynamic data is passed to templates?
    - How are email failures handled?
    - Is there retry logic?
    - What tracking is implemented?

20. **I just want to ask - for bulk email operations:**
    - What's the rate limit for sending?
    - How are bounces/unsubscribes handled?
    - Is there a queue system?

### Report Generation
21. **I just want to ask - for `sendDailyReport`:**
    - What exact data is included in daily reports?
    - What's the aggregation logic?
    - What time zone is used for "daily"?
    - Who receives these reports?
    - Can you share the report template/format?

## 4. Integrations

### File Handling
22. **I just want to ask - for `UploadFile` and `UploadPrivateFile`:**
    - What's the difference between public and private files?
    - What storage backend is used (S3, etc.)?
    - What are the file size limits?
    - What file types are allowed/blocked?
    - How are file names sanitized?

23. **I just want to ask - for `CreateFileSignedUrl`:**
    - How long are signed URLs valid?
    - What permissions do signed URLs grant?
    - Can expiration time be customized?
    - How are URLs invalidated?

### AI/LLM Integration
24. **I just want to ask - for `InvokeLLM`:**
    - What LLM model is used?
    - What are the rate limits?
    - What's the token limit per request?
    - How is context managed?
    - What safety filters are applied?

### Image Generation
25. **I just want to ask - for `GenerateImage`:**
    - What image generation service is used?
    - What parameters can be customized?
    - What image formats are supported?
    - Where are generated images stored?

### Data Extraction
26. **I just want to ask - for `ExtractDataFromUploadedFile`:**
    - What file formats are supported?
    - What extraction logic is used?
    - How accurate is the extraction?
    - What happens with extraction failures?

## 5. Performance & Limits

27. **I just want to ask - what are the rate limits for different operations?**
    - Entity CRUD operations
    - Function invocations
    - File uploads
    - Email sending

28. **I just want to ask - what are the data size limits?**
    - Maximum request/response size
    - Maximum file upload size
    - Maximum query result size
    - Maximum JSON field size

29. **I just want to ask - how do you handle caching?**
    - Is there automatic caching?
    - What's cached and for how long?
    - How is cache invalidated?

30. **I just want to ask - what timeout values are used?**
    - Database query timeout
    - Function execution timeout
    - HTTP request timeout

## 6. Error Handling & Monitoring

31. **I just want to ask - how are errors formatted and returned?**
    - Standard error response structure
    - Error codes used
    - How are validation errors formatted?

32. **I just want to ask - what automatic retries exist?**
    - Which operations are retried?
    - What's the retry strategy?
    - How are retry failures handled?

33. **I just want to ask - what monitoring/logging happens automatically?**
    - What events are logged?
    - Where are logs stored?
    - What metrics are collected?

## 7. Data Consistency & Integrity

34. **I just want to ask - how do you ensure data consistency?**
    - Are there automatic data integrity checks?
    - How are race conditions prevented?
    - What locking mechanisms are used?

35. **I just want to ask - what happens during concurrent updates?**
    - Is there optimistic locking?
    - How are conflicts resolved?
    - Are there version fields?

36. **I just want to ask - how are cascading operations handled?**
    - When deleting a soldier, what happens to their equipment?
    - Are there automatic cleanup jobs?
    - How are orphaned records prevented?

## 8. Special Features & Behaviors

37. **I just want to ask - are there any hidden/automatic fields on entities?**
    - System fields not in the schema
    - Automatic computed fields
    - Hidden metadata

38. **I just want to ask - what background jobs or scheduled tasks run?**
    - Cleanup tasks
    - Maintenance operations
    - Scheduled reports

39. **I just want to ask - are there any special features I should know about?**
    - Special query syntax
    - Magic methods
    - Automatic optimizations

40. **I just want to ask - what happens in edge cases?**
    - Null vs undefined handling
    - Empty strings vs null
    - Zero vs null for numbers
    - Empty arrays vs null

## Additional Context Needed

41. **I just want to ask - can you provide example requests/responses for complex operations?**
    - Multi-entity transactions
    - Bulk operations
    - Complex queries with includes

42. **I just want to ask - what are the exact npm package versions used in functions?**
    - For TOTP generation
    - For PDF generation
    - For email sending

43. **I just want to ask - are there any undocumented features or behaviors?**
    - Hidden parameters
    - Special headers
    - Debug modes

---

These questions are purely for learning and understanding how things work internally. No implementation or changes will be made based on these questions.