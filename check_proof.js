const ethers = require("ethers")

// staging or prod
const ENV = "staging"

const RPC_URL = (ENV == "prod") ? "https://polygon-rpc.com" : "https://rpc-mumbai.maticvigil.com/"

const Semaphore = require("./abi/Semaphore.json")
const provider = new ethers.providers.JsonRpcProvider(RPC_URL)

async function getSemaphoreAddress() {
    const provider = new ethers.providers.JsonRpcProvider("https://nodes.mewapi.io/rpc/eth")
    const url = (ENV == "prod") ? "semaphore.wld.eth" : "staging.semaphore.wld.eth"
    return await provider.resolveName(url)
}

/**
 * This happens if you use the widget without the `raw` flag enabled, 
 * this is probaly undesired if you pass an address, bytes32, or uint256 to the function.
 * @param {*} input 
 * @returns 
 */
function hashPlainString(input) {
    const bytesInput = Buffer.from(input)
    const hash = BigInt(ethers.utils.keccak256(bytesInput)) >> BigInt(8)
    const rawDigest = hash.toString(16)
    return `0x${rawDigest.padStart(64, '0')}`
}

/**
 * This interprets the input as hex encoded bytes and hashes it.
 * @param {*} input 
 * @returns 
 */
function hashByteEncoded(input) {
    return ethers.utils.defaultAbiCoder.encode(
      ["uint256"],
      [BigInt(ethers.utils.solidityKeccak256(["bytes"], [input])) >> BigInt(8)],
    );
};

/**
 * No encoding is done on the input, this only works for inputs that fit 
 * in the underlying field.
 * @param {*} input 
 * @returns 
 */
function plainInput(input) {return input;}

async function main(args) {

    const proof = {
        // pass the raw signal and externalNullifier (as passed to the widget) without encoding
        signal: '0x5e2659033d927c7b9a4285a7d22dab14e1081653',
        externalNullifier:'0x22CF2fd72632056A3E6922d506Abc752fAc94988',

        // pass the rest as found on etherscan / polygonscan
        root: '0x1f9679165328432bd1f99c61c746e2c82ea51d2ec2a87f0b1983e7f4d8a87e74',
        nullifier: '0x1656270324a18d3e12901a7a9e711db56e0c84e843fd2d500d414275c8f7a31c',
        proof: [
            '0x2fa21a133a447b28cd44d1edfed8bc4669f35739c04374f988769b991d38c6aa',
            '0x301f42eeef89e5bcc9c42e6a19a9655ed0288e6e7d898590a57d0f571b60938d',
            '0x1abf29a1dfc9d9088711c9ee2d28917c8629fd4d21cfe88a95eee50e22c6e75f',
            '0x0573140fc56e2d788acb9d7ef8c39055608da8ab3eadf176967eabe51871d73b',
            '0x23dace6567c77f7a9993bc8e495e52874d0e07ba0ec7bee43ede9b33bb218611',
            '0x01d281e518159922413c204eef78f83da333bc2c6e1219cc292a378e97a26dd5',
            '0x169a183e376ee7d1600c508b401ec4f2bd164d5444472633a19e7d090e20c162',
            '0x0ea76166c6c51d7bc07a2253238901f594b2fc6f562315acf89623bcec92c3ef'
        ]
    };

    const contract = new ethers.Contract(await getSemaphoreAddress(), Semaphore.abi, provider)
    const func = contract.functions['verifyProof(uint256,uint256,uint256,uint256,uint256,uint256[8])'];

    const try_funcs = [hashPlainString, hashByteEncoded, plainInput];
    var done = false;

    for (f1 of try_funcs) {
        for (f2 of try_funcs) {
            console.log(`Trying ${f1.name}(signal) and ${f2.name}(extNullifier) ...`);
            try {
                const result = await func(proof.root, 1n, f1(proof.signal), proof.nullifier, f2(proof.externalNullifier), proof.proof);
                console.log("   ✅ Proof is good ser");
                console.log("If the encoding is not what you expected, read the comments.");
                done = true;
                break;
            } catch (e) {
                console.log("   ❌ Proof ain't good ser:", e.errorName)
            }
        }
        if (done) break;
    }
}

main(process.argv)
    .then(() => { process.exit(0) })
    .catch(error => console.log(error))
