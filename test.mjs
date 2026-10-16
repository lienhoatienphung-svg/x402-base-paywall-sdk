import assert from "node:assert";
import { buildX402Challenge, getLiveBaseNetworkStatus } from "./index.mjs";

const challenge = buildX402Challenge({
  recipientWallet: "0x3806cd592a508d1992Ed007C2F53de251C2E7452",
  amountUsdc: 1.25,
  resource: "/v1/agent-inference",
});
assert.strictEqual(challenge.status, 402);
assert.strictEqual(challenge.body.amountAtomic, "1250000");
assert.ok(challenge.headers["WWW-Authenticate"].includes("chainId=\"8453\""));

const net = await getLiveBaseNetworkStatus();
assert.ok(net.blockNumber > 10000000, "Live Base Mainnet block number must be > 10M");
console.log("PASS: x402-base-paywall-sdk verified against Base Mainnet Block #" + net.blockNumber);
