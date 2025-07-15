import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { AnchorProvider, Wallet, BN, Program, BorshCoder, Idl, EventParser } from "@coral-xyz/anchor";
import { Orao } from "@orao-network/solana-vrf";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import dotenv from "dotenv";
import bs58 from "bs58";
import idl from "./idl/lottery_pot.json";
import { Pot, Ticket, Payout } from "./models";

dotenv.config();

const RPC_URL = "http://api.mainnet-beta.solana.com";
const BACKEND_AUTH = Keypair.fromSecretKey(bs58.decode(process.env.BACKEND_AUTH!));
const eventParser = new EventParser(new PublicKey(idl.address), new BorshCoder(idl as Idl));
const connection = new Connection(RPC_URL, {
    wsEndpoint: 'https://api.mainnet-beta.solana.com/ws/',
    commitment: 'confirmed'
});
const wallet = new Wallet(BACKEND_AUTH);
console.log(wallet.publicKey)
const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });

async function requestAndFulfillRandomness(
    program: Program,
    lotteryPot: PublicKey,
    vault: PublicKey,
    mint: PublicKey,
    buyers: PublicKey[],
) {
    const vrf = new Orao(provider);
    const [seed, vrfTx] = await (await vrf.request()).rpc();
    const randomness = await vrf.waitFulfilled(seed, 'confirmed');

    const randomBig = randomness.randomness.slice(0, 8).reduce(
        (acc, byte, idx) => acc + (BigInt(byte) << BigInt(idx * 8)),
        BigInt(0)
    );

    const winnerIndex = Number(randomBig % BigInt(buyers.length));
    const winner = buyers[winnerIndex];
    const winnerAta = await getAssociatedTokenAddress(mint, winner);

    const tx = await program.methods
        .fulfillAndPayout(new BN(winnerIndex), winner)
        .accounts({
            lotteryPot,
            authority: BACKEND_AUTH.publicKey,
            vault,
            mint,
            winnerTokenAccount: winnerAta,
        })
        .transaction();

    tx.feePayer = BACKEND_AUTH.publicKey;
    let latestBlockhash = (await connection.getLatestBlockhash());
    tx.recentBlockhash = latestBlockhash.blockhash;
    tx.sign(BACKEND_AUTH);


    const txSig = await connection.sendRawTransaction(tx.serialize());
    latestBlockhash = (await connection.getLatestBlockhash());
    const confirmation = await connection.confirmTransaction(
        {
            signature: txSig,
            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
            blockhash: latestBlockhash.blockhash,
        },
        "confirmed"
    );
    console.log("✅ Transaction confirmed:", txSig);

    // Optional: Check for errors in confirmation
    if (confirmation.value.err) {
        console.error("❌ Transaction failed:", confirmation.value.err);
    }
    const pot = await Pot.findOne({ pot: lotteryPot.toBase58() })
    if (pot) {
        await Payout.create({
            lotteryPot: lotteryPot.toBase58(),
            winner: winner.toBase58(),
            txSig,
            round: pot.round,
            amount: pot.ticket_capacity! * pot.ticket_price! * 0.95,
            vrfTx,
            timestamp: new Date(),
        });
        await Pot.updateOne({ pot: lotteryPot.toBase58() }, { tickets_sold: 0, $inc: { round: 1 } })
    }

}
let potVault = '';
export async function startListener() {
    const program = new Program(idl as Idl, provider);

    connection.onLogs(program.programId, async (logInfo) => {
        try {
            const events = [...eventParser.parseLogs(logInfo.logs)];

            for (const event of events) {
                if (event.name === "PotCreated") {
                    const { pot, mint, vault, authority, ticket_price, ticket_capacity } = event.data;
                    potVault = vault
                    await Pot.create({
                        pot: pot.toBase58(),
                        authority: authority.toBase58(),
                        ticket_price: Number(ticket_price),
                        ticket_capacity: Number(ticket_capacity),
                        tickets_sold: 0,
                        round: 1,
                        mint: mint.toBase58(),
                        vault: vault.toBase58(),
                    });
                }

                if (event.name === "TicketBought") {
                    const { buyer, tickets_sold, ticket_capacity, pot } = event.data;
                    const potData = await Pot.findOneAndUpdate({ pot }, {
                        tickets_sold: parseInt(tickets_sold)
                    })
                    await Ticket.insertOne(
                        {
                            buyer: buyer.toBase58(),
                            lotteryPot: potData!.pot,
                            round: potData!.round,
                            ticketIndex: tickets_sold,
                            timestamp: new Date(),
                            txSig: logInfo.signature || "",
                        },
                    );
                    if (Number(tickets_sold) == Number(ticket_capacity)) {
                        const potData = await Pot.findOne({ pot });
                        const buyers = await Ticket.find({ lotteryPot: pot })
                            .sort({ ticketIndex: 1 })
                            .then((docs) => docs.map((t) => new PublicKey(t.buyer!)));

                        await requestAndFulfillRandomness(
                            program,
                            new PublicKey(pot),
                            new PublicKey(potData!.vault!),
                            new PublicKey(potData!.mint!),
                            buyers,
                        );
                    }
                }
                if (event.name === "PayoutFulfilled") {
                    const { pot } = event.data;

                }


            }
        } catch (err) {
            console.error("Error parsing logs", err);
        }
    });
}
