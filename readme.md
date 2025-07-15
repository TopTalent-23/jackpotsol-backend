# 🎰 Solana Lottery Pot Smart Contract (Anchor)

This is a decentralized **lottery program** built using the [Anchor framework](https://book.anchor-lang.com/) on **Solana**.

Participants buy tickets using a specified SPL token. Once all tickets are sold, a random winner is selected and rewarded with 95% of the pot, while 5% is burned. A small developer fee is paid in SOL when the pot is created.

---

## 📦 Program Features

- ✅ Lottery pot creation with custom ticket price and capacity
- ✅ Dev fee enforcement (0.1 SOL to a fixed developer wallet)
- ✅ Ticket purchases in SPL tokens
- ✅ Automatic payout: 95% to winner, 5% burn
- ✅ Secure randomness via off-chain VRF integration
- ✅ Emits events for all major actions (pot creation, ticket bought, payout)

---

## 🔧 Instructions

### 🧾 `create_pot`

Initializes a new lottery pot.

- **Inputs:**
  - `ticket_price`: Price per ticket in SPL token smallest units (e.g. USDC: 6 decimals)
  - `ticket_capacity`: Total number of tickets for this round
- **Dev Fee:** Sends `0.1 SOL` to hardcoded developer wallet
- **Accounts:**
  - `lottery_pot` (PDA): New pot account
  - `backend_authority`: Admin authority creating the pot
  - `vault`: SPL token account to store funds
  - `developer_wallet`: Must match constant in code
  - `mint`: Token mint
  - System & Token programs

---

### 🧾 `buy_ticket`

Allows a user to buy 1 ticket.

- **Checks:** Pot must not be full
- **Transfers:** `ticket_price` amount of token from buyer → vault
- **Accounts:**
  - `lottery_pot`: Target pot
  - `buyer`: User buying ticket
  - `buyer_token_account`: User's token account
  - `vault`: Token vault for pot
  - Token program

---

### 🧾 `fulfill_and_payout`

Executes the payout when all tickets are sold.

- **Inputs:**
  - `_randomness`: 128-bit random seed (used off-chain)
  - `_winner_pubkey`: Winner’s public key (verified off-chain)
- **Logic:**
  - Calculates pot total = `ticket_price * ticket_capacity`
  - Transfers 95% to winner's token account
  - Burns remaining 5% from vault
- **Accounts:**
  - `lottery_pot`: Pot
  - `authority`: Must match `pot.authority`
  - `vault`: Token vault
  - `mint`: Token mint
  - `winner_token_account`: Winner’s token account
  - Token program

---

## 📂 Account Structures

### 🗃️ `LotteryPot`

Stores pot state.

```rust
pub struct LotteryPot {
    pub authority: Pubkey,
    pub ticket_price: u64,
    pub ticket_capacity: u64,
    pub tickets_sold: u64,
}
```

Size: `32 + 8 + 8 + 8 = 56 bytes`

---

## 📡 Events

These can be used by off-chain services to track state changes in real-time.

```rust
PotCreated {
    pot: Pubkey,
    authority: Pubkey,
    ticket_price: u64,
    ticket_capacity: u64,
    mint: Pubkey,
    vault: Pubkey,
}

TicketBought {
    buyer: Pubkey,
    tickets_sold: u64,
    ticket_capacity: u64,
    pot: Pubkey,
}

PayoutFulfilled {
    winner: Pubkey,
    pot: Pubkey,
    amount: u64,
}
```

---

## 🚫 Errors

```rust
pub enum LotteryError {
    PotNotFull,
    PotFull,
    InvalidDeveloperWallet,
}
```

---

## 🧪 Example Use Case

1. Backend creates pot using `create_pot()`
2. Users buy tickets until capacity is reached via `buy_ticket()`
3. Backend listens for full pot and off-chain triggers `fulfill_and_payout()` with randomness

---

## 📌 Constants

```rust
const DEVELOPER_WALLET: &str = "GgTuQFdcyWpso1HwWFkdcreqLNzGoNRhprTx6qaBhZtf";
const DEV_FEE_LAMPORTS: u64 = 100_000_000; // 0.1 SOL
```

---

## 📜 Deployment

Set up your Anchor project as usual.

Build & deploy the program:

```bash
anchor build
anchor deploy --provider.cluster mainnet
```

Make sure your local wallet is the authority that will sign `create_pot`.

---

## 🛡️ Security Considerations

- The program enforces developer wallet match for fees.
- Only `authority` can trigger payouts.
- Payout randomness must be handled off-chain (use Orao VRF or similar).
- Token burn ensures supply deflation and added scarcity.

---

## 📃 License

MIT License © 2025  
Developed by [Your Project or Team Name]
