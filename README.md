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

## Deploying code changes

### Frontend changes

Commit and push changes to the `main` branch:

```sh
git add .
git commit -m "Update website"
git push origin main
```

Vercel automatically builds and publishes the frontend after the push.

### Backend changes

Backend changes must be built as a new Docker image and deployed to AWS. Make sure Docker Desktop is running, open a terminal in the project root, and run the following commands one at a time.

Log Docker in to the project's AWS ECR registry:

```sh
aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin 459800357986.dkr.ecr.ap-south-1.amazonaws.com
```

Build the Linux image and push it to ECR:

```sh
docker buildx build --platform linux/amd64 --tag 459800357986.dkr.ecr.ap-south-1.amazonaws.com/legacy-of-horus-server:latest --push ./server
```

Tell the ECS service to deploy the new image:

```sh
aws ecs update-service --cluster default --service legacy-of-horus-api --force-new-deployment --region ap-south-1
```

Allow approximately 2-5 minutes for the rolling deployment, then verify the production API:

```sh
curl https://legacy-of-horus.vercel.app/api/health
```

A healthy deployment returns:

```json
{"ok":true}
```

Do not commit `.env.local`, `node_modules`, or `dist`. MongoDB record changes do not require a deployment. AWS environment-variable or secret changes require the ECS service to be redeployed.

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
