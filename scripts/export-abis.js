const fs = require("fs");
const path = require("path");

async function main() {
  const artifactsDir = path.resolve(__dirname, "..", "artifacts", "contracts");
  const frontendAbisDir = path.resolve(__dirname, "..", "frontend", "src", "abis");

  if (!fs.existsSync(frontendAbisDir)) {
    fs.mkdirSync(frontendAbisDir, { recursive: true });
  }

  const contractsToExport = ["CampaignFactory", "Campaign"];

  for (const contractName of contractsToExport) {
    const artifactPath = path.join(artifactsDir, `${contractName}.sol`, `${contractName}.json`);
    if (!fs.existsSync(artifactPath)) {
      console.error(`Artifact not found for ${contractName} at ${artifactPath}`);
      console.error("Make sure to compile contracts first with `npx hardhat compile`");
      process.exitCode = 1;
      continue;
    }

    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    const abi = artifact.abi;

    const outputPath = path.join(frontendAbisDir, `${contractName}.json`);
    fs.writeFileSync(outputPath, JSON.stringify({ abi }, null, 2));
    console.log(`Exported ABI for ${contractName} -> ${outputPath}`);
  }

  console.log("ABI export complete.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
