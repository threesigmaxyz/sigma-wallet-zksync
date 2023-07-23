// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "@matterlabs/zksync-contracts/l2/system-contracts/interfaces/IAccount.sol";
import "@matterlabs/zksync-contracts/l2/system-contracts/libraries/TransactionHelper.sol";

// Access zkSync system contracts, in this case for nonce validation vs NONCE_HOLDER_SYSTEM_CONTRACT
import "@matterlabs/zksync-contracts/l2/system-contracts/Constants.sol";
// to call non-view method of system contracts
import "@matterlabs/zksync-contracts/l2/system-contracts/libraries/SystemContractsCaller.sol";

import { IProvider } from "./providers/interfaces/IProvider.sol";

contract JWTAccount is IAccount {
    // to get transaction hash
    using TransactionHelper for Transaction;

    string public ownerId;
    IProvider internal immutable _provider;

    /// @dev The `onlyBootloader` modifier ensures that only the bootloader calls the
    /// `validateTransaction`, `executeTransaction`, `payForTransaction`, and `prepareForPaymaster` functions.
    modifier onlyBootloader() {
        require(msg.sender == BOOTLOADER_FORMAL_ADDRESS, "Only bootloader can call this function");
        // Continue execution if called from the bootloader.
        _;
    }

    constructor(string memory ownerId_, address provider_) {
        ownerId = ownerId_;
        _provider = IProvider(provider_);
    }

    function validateTransaction(bytes32, bytes32 suggestedSignedHash_, Transaction calldata transaction_)
        external
        payable
        override
        onlyBootloader
        returns (bytes4 magic)
    {
        magic = _validateTransaction(suggestedSignedHash_, transaction_);
    }

    function executeTransaction(bytes32, bytes32, Transaction calldata transaction_)
        external
        payable
        override
        onlyBootloader
    {
        _executeTransaction(transaction_);
    }

    function executeTransactionFromOutside(Transaction calldata transaction_) external payable {
        _validateTransaction(bytes32(0), transaction_);
        _executeTransaction(transaction_);
    }

    function payForTransaction(bytes32, bytes32, Transaction calldata _transaction)
        external
        payable
        override
        onlyBootloader
    {
        bool success = _transaction.payToTheBootloader();
        require(success, "Failed to pay the fee to the operator");
    }

    function prepareForPaymaster(
        bytes32, // _txHash
        bytes32, // _suggestedSignedHash
        Transaction calldata _transaction
    ) external payable override onlyBootloader {
        _transaction.processPaymasterInput();
    }

    fallback() external {
        // fallback of default account shouldn't be called by bootloader under no circumstances
        assert(msg.sender != BOOTLOADER_FORMAL_ADDRESS);

        // If the contract is called directly, behave like an EOA
    }

    receive() external payable {
        // If the contract is called directly, behave like an EOA.
        // Note, that is okay if the bootloader sends funds with no calldata as it may be used for refunds/operator payments
    }

    function _validateTransaction(
        bytes32 _suggestedSignedHash,
        Transaction calldata _transaction
    ) internal returns (bytes4 magic) {
        // Incrementing the nonce of the account.
        // Notice, that reserved[0] by convention is currently equal to the nonce passed in the transaction.
        // https://era.zksync.io/docs/reference/concepts/account-abstraction.html#keeping-nonces-unique
        SystemContractsCaller.systemCallWithPropagatedRevert(
            uint32(gasleft()),
            address(NONCE_HOLDER_SYSTEM_CONTRACT),
            0,
            abi.encodeCall(INonceHolder.incrementMinNonceIfEquals, (_transaction.nonce))
        );

        // While the suggested signed hash is usually provided, it is generally
        // not recommended to rely on it to be present, since in the future
        // there may be tx types with no suggested signed hash.
        bytes32 txHash = (_suggestedSignedHash == bytes32(0))
            ? _transaction.encodeHash()
            : _suggestedSignedHash;

        // TODO what is this?
        // The fact there is are enough balance for the account
        // should be checked explicitly to prevent user paying for fee for a
        // transaction that wouldn't be included on Ethereum.
        // uint256 totalRequiredBalance = _transaction.totalRequiredBalance();
        // require(totalRequiredBalance <= address(this).balance, "Not enough balance for fee + value");

        return _isValidSignature(_transaction.signature)?
            ACCOUNT_VALIDATION_SUCCESS_MAGIC :
            bytes4(0);
    }

    function _executeTransaction(Transaction calldata _transaction) internal {
        address to = address(uint160(_transaction.to));
        uint128 value = Utils.safeCastToU128(_transaction.value);
        bytes memory data = _transaction.data;

        if (to == address(DEPLOYER_SYSTEM_CONTRACT)) {
            uint32 gas = Utils.safeCastToU32(gasleft());

            // Note, that the deployer contract can only be called
            // with a "systemCall" flag.
            SystemContractsCaller.systemCallWithPropagatedRevert(gas, to, value, data);
        } else {
            bool success;
            assembly {
                success := call(gas(), to, value, add(data, 0x20), mload(data), 0, 0)
            }
            require(success);
        }
    }

    function _isValidSignature(bytes memory txSignature_) internal view returns (bool valid_) {
        (
            string memory providerName_,
            string memory headerJson_,
            string memory payloadJson_,
            bytes memory signature_
        ) = abi.decode((txSignature_), (string, string, string, bytes));

        return _provider.verifyToken(headerJson_, payloadJson_, signature_, ownerId);
    }
}