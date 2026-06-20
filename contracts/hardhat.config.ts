import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config({ path: "../.env" });

const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
const accounts = privateKey ? [privateKey] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    "celo-alfajores": {
      url: process.env.CELO_ALFAJORES_RPC_URL ?? "https://alfajores-forno.celo-testnet.org",
      chainId: 44787,
      accounts,
      gasPrice: 1_000_000_000,
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL ?? "https://rpc.sepolia.org",
      accounts,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
    },
  },
};

export default config;
