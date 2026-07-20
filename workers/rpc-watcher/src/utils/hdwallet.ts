import { HDNodeWallet, Mnemonic } from 'ethers';

export class HDWalletManager {
  private mnemonic: Mnemonic;

  constructor(mnemonicPhrase: string) {
    if (!mnemonicPhrase) {
      throw new Error('Mnemonic phrase is required to initialize HDWalletManager.');
    }
    this.mnemonic = Mnemonic.fromPhrase(mnemonicPhrase);
  }

  /**
   * BIP-44 규격에 따라 특정 인덱스의 BSC 주소를 파생합니다.
   * Path: m/44'/60'/0'/0/index (BSC는 Ethereum과 동일한 coin type 60을 흔히 공유합니다)
   * 
   * @param index derivation index (0, 1, 2...)
   * @returns 파생된 지갑 객체 (address, privateKey)
   */
  public deriveAddress(index: number): { address: string; privateKey: string } {
    const derivationPath = `m/44'/60'/0'/0/${index}`;
    const childNode = HDNodeWallet.fromMnemonic(this.mnemonic, derivationPath);
    return {
      address: childNode.address,
      privateKey: childNode.privateKey,
    };
  }
}
