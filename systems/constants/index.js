import { ethers } from 'ethers';

import functionsConsumerAbi from './abi/FunctionsConsumer.json';
import functionsOracleAbi from './abi/FunctionsOracle.json';
import functionsBillingRegistryAbi from './abi/FunctionsBillingRegistry.json';
import linkTokenInterfaceAbi from './abi/LinkTokenInterface.json';
import networkMapping from './networkMapping.json';
import source from './source';

const ReturnType = {
  uint: 'uint256',
  uint256: 'uint256',
  int: 'int256',
  int256: 'int256',
  string: 'string',
  bytes: 'Buffer',
  Buffer: 'Buffer',
};

/**
 * @notice Update these
 */

// Add providers for each network
const PROVIDERS = {
  sepolia: new ethers.providers.JsonRpcProvider(
    process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL,
  ),
};

// Add secrets
const SECRETS = { };

// Update return type depending on the source code
const RETURN_TYPE = ReturnType.uint256;

const GAS_LIMIT = 300000;

/**
 * @notice Don't change these
 */

const getStaticParams = () => ({
  abi: {
    consumer: functionsConsumerAbi,
    oracle: functionsOracleAbi,
    registry: functionsBillingRegistryAbi,
    linkToken: linkTokenInterfaceAbi,
  },
  source,
  secrets: SECRETS,
  returnType: RETURN_TYPE,
  gasLimit: GAS_LIMIT,
});

const getDynamicParams = (networkName) => ({
  contractAddress: networkMapping[networkName].contractAddress,
  subId: networkMapping[networkName].subId,
});

const getSigner = (networkName) => new ethers.Wallet(process.env.NEXT_PUBLIC_PRIVATE_KEY, PROVIDERS[networkName]);

export { getStaticParams, getDynamicParams, getSigner };
