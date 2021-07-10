import FlightSuretyApp from "../../build/contracts/FlightSuretyApp.json";
import FlightSuretyData from "../../build/contracts/FlightSuretyData.json";
import Config from "./config.json";
import Web3 from "web3";
import express from "express";

const STATUS_CODE_UNKNOWN = 0;
const STATUS_CODE_ON_TIME = 10;
const STATUS_CODE_LATE_AIRLINE = 20;
const STATUS_CODE_LATE_WEATHER = 30;
const STATUS_CODE_LATE_TECHNICAL = 40;
const STATUS_CODE_LATE_OTHER = 50;

let oracles = {};
const ORACLES_COUNT = 30;
const STATUS_CODES = [
  STATUS_CODE_UNKNOWN,
  STATUS_CODE_ON_TIME,
  STATUS_CODE_LATE_AIRLINE,
  STATUS_CODE_LATE_WEATHER,
  STATUS_CODE_LATE_TECHNICAL,
  STATUS_CODE_LATE_OTHER,
];

let config = Config["localhost"];
let web3 = new Web3(
  new Web3.providers.WebsocketProvider(config.url.replace("http", "ws"))
);
// web3.eth.defaultAccount = web3.eth.accounts[0];
let flightSuretyApp = new web3.eth.Contract(
  FlightSuretyApp.abi,
  config.appAddress
);

let flightSuretyData = new web3.eth.Contract(
  FlightSuretyData.abi,
  config.dataAddress
);

let flights = {};
let airlines = [];
let airlineNames = [
  "Airline One",
  "Airline Two",
  "Airline Three",
  "Airline Four",
  "Airline Five",
];
let flightCodes = ["flight01", "flight02", "flight03", "flight04"];
let counter = 1;
let gas = 9999999;

function registerAirline(name, airline) {
  let payload = {
    name,
    airline,
  };
  flightSuretyApp.methods
    .registerAirline(payload.name, payload.airline)
    .send({ from: airlines[0], gas: gas }, (error, result) => {
      if (error) console.log(error);
    });
}

function fundAirline(airline) {
  flightSuretyData.methods
    .AIRLINE_SEED_FUNDING()
    .call()
    .then((amount) => {
      flightSuretyApp.methods
        .fund()
        .send({ from: airline, value: amount, gas: gas }, (error, result) => {
          if (error) console.log(error);
        });
    });
}

function registerFlight(flightCode, airline) {
  let payload = {
    flightCode,
    timestamp: Math.floor(Date.now() / 1000),
  };
  flightSuretyApp.methods
    .registerFlight(payload.flightCode, payload.timestamp)
    .send({ from: airline, gas: gas }, (error, result) => {
      if (error) console.log(error);
    });
}

web3.eth.getAccounts().then((accounts) => {
  flightSuretyData.methods
    .authorizeCaller(config.appAddress)
    .send({ from: account[0] })
    .then((result) => {
      console.log(result);
      while (counter <= 4) {
        airlines.push(accounts[counter]);
        if (counter == 1) {
          fundAirline(accounts[counter]);
          registerFlight(flightCodes[counter - 1], accounts[counter]);
        } else {
          registerAirline(airlineNames[counter - 1], accounts[counter]);
          fundAirline(accounts[counter]);
          registerFlight(flightCodes[counter - 1], accounts[counter]);
        }
        counter++;
      }
    })
    .catch((error) => {
      console.log(error);
    });
});

flightSuretyApp.methods
  .REGISTRATION_FEE()
  .call()
  .then((amount) => {
    for (let i = 10; i < ORACLES_COUNT; i++) {
      flightSuretyApp.methods
        .registerOracle()
        .send({ from: accounts[i], value: amount, gas: gas })
        .then(() => {
          flightSuretyApp.methods
            .getMyIndexes()
            .call({ from: accounts[i] })
            .then((results) => {
              for (let j in results) {
                if (oracles[results[j]] == null) {
                  oracles[results[j]] = [];
                }
                oracles[results[j]].push(accounts[i]);
              }
            });
        })
        .catch((error) => {
          console.log(`${error}\nOracle ${accounts[i]} was not registered`);
        });
    }
  });

flightSuretyApp.events.OracleRequest({ fromBlock: 0 }, function (error, event) {
  if (event) {
    const index = event.returnValues.index;
    const airline = event.returnValues.airline;
    const flight = event.returnValues.flight;
    const timestamp = event.returnValues.timestamp;

    for (let oracle in oracles[index]) {
      let statusCode =
        STATUS_CODES[Math.floor(Math.random() * STATUS_CODES.length)];
      flightSuretyApp.methods
        .submitOracleResponse(index, airline, flight, timestamp, statusCode)
        .send({ from: oracles[index][oracle], gas: gas })
        .then(() => {
          console.log(
            `Oracle:${oracles[index][oracle]}\nIndex:${index}\nStatusCode:${statusCode}\nFlightCode: ${flight}\n\n`
          );
        })
        .catch((error) => {
          console.log(
            `An error occured while sending oracle response\n${error}`
          );
        });
    }
  } else {
    console.log(error);
  }
});

flightSuretyApp.events.OracleReport({ fromBlock: 0 }, function (error, event) {
  error ? console.log(error) : console.log(event);
});

flightSuretyData.events.AirlineRegistered(
  { fromBlock: 0 },
  function (error, event) {
    error ? console.log(error) : console.log(event);
  }
);

flightSuretyData.events.AirlineFunded(
  { fromBlock: 0 },
  function (error, event) {
    error ? console.log(error) : console.log(event);
  }
);

flightSuretyData.events.FlightRegistered(
  { fromBlock: 0 },
  function (error, event) {
    if (event) {
      const flightCode = event.returnValues.flightCode;
      const airline = event.returnValues.airline;
      const timestamp = event.returnValues.timestamp;
      flights[flightCode] = [airline, timestamp];
    } else {
      console.log(error);
    }
  }
);

flightSuretyApp.events.FlightStatusInfo(
  { fromBlock: 0 },
  function (error, event) {
    error ? console.log(error) : console.log(event);
  }
);

flightSuretyData.events.FlightStatusUpdated(
  { fromBlock: 0 },
  function (error, event) {
    error ? console.log(error) : console.log(event);
  }
);

flightSuretyData.events.InsurancePurchased(
  { fromBlock: 0 },
  function (error, event) {
    error ? console.log(error) : console.log(event);
  }
);

flightSuretyData.events.InsureeCredited(
  { fromBlock: 0 },
  function (error, event) {
    error ? console.log(error) : console.log(event);
  }
);

flightSuretyData.events.InsureePaid({ fromBlock: 0 }, function (error, event) {
  error ? console.log(error) : console.log(event);
});

const app = express();
let cors = require("cors");
app.use(cors());

app.get("/api", (req, res) => {
  res.send({
    message: "An API for use with your Dapp!",
  });
});

app.get("/flights", (req, res) => {
  res.send({
    status: "success",
    flights,
  });
});

export default app;
