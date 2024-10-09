import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { mplBubblegum } from "@metaplex-foundation/mpl-bubblegum";
import { publicKey } from "@metaplex-foundation/umi";
import dotenv from "dotenv";

dotenv.config();

const RPC_URL = process.env.RPC_URL;
if (!RPC_URL) throw new Error("RPC_URL not defined in .env");

console.log("Using RPC URL:", RPC_URL);

const umi = createUmi(RPC_URL).use(mplBubblegum());

async function fetchUserCNFTs(userAddress: string) {
  console.log("Fetching assets...");
  console.log("User Address:", userAddress);

  try {
    const assets = await umi.rpc.getAssetsByOwner({
      owner: publicKey(userAddress),
    });

    console.log(`Total assets: ${assets.items.length}`);

    const compressedNFTs = assets.items.filter(
      (asset) => asset.compression.compressed
    );

    console.log(`Compressed NFTs: ${compressedNFTs.length}`);

    compressedNFTs.forEach((asset, index) => {
      console.log(`Compressed NFT #${index + 1}:`);
      console.log("  Address:", asset.id);
      console.log("  Name:", asset.content.metadata?.name);
      console.log("  URI:", asset.content.json_uri);
      console.log("  Owner:", asset.ownership.owner);
      console.log("---");
    });
  } catch (error) {
    console.error("Error fetching assets:", error);
  }
}

const userAddress = process.argv[2];
if (!userAddress) {
  console.error("Provide a user address as a command-line argument");
  process.exit(1);
}

fetchUserCNFTs(userAddress);
