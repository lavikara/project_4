import FlightSuretyApp from "../../build/contracts/FlightSuretyApp.json";
import FlightSuretyData from "../../build/contracts/FlightSuretyData.json";
import Config from "./config.json";
import Web3 from "web3";

export default class Contract {
  constructor(network, callback) {
    let config = Config[network];
    this.web3 = new Web3(new Web3.providers.HttpProvider(config.url));
    this.flightSuretyApp = new this.web3.eth.Contract(
      FlightSuretyApp.abi,
      config.appAddress
    );
    this.FlightSuretyData = new this.web3.eth.Contract(
      FlightSuretyData.abi,
      config.dataAddress
    );
    this.initialize(callback);
    this.owner = null;
    // this.airlines = [];
    this.passengers = [];
    let gas = 9999999;
  }

  initialize(callback) {
    this.web3.eth.getAccounts((error, accts) => {
      this.owner = accts[0];
      let counter = 5;

      //   while (this.airlines.length < 5) {
      //     this.airlines.push(accts[counter++]);
      //   }

      while (this.passengers.length < 5) {
        this.passengers.push(accts[counter]);
        // this.authorizeCaller(accts[counter]);
        counter++;
      }
      callback();
    });
  }

  isOperational(callback) {
    let self = this;
    self.flightSuretyApp.methods
      .isOperational()
      .call({ from: self.owner }, callback);
  }

  fetchFlightStatus(flight, airline, timestamp, callback) {
    let self = this;
    let payload = {
      airline: airline,
      flight: flight,
      timestamp: timestamp,
    };
    self.flightSuretyApp.methods
      .fetchFlightStatus(payload.airline, payload.flight, payload.timestamp)
      .send({ from: self.passengers[0] }, (error, result) => {
        callback(error, payload);
      });
  }

  flightStatus(flight, timestamp, airline, callback) {
    let self = this;
    let payload = {
      airline: airline,
      flightCode: flight,
      timestamp: timestamp,
    };
    self.FlightSuretyData.methods
      .flightStatus(payload.flightCode, payload.timestamp, payload.airline)
      .call((error, result) => {
        callback(error, result);
      });
  }

  //   authorizeCaller(caller) {
  //     let self = this;
  //     let payload = { insuree: caller };
  //     self.FlightSuretyData.methods
  //       .authorizeCaller(payload.insuree)
  //       .send({ from: payload.insuree, gas: self.gas }, (error, result) => {
  //         if (error) console.log(error);
  //       });
  //   }

  buy(flightCode, timestamp, airline, callback) {
    let self = this;
    let payload = {
      flightCode,
      timestamp,
      airline,
    };
    self.FlightSuretyData.methods.FLIGHT_INSURANCE_AMOUNT.call().then(
      (amount) => {
        self.flightSuretyApp.methods
          .buy(payload.flightCode, payload.timestamp, payload.airline)
          .send(
            { from: self.passengers[0], value: amount, gas: self.gas },
            (error, result) => {
              callback(error, result);
            }
          );
      }
    );
  }

  checkInsureeCredit(callback) {
    let self = this;
    self.flightSuretyApp.methods
      .checkInsureeCredit()
      .call({ from: self.passengers[0] }, callback);
  }

  pay(callback) {
    let self = this;
    self.flightSuretyApp.methods
      .pay()
      .send({ from: self.passengers[0] }, (error, result) => {
        callback(error, result);
      });
  }
}
