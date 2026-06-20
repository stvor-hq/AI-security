import { ethers } from "hardhat";
import fs from "fs";
import path from "path";
import { generateMockPaymentHeader, verifyPaymentHeader } from "../../src/x402/index";
import { computeAttestationHash } from "../../src/contracts/on-chain";

interface DeployedAddresses {
  network: string;
  chainId: number;
  token: string;
  agenticCommerce: string;
  deployer: string;
}

function loadAddresses(): DeployedAddresses {
  const filePath = path.resolve(__dirname, "../../src/contracts/addresses.json");
  if (!fs.existsSync(filePath)) {
    throw new Error("Run deploy:celo-testnet first to create src/contracts/addresses.json");
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as DeployedAddresses;
}

async function main(): Promise<void> {
  const addresses = loadAddresses();
  const [signer] = await ethers.getSigners();
  if (!signer) {
    throw new Error("DEPLOYER_PRIVATE_KEY is required");
  }

  const network = await ethers.provider.getNetwork();
  const token = await ethers.getContractAt("MockERC20", addresses.token);
  const commerce = await ethers.getContractAt("AgenticCommerce", addresses.agenticCommerce);

  console.log("Network:", network.name, "chainId:", network.chainId.toString());
  console.log("Token:", addresses.token);
  console.log("AgenticCommerce:", addresses.agenticCommerce);

  const budget = ethers.parseEther("25");
  const provider = signer.address;
  const evaluator = signer.address;
  const expiredAt = Math.floor(Date.now() / 1000) + 24 * 60 * 60;

  const createTx = await commerce.createJob(
    provider,
    evaluator,
    expiredAt,
    "PQC-wrapped x402 demo job",
    ethers.ZeroAddress
  );
  const createReceipt = await createTx.wait();
  if (!createReceipt) {
    throw new Error("createJob transaction did not produce a receipt");
  }
  const jobId = createReceipt.logs
    .map((log) => {
      try {
        return commerce.interface.parseLog(log);
      } catch {
        return undefined;
      }
    })
    .find((event) => event?.name === "JobCreated")?.args.jobId;

  if (!jobId) {
    throw new Error("JobCreated event not found");
  }

  const setBudgetTx = await commerce.setBudget(jobId, budget, "0x");
  await setBudgetTx.wait();

  const approveTx = await token.approve(addresses.agenticCommerce, budget);
  await approveTx.wait();

  const paymentHeader = generateMockPaymentHeader(
    signer.address,
    provider,
    addresses.token,
    budget.toString(),
    "celo-alfajores"
  );
  const payment = verifyPaymentHeader(paymentHeader, budget.toString());
  if (!payment.valid) {
    throw new Error(`Invalid x402 payment header: ${payment.reason}`);
  }

  const fundTx = await commerce.fund(Number(jobId), "0x");
  const fundReceipt = await fundTx.wait();
  if (!fundReceipt) {
    throw new Error("fund transaction did not produce a receipt");
  }

  const deliverable = computeAttestationHash({
    jobId: Number(jobId),
    result: "demo work completed through PQC transport",
    x402: paymentHeader,
  });

  const submitTx = await commerce.submit(Number(jobId), deliverable, "0x");
  await submitTx.wait();

  const completeTx = await commerce.complete(Number(jobId), deliverable, "0x");
  const completeReceipt = await completeTx.wait();
  if (!completeReceipt) {
    throw new Error("complete transaction did not produce a receipt");
  }

  console.log("Test tx 1 (mint/approve/fund path):", fundReceipt.hash);
  console.log("Test tx 2 (submit/complete path):", completeReceipt.hash);
  console.log("x402 payment header:", paymentHeader);
  console.log("ERC-8183 job:", jobId.toString());
  console.log("On-chain status: COMPLETE (mock x402 escrow reservation verified)");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
