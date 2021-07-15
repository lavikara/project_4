let Test = require("../config/testConfig.js");
let Web3 = require("web3");
//var BigNumber = require('bignumber.js');

contract("Oracles", async (accounts) => {
  const TEST_ORACLES_COUNT = 10;
  let config;
  let flight = "ND1309"; // Course number
  let timestamp = Math.floor(Date.now() / 1000);
  let passenger = accounts[26];

  before("setup contract", async () => {
    config = await Test.Config(accounts);
    await config.flightSuretyData.authorizeCaller(
      config.flightSuretyApp.address
    );

    // Watch contract events
    const STATUS_CODE_UNKNOWN = 0;
    const STATUS_CODE_ON_TIME = 10;
    const STATUS_CODE_LATE_AIRLINE = 20;
    const STATUS_CODE_LATE_WEATHER = 30;
    const STATUS_CODE_LATE_TECHNICAL = 40;
    const STATUS_CODE_LATE_OTHER = 50;
  });

  it("can register oracles", async () => {
    // ARRANGE
    let fee = await config.flightSuretyApp.REGISTRATION_FEE.call();

    // ACT
    for (let a = 1; a < TEST_ORACLES_COUNT; a++) {
      await config.flightSuretyApp.registerOracle({
        from: accounts[a],
        value: fee,
      });
      let result = await config.flightSuretyApp.getMyIndexes.call({
        from: accounts[a],
      });
      console.log(
        `Oracle ${accounts[a]} Registered: ${result[0]}, ${result[1]}, ${result[2]}`
      );
    }
  });

  it("(Airline) fund airline", async () => {
    let amount = await config.flightSuretyData.AIRLINE_SEED_FUNDING.call();
    await config.flightSuretyApp.fund({
      from: config.firstAirline,
      value: amount,
    });
    let funded = await config.flightSuretyApp.airlineFunded(
      config.firstAirline
    );
    let funds = await config.flightSuretyData.getFunds.call();
    funds = Web3.utils.fromWei(funds.toString(), "ether");
    assert.equal(funded, true, "Airline was not funded");
    assert.equal(funds, 10, "Airline was not funded");
  });

  it("(Airline) register flight", async () => {
    await config.flightSuretyApp.registerFlight(flight, timestamp, {
      from: config.firstAirline,
    });
    let registered = await config.flightSuretyData.isFlightRegistered(
      flight,
      timestamp,
      config.firstAirline
    );
    assert.equal(registered, true, "Flight was not registered");
  });

  it("(Passenger) Passenger can buy insurance", async () => {
    let amount = await config.flightSuretyData.FLIGHT_INSURANCE_AMOUNT.call();
    let passenger1 = accounts[1];
    let passenger2 = accounts[2];

    await config.flightSuretyApp.buy(flight, timestamp, config.firstAirline, {
      from: passenger1,
      value: amount,
    });
    await config.flightSuretyApp.buy(flight, timestamp, config.firstAirline, {
      from: passenger2,
      value: amount,
    });
    let passengers = await config.flightSuretyApp.getInsuredPassengers(
      flight,
      timestamp,
      config.firstAirline
    );

    assert.equal(
      passengers[0],
      accounts[1],
      "Passenger is not on the insured passenger list"
    );
    assert.equal(
      passengers[1],
      accounts[2],
      "Passenger is not on the insured passenger list"
    );
  });

  it("can request flight status", async () => {
    // ARRANGE
    // let flight = "ND1309"; // Course number
    // let timestamp = Math.floor(Date.now() / 1000);

    // Submit a request for oracles to get status information for a flight
    await config.flightSuretyApp.fetchFlightStatus(
      config.firstAirline,
      flight,
      timestamp
    );
    // ACT

    // Since the Index assigned to each test account is opaque by design
    // loop through all the accounts and for each account, all its Indexes (indices?)
    // and submit a response. The contract will reject a submission if it was
    // not requested so while sub-optimal, it's a good test of that feature
    for (let a = 1; a < TEST_ORACLES_COUNT; a++) {
      // Get oracle information
      let oracleIndexes = await config.flightSuretyApp.getMyIndexes.call({
        from: accounts[a],
      });
      for (let idx = 0; idx < 3; idx++) {
        try {
          // Submit a response...it will only be accepted if there is an Index match
          await config.flightSuretyApp.submitOracleResponse(
            oracleIndexes[idx],
            config.firstAirline,
            flight,
            timestamp,
            STATUS_CODE_ON_TIME,
            { from: accounts[a] }
          );
        } catch (e) {
          // Enable this when debugging
          // console.log(
          //   "\nError",
          //   idx,
          //   oracleIndexes[idx].toNumber(),
          //   flight,
          //   timestamp
          // );
        }
      }
    }
  });

  it("(airline) update flight status", async () => {
    let initialStatusCode = await config.flightSuretyData.checkFlightStatus(
      config.firstAirline,
      flight,
      timestamp
    );
    await config.flightSuretyApp.updateFlightStatus(
      config.firstAirline,
      flight,
      timestamp
    );
    let finalStatusCode = await config.flightSuretyData.checkFlightStatus(
      config.firstAirline,
      flight,
      timestamp
    );
    assert.equal(initialStatusCode, 0, "Initial flight state should be 0");
    assert.equal(finalStatusCode, 20, "Updated flight state should be 20");
  });

  it("(Passenger) if flight is delayed due to airline fault, insured passengers receives credit", async () => {
    let passengers = await config.flightSuretyApp.getInsuredPassengers(
      flight,
      timestamp,
      config.firstAirline
    );
    for (let i = 0; i < passengers.length; i++) {
      let balance = await config.flightSuretyData.getPassengerBalance(
        passengers[i]
      );
      balance = balance.toNumber();
      assert.equal(balance, 0, "Initial passenger balance should be 0");
    }
    let initialFunds = await config.flightSuretyData.getFunds.call();
    initialFunds = Web3.utils.fromWei(initialFunds.toString(), "ether");

    await config.flightSuretyData.creditInsurees(
      config.firstAirline,
      flight,
      timestamp,
      { from: config.owner }
    );
    // check final balance of passengers after crediting
    for (let i = 0; i < passengers.length; i++) {
      let balance = await config.flightSuretyData.getPassengerBalance(
        passengers[i]
      );
      balance = Web3.utils.fromWei(balance.toString(), "ether");
      assert.equal(balance, 1.5, "final passenger balance should be 1.5 ether");
    }
    let finalFunds = await config.flightSuretyData.getFunds.call();
    finalFunds = Web3.utils.fromWei(finalFunds.toString(), "ether");

    assert.equal(initialFunds, 10, "initial funds should be 10"); // since only one airline paid the seed fund
    assert.equal(finalFunds, 7, "final funds should be 7"); // since two passengers were credited 1.5 ether each
  });
});
