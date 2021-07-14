var HDWalletProvider = require("truffle-hdwallet-provider");
var mnemonic =
  "area shadow voyage noble abstract frost ocean rail fetch stand stand matrix";

var NonceTrackerSubprovider = require("web3-provider-engine/subproviders/nonce-tracker");

module.exports = {
  networks: {
    development: {
      host: "127.0.0.1", // Localhost (default: none)
      port: 7545, // Standard Ethereum port (default: none)
      network_id: "*", // Any network (default: none)
    },
    rinkeby: {
      provider: function () {
        var wallet = new HDWalletProvider(
          mnemonic,
          "http://127.0.0.1:7545/",
          0,
          50
        );
        var nonceTracker = new NonceTrackerSubprovider();
        wallet.engine._providers.unshift(nonceTracker);
        nonceTracker.setEngine(wallet.engine);
        return wallet;
      },
    },
  },
  compilers: {
    solc: {
      version: "^0.4.25",
      optimizer: {
        enabled: false,
        runs: 200,
      },
    },
  },
};
