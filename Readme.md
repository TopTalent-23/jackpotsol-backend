# Lottery Pot Backend Service

This backend service listens to your Solana Anchor lottery program events and manages pot state, tickets, and payouts. It uses MongoDB for data persistence and integrates with Orao VRF for randomness fulfillment.

---

## Features

- Connects to Solana RPC with websocket for real-time program logs
- Parses Anchor program events (`PotCreated`, `TicketBought`, `PayoutFulfilled`)
- Stores pot, ticket, and payout data in MongoDB collections
- Automatically requests and fulfills randomness via Orao VRF when pot is full
- Calls the on-chain `fulfillAndPayout` instruction with winner data
- Tracks payouts and resets pot ticket count after payout

---

## Setup

1. Clone the backend repository.

2. Create a `.env` file with the following variables:

```
RPC_URL=http://api.mainnet-beta.solana.com
BACKEND_AUTH=<Base58 encoded private key of backend wallet>
MONGODB_URI=<Your MongoDB connection URI>
```

3. Install dependencies:

```bash
npm install
```

4. Start MongoDB locally or remotely, ensure it is accessible.

---

## How It Works

- Connects to Solana RPC endpoint and subscribes to logs emitted by the lottery program.
- Parses events using Anchor's `EventParser`.
- On `PotCreated` event: creates a new pot document in MongoDB.
- On `TicketBought` event: updates tickets sold count and inserts a ticket document.
- When tickets sold == ticket capacity:
  - Retrieves all buyers
  - Requests VRF randomness from Orao Network
  - Waits for fulfillment
  - Calculates winner index using randomness
  - Sends on-chain transaction to fulfill payout
  - Records payout details in MongoDB
- On `PayoutFulfilled` event: resets pot tickets sold to zero for next round.

---

## Code Overview

- Uses Anchor `Program` for interaction with Solana program.
- Uses Orao SDK to request & listen for VRF randomness.
- MongoDB models: `Pot`, `Ticket`, `Payout`.
- Backend wallet is the program authority keypair used to sign transactions.

---

## Running the Backend

```bash
npm run start
```

Make sure `.env` is set and MongoDB is running.

---

## Important Notes

- Backend must keep `BACKEND_AUTH` wallet private key secure.
- Ensure Solana RPC supports websockets for log subscriptions.
- Randomness is requested & fulfilled off-chain using Orao VRF.
- Modify MongoDB models and connection as needed.

---

## License

MIT License © 2025  
Developed by [Your Project or Team Name]
