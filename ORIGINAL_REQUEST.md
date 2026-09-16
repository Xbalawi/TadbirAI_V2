# Original User Request

## 2026-09-12T21:20:25Z

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Craft prompt → get user approval → delegate to teamwork_preview
> Requested team: Full multi-agent team

Conduct a comprehensive codebase audit and fix all outstanding bugs, starting immediately with a complete resolution of the email delivery system (Brevo/Next.js).

Working directory: d:\Lenovo\Downloads\fawatir-root(1)

Integrity mode: demo

## Requirements

### R1. Resolve Email Delivery Failure
Diagnose and permanently fix the email delivery system (Next.js/Brevo) so that invitations successfully reach the recipient's inbox without being blocked by strict DMARC/spam policies.

### R2. Comprehensive Codebase Audit
Identify and fix any remaining critical bugs in the Next.js frontend or Django backend related to authentication, user management, and tenant isolation.

## Acceptance Criteria

### Email System
- [ ] A test email can be dispatched via the API and successfully delivered to a standard Gmail inbox.
- [ ] The Next.js API route properly captures and logs any Brevo API errors (non-2xx responses).

### System Stability
- [ ] Automated tests in the Django backend pass without `UnboundLocalError` or tenant isolation failures.
- [ ] Frontend UI properly renders server errors instead of silently failing or rendering empty tables.
