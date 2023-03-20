////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// EDIT HERE: Set the enviroment to `prod` or `staging`
const ENV = "staging"
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const ethers = require("ethers")
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
function plainInput(input) { return input; }

async function main(args) {

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // EDIT HERE:
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    const proof = {
        // pass the raw signal and externalNullifier (as passed to the widget) without encoding
        signal: '0x0000000000000000000000000000000000000000',
        externalNullifier: 0,

        // pass the rest as found on etherscan / polygonscan
        root: '0x0fbf3d63f42d2a7a4c68bd2653fcc9d75e94ba8ecdd8781d919ff7334c168ad6',
        nullifier: '0x15b59b0c3f6222f0e918accb0d32b1d7c8842c815f724ee663e9ebf0f177e540',
        proof: [
            '9874592304872254721871489222929445604987432671731658643165920532337159274517', '8525475798243377206918537730314804212459420136408495176268561207679560298717', '10294777214362775519670186621976250364132179021555090201322102857495138955480', '8883299608923723415374224116136891505373319154338480846884175720737507943565', '13420319866441557895859868593196139131381637202804570530588845304662908427497', '11635128214311207407540870155774808846822514050583043469595358133280526121696', '17257572123585795764664595358663528559106949383973579828699774324722632620450', '5753914895580501894029728263201430263695170130632269967634541050167383453944'
        ]
    };
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    const contract = new ethers.Contract(await getSemaphoreAddress(), Semaphore.abi, provider)
    const func = contract.functions['verifyProof(uint256,uint256,uint256,uint256,uint256,uint256[8])'];

    // test one common encoding and check for the error
    var err = null;
    try {
        console.log(hashByteEncoded(proof.signal));
        const result = await func(proof.root, 1n, hashByteEncoded(proof.signal), proof.nullifier, hashPlainString(proof.externalNullifier), proof.proof);
    } catch (e) {
        err = e.errorName;
    }

    if (err == null) console.log("✅ all good fren, no error!")

    if (err == "InvalidProof") {
        console.log("🚫 invalid proof, usually that's an encoding issue, let me see if I can find out what's wrong...\n");
        const try_funcs = [hashPlainString, hashByteEncoded, plainInput];
        var done = false;

        for (f1 of try_funcs) {
            for (f2 of try_funcs) {
                console.log(`Trying ${f1.name}(signal) and ${f2.name}(extNullifier) ...`);
                try {
                    const result = await func(proof.root, 1n, f1(proof.signal), proof.nullifier, f2(proof.externalNullifier), proof.proof);
                    console.log("   ✅ Proof is good ser");
                    console.log("If the encoding is not what you expected, read the comments in the code here.");
                    done = true;
                    break;
                } catch (e) {
                    console.log("   ❌ Proof ain't good ser:", e.errorName)
                }
            }
            if (done) break;
        }
    }

    if (err == "InvalidRoot") {
        console.log("🚫 invalid root, probably the root became outdated and you need to insert a new identity (happens on staging)");
        console.log("If this didn't help, something is terribly wrong and you should report this to the WorldID team.");
    }

    // maybe i've forgot some other cases?
}

main(process.argv)
    .then(() => { process.exit(0) })
    .catch(error => console.log(error))
