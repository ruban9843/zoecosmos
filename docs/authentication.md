# Authentication

Clerk owns sign-in, sign-up, sessions, and authentication email. Configure
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` in the deployment
environment.

The Prisma `User` model remains the application identity record. On the first
authenticated request, the Clerk user is linked by `clerkUserId`; an existing
record with the same email is linked automatically. Application roles remain
authoritative in `User.role` and are checked server-side for staff and owner
routes.

Existing password hashes, NextAuth sessions, OAuth accounts, and verification
tokens are not migrated. Existing users must create or sign in to a Clerk
account. The seeded owner email identifies the owner role record; use that email
for the Clerk account.

Set `ADMIN_EMAIL` to grant staff access to that verified Clerk primary email.
This derived access does not grant owner-only settings and is removed when the
setting changes. Separately assigned database staff roles remain unchanged.
