import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import {
  generateSigner,
  createSignerFromKeypair,
} from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { mplBubblegum } from "@metaplex-foundation/mpl-bubblegum";
import { mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";

import {
  mintToCollectionV1,
  createTree,
  getAssetWithProof,
  transfer,
  findLeafAssetIdPda,
  parseLeafFromMintToCollectionV1Transaction,
} from "@metaplex-foundation/mpl-bubblegum";
import { createNft } from "@metaplex-foundation/mpl-token-metadata";
import { fromWeb3JsPublicKey } from "@metaplex-foundation/umi-web3js-adapters";
import { keypairIdentity, percentAmount } from "@metaplex-foundation/umi";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const RPC_URL = process.env.RPC_URL;
console.log("RPC_URL:", RPC_URL);

const umi = createUmi(RPC_URL).use(mplBubblegum()).use(mplTokenMetadata());

const adminKeypair = loadKeypairFromFile("./keys/admin.json");
const userKeypair = loadKeypairFromFile("./keys/user.json");

const adminSigner = createSignerFromKeypair(
  umi,
  umi.eddsa.createKeypairFromSecretKey(adminKeypair.secretKey)
);
umi.use(keypairIdentity(adminSigner));
console.log("Umi created with admin keypair and necessary programs");

const TOTAL_BEASTS = 10000;
const BASE_URI = "https://beastrix.s3.amazonaws.com/beast-json/";
const DATA_FILE = "./beastrix_data.json";

function loadData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (error) {
    return { project: {}, merkleTree: {}, collectionMint: {} };
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

async function getMerkleTree() {
  const data = loadData();
  if (data.merkleTree.publicKey) {
    console.log("Using existing Merkle tree:", data.merkleTree.publicKey);
    return new PublicKey(data.merkleTree.publicKey);
  }

  // If no Merkle tree exists, create a new one (keeping your existing createMerkleTree function)
  return createMerkleTree();
}

async function getCollectionNft() {
  const data = loadData();
  if (data.collectionMint.publicKey) {
    console.log(
      "Using existing collection NFT:",
      data.collectionMint.publicKey
    );
    return new PublicKey(data.collectionMint.publicKey);
  }

  // If no collection NFT exists, create a new one (keeping your existing createCollectionNft function)
  return createCollectionNft();
}

async function createMerkleTree() {
  const data = loadData();
  if (data.merkleTree.publicKey) {
    console.log("Using existing Merkle tree:", data.merkleTree.publicKey);
    return new PublicKey(data.merkleTree.publicKey);
  }

  console.log("Creating new Merkle tree...");
  const merkleTree = generateSigner(umi);
  console.log("Created merkle tree signer:", merkleTree.publicKey);
  const builder = await createTree(umi, {
    merkleTree,
    maxDepth: 14,
    maxBufferSize: 64,
    public: true,
  });
  try {
    const result = await builder.sendAndConfirm(umi);
    console.log("Merkle tree creation result:", result);

    data.merkleTree.publicKey = merkleTree.publicKey.toString();
    saveData(data);

    return merkleTree.publicKey;
  } catch (error) {
    console.error("Failed to create Merkle tree:", error);
    throw error;
  }
}

async function createCollectionNft() {
  const data = loadData();
  if (data.collectionMint.publicKey) {
    console.log(
      "Using existing collection NFT:",
      data.collectionMint.publicKey
    );
    return new PublicKey(data.collectionMint.publicKey);
  }

  console.log("Creating new collection NFT...");
  const collectionMint = generateSigner(umi);
  await createNft(umi, {
    mint: collectionMint,
    name: "Beast Collection",
    uri: `${BASE_URI}collection.json`,
    sellerFeeBasisPoints: percentAmount(5.5),
    isCollection: true,
  }).sendAndConfirm(umi);
  console.log("Collection NFT created:", collectionMint.publicKey.toString());

  data.collectionMint.publicKey = collectionMint.publicKey.toString();
  saveData(data);

  return collectionMint.publicKey;
}

async function mintRandomBeast(
  leafOwner,
  merkleTreePublicKey,
  collectionMintPublicKey
) {
  console.log("Minting random beast for:", leafOwner.publicKey.toString());
  const randomBeastNumber = Math.floor(Math.random() * TOTAL_BEASTS) + 1;
  const beastUri = `${BASE_URI}${randomBeastNumber
    .toString()
    .padStart(4, "0")}.json`;

  const { signature } = await mintToCollectionV1(umi, {
    leafOwner: leafOwner.publicKey,
    merkleTree: merkleTreePublicKey,
    collectionMint: collectionMintPublicKey,
    metadata: {
      name: `Beast #${randomBeastNumber}`,
      uri: beastUri,
      sellerFeeBasisPoints: 500,
      collection: { key: collectionMintPublicKey, verified: false },
      creators: [
        { address: adminSigner.publicKey, verified: true, share: 100 },
      ],
    },
  }).sendAndConfirm(umi);

  console.log("Beast minted successfully");
  return { signature, randomBeastNumber };
}

async function transferNFT(assetId, currentLeafOwner, newLeafOwner) {
  console.log("Transferring NFT...");
  try {
    umi.use(keypairIdentity(currentLeafOwner));

    const assetWithProof = await getAssetWithProof(umi, assetId);
    const result = await transfer(umi, {
      ...assetWithProof,
      leafOwner: currentLeafOwner,
      newLeafOwner: newLeafOwner,
    }).sendAndConfirm(umi);

    console.log("NFT transferred successfully", result.signature.toString());
  } catch (error) {
    console.error("Failed to transfer NFT:", error);
    throw error;
  } finally {
    umi.use(keypairIdentity(adminSigner));
  }
}

async function main() {
  console.log("Starting main function");
  const merkleTreePublicKey = await getMerkleTree();
  const collectionMintPublicKey = await getCollectionNft();

  const userSigner = createSignerFromKeypair(
    umi,
    umi.eddsa.createKeypairFromSecretKey(userKeypair.secretKey)
  );
  console.log("Minting to address:", userSigner.publicKey.toString());
  const { signature, randomBeastNumber } = await mintRandomBeast(
    userSigner,
    merkleTreePublicKey,
    collectionMintPublicKey
  );
  console.log(
    `Beast #${randomBeastNumber} minted with signature: ${signature}`
  );

  console.log("Waiting for 5 seconds to ensure mint confirmation...");
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Fetch the newly minted asset
  const assets = await umi.rpc.getAssetsByOwner({
    owner: userSigner.publicKey,
  });

  const newlyMintedAsset = assets.items
    .filter(
      (asset) =>
        asset.grouping.find((g) => g.group_key === "collection")
          ?.group_value === collectionMintPublicKey.toString()
    )
    .sort((a, b) => Number(b.id) - Number(a.id))[0];

  if (!newlyMintedAsset) {
    console.error("Newly minted asset not found");
    return;
  }

  console.log("Newly Minted Asset ID:", newlyMintedAsset.id);

  const newOwnerAddress = new PublicKey(
    "AZHXSikV1rXj5ov4VpwpTrCwF5Yxq1ELUKMQAjCw5Hwg"
  );
  console.log("Transferring NFT to new owner:", newOwnerAddress.toString());

  try {
    await transferNFT(newlyMintedAsset.id, userSigner, newOwnerAddress);
    console.log("NFT transferred successfully");
  } catch (error) {
    console.error("Failed to transfer NFT:", error);
  }

  console.log("Main function completed");
}

main().catch(console.error);

function loadKeypairFromFile(filePath: string): Keypair {
  const secretKeyString = fs.readFileSync(filePath, { encoding: "utf8" });
  const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
  const keypair = Keypair.fromSecretKey(secretKey);
  console.log(`Public key for ${filePath}:`, keypair.publicKey.toString());
  return keypair;
}
