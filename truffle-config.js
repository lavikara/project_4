var HDWalletProvider = require("truffle-hdwallet-provider");
var mnemonic =
  // "tomorrow dry banner muffin blanket kiss often delay brisk cash crater deny";
  "pepper harvest olympic asset assault endless smooth enlist embark toward hammer jungle";

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
  // compilers: {
  //   solc: {
  //     version: "^0.4.24",
  //   },
  // },
  compilers: {
    solc: {
      version: "^0.4.24",
      // version: "^0.8.0",
      optimizer: {
        enabled: false,
        runs: 200,
      },
    },
  },
};
