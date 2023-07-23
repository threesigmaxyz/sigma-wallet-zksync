import { utils, Wallet } from "zksync-web3";
import * as ethers from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";


export default async function (hre: HardhatRuntimeEnvironment) {
    // Private key of the account used to deploy
    const wallet = new Wallet("0x7726827caac94a7f9e1b160f7ea819f172f7b6f9d2a97f992c38edeab82d4110");
    const deployer = new Deployer(hre, wallet);
    const providerManagerArtifact = await deployer.loadArtifact("ProviderManager");
    const googleProviderArtifact = await deployer.loadArtifact("GoogleProvider");

    // Deploying the provider manager.
    const providerManager = await deployer.deploy(providerManagerArtifact);
    console.log(`ProviderManager address: ${providerManager.address}`);

    // Deploy the google provider.
    const googleProvider = await deployer.deploy(
        googleProviderArtifact,
        [providerManager.address]   // TODO: Should be the PK oracle.
    );
    console.log(`GoogleProvider address: ${googleProvider.address}`);
    
    // Register google keys.
    let kids = [
        "3db3ed6b9574ee3fcd9f149e59ff0eef4f932153",
        "8a63fe71e53067524cbbc6a3a58463b3864c0787"
    ];
    let modulus = [
        "0xd8a729bf80b14e8782284217ce786a3e0db53210803fd0e75f9b36fd4759d5bcce56147caa2a24fcff23ef2f1817633625cf2bd9bb5f0a02461658db92db557385ef9de3de3d3fa119ff4f7a423545487bca4e8f786d240899e6716620617c572fc3f44c33479379964f80e5c8dd8209c968c067d154b25b7b5a82d4d0764573f2723d117c3369229e4758c67cc0f8c8f309eb5796a9a102bfb02cf83f40b2b0002c91205d8524781f3ecbea69e17b257a34cc73dc1ae1d43aa5c21e89fa2a21d917b382e1bcd3b93133562a494cb632f505322f83362fc6d0bb5212512697863fa2d564f4443270aa98a8385a6b545aaa915bdb516d275c3ff1d540389ef7fb",
        "0xc9b3cb7ce8a86e462a3c97f64bdf1390fd1876fcf24aa3d200d6b5470f1012d4f6231ab67eed4314e9fdf2b7b5aa3627e4740f956e87be7fffc3d26694677e98a83f5c9bef11af354e6fad3fdb53ae07e5022ce36d31df5fdfa7f4d16529aff56e52781ca627d6f9219b08423e6bb25de6fbb07641227bef8e5e25695077555c2282a82b799045eb96a874c715908ab307ee95cbf58a791a8047eb0d7097fcb1d48dbce4b03cf43f830dcc437f1289e9b155591f9e7e805a2721b8423ded2dbae08bb380d245e538a9a533e3ce326ffaac62b110ea326bda7a48b53c27bc098f4429027105664ecba5a56ddcb5826cce78bb171152f922c1722c65fa4ead7699"
    ];
    await (
        await googleProvider.addKeys(
            ethers.utils.defaultAbiCoder.encode(
                ['string[]', 'bytes[]'],
                [kids, modulus]
            )
        )
    ).wait();

    // Register the Google provider.
    await (
        await providerManager.addProviderSimple(googleProvider.address, "Google")
    ).wait();
}