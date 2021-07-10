var Test = require("../config/testConfig.js");
// const truffleAssert = require("truffle-assertions");
// var BigNumber = require("bignumber.js");

contract("Flight Surety Tests", async (accounts) => {
  var config;
  let secondAirline = accounts[2];
  let secondAirlineName = "Airline Two";
  let thirdAirline = accounts[3];
  let thirdAirlineName = "Airline Three";
  let fourthAirline = accounts[4];
  let fourthAirlineName = "Airline Four";
  let fifthAirline = accounts[5];
  let fifthAirlineName = "Airline Five";

  before("setup contract", async () => {
    config = await Test.Config(accounts);
    await config.flightSuretyData.authorizeCaller(
      config.flightSuretyApp.address
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
      await config.flightSuretyData.setOperatingStatus(false, {
        from: config.testAddresses[2],
      });
    } catch (e) {
      accessDenied = true;
    }
    assert.equal(accessDenied, true, "Access not restricted to Contract Owner");
  });

  it(`(multiparty) can allow access to setOperatingStatus() for Contract Owner account`, async function () {
    // Ensure that access is allowed for Contract Owner account
    let accessDenied = false;
    try {
      await config.flightSuretyData.setOperatingStatus(false);
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
    await config.flightSuretyData.setOperatingStatus(false);

    let reverted = false;
    try {
      await config.flightSuretyData.getTotalAirlines();
    } catch (e) {
      reverted = true;
    }
    assert.equal(reverted, true, "Access not blocked for requireIsOperational");

    // Set it back for other tests to work
    await config.flightSuretyData.setOperatingStatus(true);
  });

  it("(airline) Register first airline when contract is deployed", async () => {
    let registered;
    try {
      registered = await config.flightSuretyApp.isAirlineRegistered(
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
    // ARRANGE
    let newAirline = accounts[2];
    let newAirlineName = "Airline Two";
    let result;

    // ACT
    try {
      result = await config.flightSuretyApp.registerAirline(
        newAirlineName,
        newAirline,
        {
          from: config.firstAirline,
        }
      );
    } catch (e) {}
    result = await config.flightSuretyApp.isAirlineRegistered.call(newAirline);

    // ASSERT
    assert.equal(
      result,
      false,
      "Airline should not be able to register another airline if it hasn't provided funding"
    );
  });

  it("(airline) fund and register airline until we have four airlines", async () => {
    let fund = await config.flightSuretyData.AIRLINE_SEED_FUNDING.call();

    // await config.flightSuretyApp.fund(config.firstAirline, fund);
    await config.flightSuretyApp.fund({
      from: config.firstAirline,
      value: fund,
    });

    let fundedFirstAirline = await config.flightSuretyData.airlineFunded(
      config.firstAirline
    );

    // let a = await config.flightSuretyApp.registerAirline(
    //   config.firstAirlineName,
    //   config.firstAirline,
    //   { from: config.firstAirline }
    // );

    // let fundedSecondAirline = await config.flightSuretyApp.fund(
    //   config.secondAirline,
    //   fund
    // );

    assert.equal(fundedFirstAirline, true, "First airline was not funded");
    // assert.equal(fundedSecondAirline, true, "Second airline was not funded");
  });
});
