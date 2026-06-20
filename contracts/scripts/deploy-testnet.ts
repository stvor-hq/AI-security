import { ethers, upgrades } from "hardhat";
import fs from "fs";
import path from "path";

interface DeployedAddresses {
  network: string;
  chainId: number;
  token: string;
  agenticCommerce: string;
  deployedAt: string;
  deployer: string;
}

function outputPath(): string {
  const dir = path.resolve(__dirname, "../../src/contracts");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "addresses.json");
}

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error("DEPLOYER_PRIVATE_KEY is required for celo-alfajores deployment");
  }

  const network = await ethers.provider.getNetwork();
  console.log("Deploying to:", network.name, "chainId:", network.chainId.toString());
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "CELO");

  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const token = await MockERC20.deploy();
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("MockERC20 (STVOR):", tokenAddress);

  const AgenticCommerce = await ethers.getContractFactory("AgenticCommerce");
  const commerce = await upgrades.deployProxy(
    AgenticCommerce,
    [tokenAddress, deployer.address],
    { initializer: "initialize" }
  );
  await commerce.waitForDeployment();
  const commerceAddress = await commerce.getAddress();
  console.log("AgenticCommerce:", commerceAddress);

  const mintTx = await token.mint(deployer.address, ethers.parseEther("100000"));
  await mintTx.wait();
  console.log("Minted 100,000 STVOR to deployer");

  const addresses: DeployedAddresses = {
    network: "celo-alfajores",
    chainId: Number(network.chainId),
    token: tokenAddress,
    agenticCommerce: commerceAddress,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
  };

  fs.writeFileSync(outputPath(), JSON.stringify(addresses, null, 2));
  console.log("Addresses saved to src/contracts/addresses.json");
  console.log("Deployment complete");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
