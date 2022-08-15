const ethers = require("ethers")

// staging or prod
const ENV = "prod"

const RPC_URL = (ENV == "prod") ? "https://polygon-rpc.com" : "https://rpc-mumbai.matic.today"

const Semaphore = require("./abi/Semaphore.json")
const provider = new ethers.providers.JsonRpcProvider(RPC_URL)

async function getSemaphoreAddress() {
    const provider = new ethers.providers.JsonRpcProvider("https://nodes.mewapi.io/rpc/eth")
    const url = (ENV == "prod") ? "semaphore.wld.eth" : "staging.semaphore.wld.eth"
    return await provider.resolveName(url)
}

function hashBytes(input) {
    const bytesInput = Buffer.isBuffer(input) ? input : Buffer.from(input)
    const hash = BigInt(ethers.utils.keccak256(bytesInput)) >> BigInt(8)
    const rawDigest = hash.toString(16)
    return { hash, digest: `0x${rawDigest.padStart(64, '0')}` }
}

async function main(args) {

    const proof = {
        root: 16752527302130281681083493552781106724275899300483970806467314801353289399094n,
        nullifier: 7866612539178457337913816801023427595397405854426319134666926322490068883222n,
        externalNullifier: 230474088932420479248343920036855317614080153896951631879700051900535240111n,
        signal: hashBytes("0xf5").hash,
        proof: [
            21349011728983108595096106656170270655030651827251194103236850178787046922934n,
            3892546919088460683093142758414103596536725335773624525063479964387149109601n,
            4012049590085007063518390181766448690980166270838411659055843530195615490509n,
            1107425360427292482660816598341553554316420034865226973759580954297348244094n,
            5590632993899405504414099421774203745380694003929623666534191469030985098908n,
            15929036151670044156624048233259525677142659693836305258120720670495243816448n,
            15527806825483740620596348704419966762183666804445335332150025482537344752255n,
            11171381712704303981510728878557931093962414348367674042683251046027445937715n
        ]
    };

    const contract = new ethers.Contract(await getSemaphoreAddress(), Semaphore.abi, provider)
    const func = contract.functions['verifyProof(uint256,uint256,uint256,uint256,uint256,uint256[8])'];
    try {
        const result = await func(proof.root, 1n, proof.signal, proof.nullifier, proof.externalNullifier, proof.proof);
        console.log("Proof is good ser");
    } catch (e) {
        console.log("Proof ain't good ser:", e.errorName)
    }
}

main(process.argv)
    .then(() => { process.exit(0) })
    .catch(error => console.log(error))
