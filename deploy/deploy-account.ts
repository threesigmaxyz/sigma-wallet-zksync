import { utils, Wallet, Provider, EIP712Signer, types } from "zksync-web3";
import * as ethers from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";

// Put the address of your AA factory
const ACCOUNT_FACTORY_ADDRESS = "0x26b368C3Ed16313eBd6660b72d8e4439a697Cb0B";

export default async function (hre: HardhatRuntimeEnvironment) {
  const provider = new Provider("http://127.0.0.1:3050");
  // Private key of the account used to deploy
  const wallet = new Wallet("0x7726827caac94a7f9e1b160f7ea819f172f7b6f9d2a97f992c38edeab82d4110").connect(provider);
  const factoryArtifact = await hre.artifacts.readArtifact("JWTAccountFactory");

  const aaFactory = new ethers.Contract(
    ACCOUNT_FACTORY_ADDRESS,
    factoryArtifact.abi,
    wallet
  );

  const userId = "aliceGoogleId";
  const authProvider = "0x111C3E89Ce80e62EE88318C2804920D4c96f92bb";
  const salt = ethers.constants.HashZero;

  // deploy account
  const tx = await aaFactory.deployAccount(userId, authProvider, salt, {
    gasLimit: 1000000,
  });
  await tx.wait();

  // Getting the address of the deployed contract account
  const abiCoder = new ethers.utils.AbiCoder();
  const accountAddress = utils.create2Address(
    ACCOUNT_FACTORY_ADDRESS,
    await aaFactory.aaBytecodeHash(),
    salt,
    abiCoder.encode(["string", "address"], [userId, authProvider])
  );
  console.log(`Account deployed on address ${accountAddress}`);

  console.log("Sending funds to account");
  // Send funds to the multisig account we just deployed
  await (
    await wallet.sendTransaction({
      to: accountAddress,
      // You can increase the amount of ETH sent to the multisig
      value: ethers.utils.parseEther("0.008"),
    })
  ).wait();

  let accountBalance = await provider.getBalance(accountAddress);

  console.log(`Account balance is ${accountBalance.toString()}`);

  // Transaction to deploy a new account using the multisig we just deployed
  let aaTx = await aaFactory.populateTransaction.deployAccount(
    "bobGoogleId",
    authProvider,
    "0x0000000000000000000000000000000000000000000000000000000000000010",
  );

  const gasLimit = await provider.estimateGas(aaTx);
  const gasPrice = await provider.getGasPrice();

  aaTx = {
    ...aaTx,
    // deploy a new account using the multisig
    from: accountAddress,
    gasLimit: gasLimit,
    gasPrice: gasPrice,
    chainId: (await provider.getNetwork()).chainId,
    nonce: await provider.getTransactionCount(accountAddress),
    type: 113,
    customData: {
      gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
    } as types.Eip712Meta,
    value: ethers.BigNumber.from(0),
  };

  const providerName_ = "Google";
  const headerJson_ = '{"alg":"RS256","kid": "3db3ed6b9574ee3fcd9f149e59ff0eef4f932153", "typ":"JWT"}';
  const payloadJson_ = '{"sub":"aliceGoogleId","name":"John Doe","iat":1516239022,"nonce":"xf30B2uPOlNXxeOVq5cLW1QJj-8","aud":"theaudience.zeppelin.solutions"}';
  const authSignature = ethers.utils.arrayify("0x0123456789abcd"); // converting hex string to bytes
  const signature = ethers.utils.defaultAbiCoder.encode(
      ['string', 'string', 'string', 'bytes'], 
      [providerName_, headerJson_, payloadJson_, authSignature]
  );

  aaTx.customData = {
    ...aaTx.customData,
    customSignature: signature,
  };

  console.log(
    `The accounts's nonce before the first tx is ${await provider.getTransactionCount(
      accountAddress
    )}`
  );
  const sentTx = await provider.sendTransaction(utils.serialize(aaTx));
  await sentTx.wait();

  // Checking that the nonce for the account has increased
  console.log(
    `The multisig's nonce after the first tx is ${await provider.getTransactionCount(
      accountAddress
    )}`
  );

  accountBalance = await provider.getBalance(accountAddress);

  console.log(`Multisig account balance is now ${accountBalance.toString()}`);
}
