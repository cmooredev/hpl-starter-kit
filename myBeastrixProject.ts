import {
  Connection,
  Keypair,
  VersionedTransaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import createEdgeClient from "@honeycomb-protocol/edge-client";
import fs from "fs";
import bs58 from "bs58";

const API_URL = process.env.API_URL || "https://edge.eboy.dev/";
const RPC_URL = process.env.RPC_URL || "https://rpc.eboy.dev/";

const connection = new Connection(RPC_URL, "confirmed");
const client = createEdgeClient(API_URL, false);

// Load your admin keypair
const adminKeypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync("./keys/admin.json", "utf-8")))
);

async function createBeastrixProject() {
  const { createCreateProjectTransaction } =
    await client.createCreateProjectTransaction({
      name: "tester",
      authority: adminKeypair.publicKey.toString(),
      payer: adminKeypair.publicKey.toString(),
    });

  console.log(
    "Project transaction created:",
    createCreateProjectTransaction.project
  );

  // Decode the transaction
  const decodedTransaction = bs58.decode(
    createCreateProjectTransaction.tx.transaction
  );
  const transaction = VersionedTransaction.deserialize(decodedTransaction);

  // Sign the transaction
  transaction.sign([adminKeypair]);

  // Send and confirm the transaction
  const signature = await connection.sendTransaction(transaction);
  console.log("Transaction sent. Signature:", signature);

  await connection.confirmTransaction(signature);
  console.log("Transaction confirmed");

  // Fetch the created project
  const project = await client.findProjects({
    addresses: [createCreateProjectTransaction.project],
  });
  console.log("Created project:", project.project[0]);

  return project.project[0];
}

async function main() {
  console.log("Connection and client created");
  const project = await createBeastrixProject();
  console.log("Beastrix project created successfully:", project.address);
}

main().catch(console.error);
