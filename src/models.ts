// models.ts
import mongoose from 'mongoose';

const PotSchema = new mongoose.Schema({
    pot: String,
    authority: String,
    ticket_price: Number,
    tickets_sold: Number,
    ticket_capacity: Number,
    mint: String,
    round: Number,
    vault: String,
    created_at: { type: Date, default: Date.now },
});

const TicketSchema = new mongoose.Schema({
    lotteryPot: String,
    ticketIndex: Number,
    buyer: String,
    round: Number,
    timestamp: { type: Date, default: Date.now },
    txSig: String,
});

const PayoutSchema = new mongoose.Schema({
    lotteryPot: String,
    winner: String,
    txSig: String,
    amount: Number,
    round: Number,
    vrfTx: String,
    timestamp: { type: Date, default: Date.now },
});



export const Pot = mongoose.model('Pot', PotSchema);
export const Ticket = mongoose.model('Ticket', TicketSchema);
export const Payout = mongoose.model('Payout', PayoutSchema);
