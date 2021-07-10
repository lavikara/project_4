var HDWalletProvider = require("truffle-hdwallet-provider");
var mnemonic =
  "spray turkey puppy among laugh pelican eagle battle picnic math attend charge";

module.exports = {
  networks: {
    development: {
      provider: function () {
        return new HDWalletProvider(mnemonic, "http://127.0.0.1:7545/", 0, 50);
      },
      network_id: "*",
      // gas: 999999,
    },
  },
  compilers: {
    solc: {
      version: "^0.4.24",
      optimizer: {
        enabled: false,
        runs: 200,
      },
    },
  },
};
