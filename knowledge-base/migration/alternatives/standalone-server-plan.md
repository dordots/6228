# ARMORY Server Architecture - Knowledge Base

## מטרה

לבנות שרת עצמאי שיחליף את Base44 ויאפשר שליטה מלאה במערכת.

## מבנה התיקיות

### `/functions/implementations/`

- קוד מקור של כל הפונקציות מ-Base44
- Deno serverless functions
- Base44 SDK integrations

### `/server-architecture/`

- תכנון ארכיטקטורת השרת העצמאי
- Database schemas
- API endpoints
- Authentication system
- Integration patterns

## תכנון השרת העצמאי

### 1. Database

- PostgreSQL עם JSON support
- Tables לכל Entity
- Relationships ו-constraints
- Indexing ו-performance

### 2. API Layer

- RESTful API
- GraphQL (אופציונלי)
- Authentication middleware
- Rate limiting
- CORS configuration

### 3. Authentication

- JWT tokens
- Role-based access control
- TOTP 2FA
- Session management

### 4. Integrations

- SendGrid for emails
- File storage (S3/MinIO)
- Background jobs (Redis/Bull)
- Monitoring (Prometheus/Grafana)

### 5. Deployment

- Docker containers
- Kubernetes/Helm
- CI/CD pipeline
- Environment management

## שלבי הפיתוח

1. **Phase 1:** Database setup + Basic CRUD
2. **Phase 2:** Authentication + Authorization
3. **Phase 3:** Business logic functions
4. **Phase 4:** Integrations (Email, Storage)
5. **Phase 5:** Frontend migration
6. **Phase 6:** Testing + Deployment

## קבצים נדרשים

- Database schemas (SQL)
- API endpoints documentation
- Authentication flow
- Function implementations
- Integration configurations
- Deployment scripts
