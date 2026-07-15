# GHOST APP PROJECT RULES

Project Name:
Ghost

Concept:
A premium private 1-to-1 messenger inspired by Instagram Direct Messages where every message automatically disappears exactly 10 minutes after it has been seen by the recipient.

Principles

- Production Ready
- Clean Architecture
- Feature Based Architecture
- SOLID Principles
- DRY
- Type Safe
- Modular
- Fully Typed
- Reusable Components
- No Hardcoded Values
- Scalable
- High Performance

Mobile

React Native

Expo SDK Latest

TypeScript

Expo Router

Backend

Fastify

Socket.IO

MongoDB

Mongoose

Redis

Cloudinary

JWT

bcrypt

Zod

Architecture

Business logic NEVER inside controllers.

Controllers only call services.

Validation only using Zod.

Authentication via middleware.

Socket events separated from HTTP routes.

Database models separated.

Every feature isolated.

Folder Structure

Feature Based.

Coding Style

Arrow Functions

Async Await

Strict TypeScript

ESLint

Prettier

Error Handling

Global Error Handler

Typed Errors

Consistent API Responses

Realtime

Socket.IO

Events

connection

disconnect

join-chat

leave-chat

typing

stop-typing

message

seen

reaction

reply

presence

delete-message

Performance

FlashList

MMKV

React Query

Optimistic UI

Image Compression

Lazy Loading

Memoization

Security

JWT

Refresh Tokens

bcrypt

HTTPS

End-to-End Encryption Ready

Never expose secrets.

Message Lifecycle

Send

↓

Delivered

↓

Seen

↓

seenAt saved

↓

deleteAt = seenAt + 10 min

↓

Delete Message

↓

Delete Attachment

↓

Delete Cache

↓

Finished

UI

Inspired by Instagram DM

Dark Theme

Premium Animations

Smooth 60FPS

Minimal

Native Feel

Coding Rules

Never generate placeholder code.

Never use any.

Never use TODO.

Never leave incomplete functions.

Every feature must compile.

Every file must be imported correctly.

Every API must be connected.

Everything must be production ready.

## Pairing Rules

Never implement usernames.

Never implement searching users.

Never implement friend requests.

Never implement public profiles.

The application supports only one paired partner.

Users connect only using secure invite codes.

Invite Code Requirements

- 8-character alphanumeric
- Example: HX7P-9QKL
- Expires after 10 minutes
- Single use
- Cryptographically secure random generation
- Destroy immediately after successful pairing

Once paired:

- Create permanent friendship
- Create private chat
- Delete invite code