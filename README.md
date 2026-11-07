# Legacy of Horus Walk

A responsive fundraiser site and contribution-review panel built with React, TypeScript, Express, and MongoDB.

## Project structure

```text
client/   React + TypeScript + Vite frontend
server/   Express + MongoDB API
```

## Local setup

1. Copy `server/.env.example` to `server/.env.local`.
2. Set `MONGODB_URI`, a random `SESSION_SECRET` of at least 32 characters, and the initial `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `server/.env.local`.
3. Start MongoDB, then run:

```sh
npm install
npm run dev
```

The root `dev` script starts both workspaces. Vite runs the client and proxies `/api` to the Express server on port `3001`.

Useful commands:

```sh
npm run dev           # client and server
npm run dev:client    # client only
npm run dev:server    # server only
npm run build         # production client build
npm run lint          # client and server checks
npm start             # production API process
```

Environment files are ignored by Git. Do not put the MongoDB connection string or session secret in source files or commit them.

## Separate deployments

The default client uses same-origin `/api` requests, which works with the local Vite proxy or a production reverse proxy. If the client and server use different origins:

1. Copy `client/.env.example` to `client/.env.local` and set `VITE_API_URL` to the server origin.
2. Set `CLIENT_ORIGIN` in `server/.env.local` to the client origin. Multiple allowed origins may be comma-separated.
3. For genuinely cross-site HTTPS domains, set `COOKIE_SAME_SITE=none` and `NODE_ENV=production` on the server.

## Persistence and access

- Donations, admin accounts, bank details, and campaign visibility are stored in MongoDB.
- New donations enter the review ledger as pending. Admins can approve or reject them; reviewers have read-only access to donation records and receipts.
- Contributors may optionally add a supporter photo. Only approved donations with donor consent appear in the public supporters list, including the photo when provided. NIC, bank reference, contact information, and receipt data are never returned by the public API.
- Passwords are hashed with Node's `scrypt`. Authentication uses a signed, `HttpOnly` session cookie.
- The first server start creates the initial admin from `.env.local` if no admin exists. Later environment changes do not overwrite existing accounts.
- The first empty database is seeded with clearly marked sample donations and dummy bank details. Replace or remove those records before launch.

This site records bank-transfer evidence; it does not process payments.

## Replace demo content

- Verify the bank details through the admin Bank details tab before accepting transfers.
- Confirm organizer names and phone/WhatsApp contacts in `client/src/App.tsx`.
- The campaign story uses the web-optimized President's College image at `client/public/presidents-college-embilipitiya.jpg`.
- Replace organizer portraits in `client/public/organizer-01.jpg`, `client/public/organizer-02.jpg`, and `client/public/organizer-03.jpg` if needed.
- Confirm the walk date, location, fundraising goal, and campaign purpose before publishing.
