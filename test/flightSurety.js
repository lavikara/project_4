let Test = require("../config/testConfig.js");
let Web3 = require("web3");
// var BigNumber = require("bignumber.js");

contract("Flight Surety Tests", async (accounts) => {
  var config;

  before("setup contract", async () => {
    config = await Test.Config(accounts);
    await config.flightSuretyData.authorizeContract(
      config.flightSuretyApp.address,
      { from: accounts[0] }
    );
  });

  /****************************************************************************************/
  /* Operations and Settings                                                              */
  /****************************************************************************************/

  it(`(multiparty) has correct initial isOperational() value`, async function () {
    // Get operating status
    let status = await config.flightSuretyData.isOperational.call();
    assert.equal(status, true, "Incorrect initial operating status value");
  });

  it(`(multiparty) can block access to setOperatingStatus() for non-Contract Owner account`, async function () {
    // Ensure that access is denied for non-Contract Owner account
    let accessDenied = false;
    try {
      await config.flightSuretyApp.setOperatingStatus(false, {
        from: config.testAddresses[2],
      }); // This should throw an error allowing the catch block to run.
    } catch (e) {
      accessDenied = true;
    }
    assert.equal(accessDenied, true, "Access not restricted to Contract Owner");
  });

  it(`(multiparty) can allow access to setOperatingStatus() for Contract Owner account`, async function () {
    // Ensure that access is allowed for Contract Owner account
    let accessDenied = false;
    try {
      await config.flightSuretyApp.setOperatingStatus(false);
    } catch (e) {
      accessDenied = true;
    }
    assert.equal(
      accessDenied,
      false,
      "Access not restricted to Contract Owner"
    );
  });

  it(`(multiparty) can block access to functions using requireIsOperational when operating status is false`, async function () {
    await config.flightSuretyApp.setOperatingStatus(false, {
      from: accounts[0],
    });

    let reverted = false;
    try {
      await config.flightSuretyData.setTestingMode(true); // This should throw an error allowing the catch block to run.
    } catch (e) {
      reverted = true;
    }
    assert.equal(reverted, true, "Access not blocked for requireIsOperational");

    // Set it back for other tests to work
    await config.flightSuretyApp.setOperatingStatus(true, {
      from: accounts[0],
    });
  });

  it("(airline) Register first airline when contract is deployed", async () => {
    let registered;
    try {
      registered = await config.flightSuretyApp.airlineRegistered(
        config.firstAirline
      );
    } catch (error) {
      registered = false;
    }
    assert.equal(
      registered,
      true,
      "First airline was not registered when contract was deployed"
    );
  });

  it("(airline) cannot register an Airline using registerAirline() if it is not funded", async () => {
    let newAirline = accounts[2];
    let registered;
    try {
      await config.flightSuretyApp.registerAirline(newAirline, {
        from: config.firstAirline,
      });
    } catch (e) {
      registered = await config.flightSuretyApp.airlineRegistered(newAirline);
    }
    assert.equal(
      registered,
      false,
      "Airline should not be able to register another airline if it hasn't provided funding"
    );
  });

  it("(airline) fund and register airline until we have four airlines", async () => {
    let scopedFunds = 0;
    let amount = await config.flightSuretyData.AIRLINE_SEED_FUNDING.call();
    await config.flightSuretyApp.fund({
      from: config.firstAirline,
      value: amount,
    });
    scopedFunds += parseInt(amount);
    for (let i = 2; i < 5; i++) {
      await config.flightSuretyApp.registerAirline(accounts[i], {
        from: accounts[i - 1],
      });
      await config.flightSuretyApp.fund({
        from: accounts[i],
        value: amount,
      });
      scopedFunds += parseInt(amount);
    }

    // try registering airline 5
    await config.flightSuretyApp.registerAirline(accounts[5], {
      from: accounts[4],
    });
    // check if 5th airline was registered
    let airline5 = await config.flightSuretyData.airlineRegistered(accounts[5]);

    let totalAirline = await config.flightSuretyData.getTotalAirlines.call();
    let funds = await config.flightSuretyData.getFunds.call();

    scopedFunds = Web3.utils.fromWei(scopedFunds.toString(), "ether");
    funds = Web3.utils.fromWei(funds.toString(), "ether");
    assert.equal(funds, scopedFunds, "Funds should be equal to 40");
    assert.equal(totalAirline, 4, "Total airline should be equal to 4");
    assert.equal(airline5, false, "5th airline should not be registered");
  });

  it(`(multiparty) airline can't vote twice`, async function () {
    for (let i = 5; i < 6; i++) {
      try {
        await config.flightSuretyApp.registerAirline(accounts[i], {
          from: accounts[i - 1],
        }); // N.B  5th airline already has one vote from 4th airline in previouss test
      } catch (e) {
        let airline5 = await config.flightSuretyData.airlineRegistered(
          accounts[5]
        );
        assert.equal(
          airline5,
          false,
          "4th airline should not be able to vote for 5th airline again"
        );
      }
    }
  });

  it(`(multiparty) register 5th and subsequent airline with multiparty consensus`, async function () {
    let scopedFunds = await config.flightSuretyData.getFunds.call();
    let amount = await config.flightSuretyData.AIRLINE_SEED_FUNDING.call();
    for (let i = 5; i < 7; i++) {
      await config.flightSuretyApp.registerAirline(accounts[i], {
        from: accounts[i - 2],
      }); // N.B  5th airline already has one vote from previouss test
      if (i == 5) {
        await config.flightSuretyApp.fund({
          from: accounts[i],
          value: amount,
        });
        scopedFunds = parseInt(scopedFunds) + parseInt(amount);
      }
      if (i > 5) {
        await config.flightSuretyApp.registerAirline(accounts[i], {
          from: accounts[i - 3],
        });
        await config.flightSuretyApp.registerAirline(accounts[i], {
          from: accounts[i - 4],
        });
        await config.flightSuretyApp.fund({
          from: accounts[i],
          value: amount,
        });
        scopedFunds += parseInt(amount);
      }
    }
    let totalAirline = await config.flightSuretyData.getTotalAirlines.call();
    let funds = await config.flightSuretyData.getFunds.call();

    scopedFunds = Web3.utils.fromWei(scopedFunds.toString(), "ether");
    funds = Web3.utils.fromWei(funds.toString(), "ether");
    let airline5 = await config.flightSuretyData.airlineRegistered(accounts[5]);
    let airline6 = await config.flightSuretyData.airlineRegistered(accounts[6]);

    assert.equal(airline5, true, "5th airline was not registered");
    assert.equal(airline6, true, "6th airline was not registered");
    assert.equal(funds, scopedFunds, "funds should be equal to 60 ether");
    assert.equal(totalAirline, 6, "total airline should be 6");
  });
});
