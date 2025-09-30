# Architecture Documentation

This directory contains detailed architectural documentation for the Armory system.

## Overview

The Armory system follows a modern web application architecture with:
- **Frontend**: Single Page Application (SPA) built with React
- **Backend**: Serverless functions on Base44 platform
- **Database**: Base44 managed database (migrating to Firebase)

## Key Architectural Decisions

### 1. Frontend Architecture
- Component-based architecture using React
- State management with React hooks and Context API
- Routing with React Router
- Styling with Tailwind CSS and Radix UI components

### 2. Backend Architecture
- Serverless functions for scalability
- RESTful API design
- Role-based access control (RBAC)
- Secure authentication with 2FA

### 3. Data Architecture
- Entity-based data model
- Real-time synchronization
- Automatic backups
- Transaction support (being enhanced in migration)

## Design Patterns

- **Repository Pattern**: For data access abstraction
- **Component Composition**: For reusable UI components
- **Context Pattern**: For global state management
- **Guard Pattern**: For route protection and authorization

## Security Architecture

- Multi-factor authentication (2FA with TOTP)
- Role-based permissions
- Data encryption at rest and in transit
- Secure session management

## Performance Considerations

- Code splitting for optimal bundle sizes
- Lazy loading of routes and components
- CDN distribution for static assets
- Caching strategies for API responses

## Future Architecture (Post-Migration)

The system is migrating to Firebase, which will provide:
- Better transaction support
- Enhanced real-time capabilities
- Improved offline support
- More flexible querying options

For detailed component architecture, see [System Overview - Architecture](../system-overview/architecture.md)