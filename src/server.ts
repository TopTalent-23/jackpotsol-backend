import express, { Request, Response } from "express";
import http from "http";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { Server as SocketIOServer } from "socket.io";
import { Pot, Ticket, Payout } from "./models"; // ensure correct path
import { startListener } from "./listener";
import { Transaction } from "@solana/web3.js";

dotenv.config();

// === CONFIG ===
const MONGO_URL = process.env.MONGO_URL || "MONGODB_URL";
const PORT = parseInt(process.env.PORT || "5000", 10);

// === EXPRESS + SOCKET ===
const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

// === SOCKET CONNECTION ===
io.on("connection", (socket) => {
    console.log("🔌 New WebSocket connection:", socket.id);
});

// === DATABASE CONNECTION ===

// === EXPRESS ROUTES ===
app.get("/pots", async (req, res) => {
    const { pot } = req.query;
    const limit = parseInt(req.query.limit as string) || 10;
    const page = parseInt(req.query.page as string) || 1;
    const skip = (page - 1) * limit;

    try {
        const pots = await Pot.aggregate([
            // Optional match by pot address
            ...(pot ? [{ $match: { pot } }] : []),

            // Sort by most recently created
            { $sort: { created_at: 1 } },

            // Pagination
            { $skip: skip },
            { $limit: limit },

            // Lookup last 10 winners
            {
                $lookup: {
                    from: "payouts", // ⚠️ collection name must match actual Mongo collection
                    let: { potId: "$pot" },
                    pipeline: [
                        { $match: { $expr: { $eq: ["$lotteryPot", "$$potId"] } } },
                        { $sort: { timestamp: -1 } },
                        { $limit: 10 }
                    ],
                    as: "lastWinners"
                }
            }
        ]);

        res.json(pots);
    } catch (err) {
        console.error("Failed to fetch pots:", err);
        res.status(500).json({ error: "Failed to fetch pots" });
    }
});

app.get("/buyers/:potAddress", async (
    req: Request<{ potAddress: string }>,
    res: Response
) => {
    const { potAddress } = req.params;
    const { round } = req.query;
    const limit = parseInt(req.query.limit as string) || 10;
    const page = parseInt(req.query.page as string) || 1;
    const skip = (page - 1) * limit;

    try {
        const pot = await Pot.findOne(round ? { pot: potAddress, round: round } : { pot: potAddress });
        if (pot?.tickets_sold == 0) {
            res.json({
                page,
                limit,
                total: 0,
                buyers: []
            })
        }
        if (!pot) {
            res.status(404).json({ error: "Pot not found" });
            return;
        }


        const buyers = await Ticket.aggregate([
            { $match: { lotteryPot: potAddress, round: pot.round } },

            { $sort: { timestamp: -1 } },


            { $skip: skip },
            { $limit: limit }
        ]);

        res.json({
            page,
            limit,
            total: buyers.length,
            buyers,
        });
    } catch (err) {
        console.log(err)
        res.status(500).json({ error: "Failed to fetch buyers" });
    }
});

app.get("/winners", async (req, res) => {
    const { potAddress } = req.query;
    const limit = parseInt(req.query.limit as string) || 10;
    const page = parseInt(req.query.page as string) || 1;
    const skip = (page - 1) * limit;

    try {
        const winners = await Payout.find(potAddress ? { lotteryPot: potAddress } : {})
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limit);

        res.json(winners);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch winners" });
    }
});

// === DATABASE CHANGE STREAM LISTENERS ===
const db = mongoose.connection;

db.once("open", () => {
    console.log("📡 Watching MongoDB changes...");

    const watchAndEmit = (
        model: mongoose.Model<any>,
        event: string,
        allowedOps: ("insert" | "update" | "delete")[] = ["insert", "update"]
    ) => {
        model.watch([], { fullDocument: "updateLookup" }).on("change", (change) => {
            if (allowedOps.includes(change.operationType as any)) {
                const data = change.fullDocument;
                io.emit(event, data);
                console.log(`📤 Emitted ${event}:`, data);
            }
        });
    };

    // Only emit on insert for Pot
    watchAndEmit(Pot, "potCreated", ["insert"]);

    // Emit on insert and update for others
    watchAndEmit(Ticket, "ticketBought", ["insert", "update"]);
    watchAndEmit(Payout, "payoutLogged", ["insert", "update"]);
});

// === START SERVER ===
server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    const uri = (process.env.MONGODB_URI || "").replace(/^"(.*)"$/, '$1');
    mongoose.connect(uri)
        .then(() => {
            startListener().catch(console.error);
        })
        .catch((err) => {
            console.error("❌ MongoDB connection error:", err);
            process.exit(1);
        });
});
