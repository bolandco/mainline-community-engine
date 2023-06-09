const { ethers } = require("ethers")
const { buildRequest } = require("./FunctionsSandboxLibrary")
const { VERIFICATION_BLOCK_CONFIRMATIONS, networkConfig } = require("../network-config")

const decodeOutput = require("./helpers/decodeOutput")
const getRequestConfig = require("./Functions-request-config.js")
const { getStaticParams, getDynamicParams, getSigner } = require("../constants")

const { abi, source, secrets, returnType, gasLimit: reqGasLimit } = getStaticParams()

const request = async (args, networkName, updateToast) => {
   const requestConfig = getRequestConfig(args, source, secrets, returnType)
   const { contractAddress, subId } = getDynamicParams(networkName)
   if (!contractAddress || !subId) {
      throw Error("Contract address or subscription ID is not set for this network.")
   }

   // A manual gas limit is required as the gas limit estimated by Ethers is not always accurate
   const overrides = {
      gasLimit: 500000,
   }

   if (networkName === "hardhat") {
      throw Error(
         'This command cannot be used on a local development chain.  Specify a valid network or simulate an Functions request locally with "npx hardhat functions-simulate".'
      )
   }

   if (networkName === "goerli") {
      overrides.maxPriorityFeePerGas = ethers.utils.parseUnits("50", "gwei")
      overrides.maxFeePerGas = ethers.utils.parseUnits("50", "gwei")
   }

   // Get the required parameters
   const gasLimit = parseInt(reqGasLimit ?? "100000")
   if (gasLimit > 300000) {
      throw Error("Gas limit must be less than or equal to 300,000")
   }

   // Attach to the required contracts
   // Do it the ethers way, without hardhat
   const signer = getSigner(networkName)
   const clientContract = new ethers.Contract(contractAddress, abi.consumer, signer)
   const oracle = new ethers.Contract(networkConfig[networkName]["functionsOracleProxy"], abi.oracle, signer)
   const registryAddress = await oracle.getRegistry()
   const registry = new ethers.Contract(registryAddress, abi.registry, signer)

   // Check that the subscription is valid
   let subInfo

   try {
      subInfo = await registry.getSubscription(subId)
   } catch (error) {
      if (error.errorName === "InvalidSubscription") {
         throw Error(`Subscription ID "${subId}" is invalid or does not exist`)
      }
      throw error
   }
   // Validate the client contract has been authorized to use the subscription
   const existingConsumers = subInfo[2].map((addr) => addr.toLowerCase())
   if (!existingConsumers.includes(contractAddress.toLowerCase())) {
      throw Error(`Consumer contract ${contractAddress} is not registered to use subscription ${subId}`)
   }

   // Fetch the DON public key from on-chain
   const DONPublicKey = await oracle.getDONPublicKey()
   // Remove the preceding 0x from the DON public key
   requestConfig.DONPublicKey = DONPublicKey.slice(2)
   // Build the parameters to make a request from the client contract
   const request = await buildRequest(requestConfig)

   // Kill event listeners when any event is received
   const killListeners = () => {
      oracle.removeAllListeners()
      registry.removeAllListeners()
      clientContract.removeAllListeners()
   }

   // Use a promise to wait & listen for the fulfillment event before returning
   return await new Promise(async (resolve, reject) => {
      try {
         let requestId
         let returned = { result: null, cost: null, txHash: null, error: false }

         // Initiate the listeners before making the request
         // Listen for fulfillment errors
         oracle.once("UserCallbackError", async (eventRequestId, msg) => {
            if (requestId == eventRequestId) {
               console.log("Error in client contract callback function")
               console.log(msg)

               killListeners()
               return reject({ result: msg, error: true })
            }
         })
         oracle.once("UserCallbackRawError", async (eventRequestId, msg) => {
            if (requestId == eventRequestId) {
               console.log("Raw error in client contract callback function")
               console.log(Buffer.from(msg, "hex").toString())

               killListeners()
               return reject({ result: msg, error: true })
            }
         })
         // Listen for successful fulfillment
         let billingEndEventReceived = false
         let ocrResponseEventReceived = false
         clientContract.once("OCRResponse", async (eventRequestId, result, err, event) => {
            // Ensure the fulfilled requestId matches the initiated requestId to prevent logging a response for an unrelated requestId
            if (eventRequestId !== requestId) {
               return
            }

            console.log(`Request ${requestId} fulfilled!`)
            if (result !== "0x") {
               const decodedOutput = decodeOutput(result, returnType)
               console.log(`Returned to client contract: ${decodedOutput}`)

               returned.result = decodedOutput
            }
            if (err !== "0x") {
               console.log(`Error message returned to client contract: "${Buffer.from(err.slice(2), "hex")}"\n`)
            }

            returned.txHash = event.transactionHash;
            ocrResponseEventReceived = true
            if (billingEndEventReceived) {
               killListeners()
               return resolve(returned)
            }
         })
         // Listen for the BillingEnd event, log cost breakdown & resolve
         registry.once(
            "BillingEnd",
            async (
               eventRequestId,
               eventSubscriptionId,
               eventSignerPayment,
               eventTransmitterPayment,
               eventTotalCost,
               eventSuccess
            ) => {
               if (requestId == eventRequestId) {
                  // Check for a successful request & log a mesage if the fulfillment was not successful
                  console.log(`Transmission cost: ${ethers.utils.formatUnits(eventTransmitterPayment, 18)} LINK`)
                  console.log(`Base fee: ${ethers.utils.formatUnits(eventSignerPayment, 18)} LINK`)
                  const totalCost = ethers.utils.formatUnits(eventTotalCost, 18)
                  console.log(`Total cost: ${totalCost} LINK\n`)

                  if (!eventSuccess) {
                     console.log(
                        "Error encountered when calling fulfillRequest in client contract.\n" +
                        "Ensure the fulfillRequest function in the client contract is correct and the --gaslimit is sufficient."
                     )
                     killListeners()
                     return resolve("Error encountered when calling fulfillRequest in client contract")
                  }

                  returned.cost = totalCost
                  billingEndEventReceived = true
                  if (ocrResponseEventReceived) {
                     killListeners()
                     return resolve(returned)
                  }
               }
            }
         )
         // Initiate the on-chain request after all listeners are initialized
         console.log(`\nRequesting new data for FunctionsConsumer contract ${contractAddress} on network ${networkName}`)
         if (updateToast) updateToast("Initiating request...")

         const requestTx = await clientContract.executeRequest(
            request.source,
            request.secrets ?? [],
            request.args ?? [],
            subId,
            gasLimit
         )

         // If a response is not received within 5 minutes, the request has failed
         setTimeout(() => {
            killListeners()
            return reject({
               result:
                  "A response not received within 5 minutes of the request being initiated and has been canceled. Your subscription was not charged. Please make a new request.",
               error: true,
            })
         }, 300_000)
         console.log(
            `Waiting ${VERIFICATION_BLOCK_CONFIRMATIONS} blocks for transaction ${requestTx.hash} to be confirmed...`
         )
         if (updateToast)
            updateToast(`Waiting ${VERIFICATION_BLOCK_CONFIRMATIONS} blocks for the request transaction to be confirmed...`)

         const requestTxReceipt = await requestTx.wait(VERIFICATION_BLOCK_CONFIRMATIONS)
         requestId = requestTxReceipt.events[2].args.id
         console.log(`\nRequest ${requestId} initiated`)
         console.log(`Waiting for fulfillment...\n`)
         if (updateToast) updateToast(`Request initiated. Waiting for fulfillment...`)
      } catch (err) {
         console.log(err)
         killListeners()
         return resolve({ result: err, error: true })
      }
   })
}

module.exports = request
