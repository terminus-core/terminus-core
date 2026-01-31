import "@nomicfoundation/hardhat-toolbox";
import dotenv from "dotenv";
dotenv.config();

/** @type {import('hardhat/config').HardhatUserConfig} */
const config = {
    solidity: {
        version: "0.8.20",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
        },
    },
    networks: {
        "base-sepolia": {
            url: "https://sepolia.base.org",
            chainId: 84532,
            accounts: [process.env.DEPLOYER_PRIVATE_KEY],
        },
        hardhat: {
            chainId: 31337,
        },
    },
    etherscan: {
        apiKey: {
            "base-sepolia": process.env.BASESCAN_API_KEY || "",
        },
        customChains: [
            {
                network: "base-sepolia",
                chainId: 84532,
                urls: {
                    apiURL: "https://api-sepolia.basescan.org/api",
                    browserURL: "https://sepolia.basescan.org",
                },
            },
        ],
    },
};

export default config;
