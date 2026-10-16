#!/usr/bin/env node
/**
 * x402-base-paywall-sdk — Production HTTP 402 (x402) Base Mainnet USDC Paywall & On-Chain Verifier
 * Zero external dependencies. Runs natively on Node.js 18+.
 */

export const BASE_MAINNET_CHAIN_ID = 8453;
export const BASE_USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
export const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

export function buildX402Challenge({ recipientWallet, amountUsdc, resource, description = "AI API Micro-Settlement" }) {
  const atomicUnits = BigInt(Math.round(Number(amountUsdc) * 1e6)).toString();
  return {
    status: 402,
    headers: {
      "WWW-Authenticate": `x402 chainId="${BASE_MAINNET_CHAIN_ID}", token="${BASE_USDC_ADDRESS}", recipient="${recipientWallet}", amount="${atomicUnits}"`,
      "X-Payment-Chain-Id": String(BASE_MAINNET_CHAIN_ID),
      "X-Payment-Token": BASE_USDC_ADDRESS,
      "X-Payment-Recipient": recipientWallet,
      "X-Payment-Amount-Usdc": String(amountUsdc),
    },
    body: {
      error: "Payment Required (HTTP 402)",
      protocol: "x402-base-usdc-v1",
      chainId: BASE_MAINNET_CHAIN_ID,
      tokenAddress: BASE_USDC_ADDRESS,
      recipientWallet,
      amountUsdc: Number(amountUsdc),
      amountAtomic: atomicUnits,
      eip681PaymentUri: `ethereum:${BASE_USDC_ADDRESS}@${BASE_MAINNET_CHAIN_ID}/transfer?address=${recipientWallet}&uint256=${atomicUnits}`,
      resource,
      description,
    },
  };
}

export async function verifyBaseUsdcTx({ txHash, expectedRecipient, minAmountUsdc = 0.01, rpcUrl = "https://mainnet.base.org" }) {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getTransactionReceipt", params: [txHash] }),
  });
  const data = await res.json();
  const receipt = data?.result;
  if (!receipt || receipt.status !== "0x1") {
    return { verified: false, reason: "Transaction not found or reverted on Base Mainnet" };
  }
  const paddedRecipient = expectedRecipient.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  const minAtomic = BigInt(Math.round(Number(minAmountUsdc) * 1e6));
  for (const log of receipt.logs || []) {
    if (
      String(log.address).toLowerCase() === BASE_USDC_ADDRESS.toLowerCase() &&
      log.topics?.[0]?.toLowerCase() === TRANSFER_TOPIC &&
      log.topics?.[2]?.toLowerCase() === "0x" + paddedRecipient
    ) {
      const valueAtomic = BigInt(log.data || "0x0");
      if (valueAtomic >= minAtomic) {
        return {
          verified: true,
          chainId: BASE_MAINNET_CHAIN_ID,
          txHash,
          recipient: expectedRecipient,
          amountUsdc: Number(valueAtomic) / 1e6,
          blockNumber: parseInt(receipt.blockNumber, 16),
        };
      }
    }
  }
  return { verified: false, reason: "No matching Base USDC Transfer event to expected recipient" };
}

export async function getLiveBaseNetworkStatus(rpcUrl = "https://mainnet.base.org") {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify([
      { jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] },
      { jsonrpc: "2.0", id: 2, method: "eth_gasPrice", params: [] },
    ]),
  });
  const arr = await res.json();
  const blockHex = arr.find((x) => x.id === 1)?.result || "0x0";
  const gasHex = arr.find((x) => x.id === 2)?.result || "0x0";
  return {
    chain: "Base Mainnet (8453)",
    blockNumber: parseInt(blockHex, 16),
    gasPriceGwei: Math.round((Number(BigInt(gasHex)) / 1e9) * 10000) / 10000,
    usdcContract: BASE_USDC_ADDRESS,
  };
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}` || process.argv.includes("--demo")) {
  const net = await getLiveBaseNetworkStatus();
  const sampleChallenge = buildX402Challenge({
    recipientWallet: "0x3806cd592a508d1992Ed007C2F53de251C2E7452",
    amountUsdc: 0.5,
    resource: "/api/v1/ai-security-audit",
  });
  console.log(JSON.stringify({ liveNetwork: net, sampleHttp402Challenge: sampleChallenge }, null, 2));
}
