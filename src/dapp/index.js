import DOM from "./dom";
import Contract from "./contract";
import "./flightsurety.css";

(async () => {
  //   let result = null;
  let statusCodes = {
    0: "STATUS_CODE_UNKNOWN",
    10: "STATUS_CODE_ON_TIME",
    20: "STATUS_CODE_LATE_AIRLINE",
    30: "STATUS_CODE_LATE_WEATHER",
    40: "STATUS_CODE_LATE_TECHNICAL",
    50: "STATUS_CODE_LATE_OTHER",
  };

  let contract = new Contract("localhost", () => {
    // Read transaction
    contract.isOperational((error, result) => {
      display("Operational Status", "Check if contract is operational", [
        { label: "Operational Status", error: error, value: result },
      ]);
    });

    // User-submitted transaction
    DOM.elid("submit-oracle").addEventListener("click", () => {
      let flightCode = DOM.elid("flight-number").value;
      let airline = DOM.elid("flight-airline").value;
      let timestamp = DOM.elid("flight-timestamp").value;
      // Write transaction
      contract.fetchFlightStatus(
        flightCode,
        airline,
        timestamp,
        (error, result) => {
          display("Oracles", "Trigger oracles", [
            {
              label: "Fetch Flight Status",
              error: error,
              value: result.flight + " " + result.timestamp,
            },
          ]);
        }
      );
    });

    DOM.elid("submit-status").addEventListener("click", () => {
      let flightCode = DOM.elid("flight-number").value;
      let airline = DOM.elid("flight-airline").value;
      let timestamp = DOM.elid("flight-timestamp").value;
      contract.flightStatus(flightCode, timestamp, airline, (error, result) => {
        display("Flight status", "Get flight status code update", [
          {
            label: "Check flight status",
            error: error,
            value: statusCodes[result],
          },
        ]);
      });
    });

    DOM.elid("submit-insurance").addEventListener("click", () => {
      let flightCode = DOM.elid("flight-number").value;
      let airline = DOM.elid("flight-airline").value;
      let timestamp = DOM.elid("flight-timestamp").value;
      contract.buy(flightCode, timestamp, airline, (error, result) => {
        display("Buy insurance", "Buy insurance", [
          {
            label: "Insurance status",
            error: error,
            value: `Insurance purchased for flight ${result.flightCode}`,
          },
        ]);
      });
    });

    DOM.elid("submit-credit").addEventListener("click", () => {
      contract.checkInsureeCredit((error, result) => {
        display("Credit", "Credit", [
          {
            label: "Credit amount",
            error: error,
            value: `${result / 100e16} ETH`,
          },
        ]);
      });
    });

    DOM.elid("submit-withdraw").addEventListener("click", () => {
      contract.pay((error, result) => {
        display("Withdraw credit", "Withdraw balance", [
          {
            label: "Withdraw balance",
            error: error,
            value: `txHash: ${result}`,
          },
        ]);
      });
    });
  });
})();

function display(title, description, results) {
  let displayDiv = DOM.elid("display-wrapper");
  let section = DOM.section();
  section.appendChild(DOM.h2(title));
  section.appendChild(DOM.h5(description));
  results.map((result) => {
    let row = section.appendChild(DOM.div({ className: "row" }));
    row.appendChild(DOM.div({ className: "col-sm-4 field" }, result.label));
    row.appendChild(
      DOM.div(
        { className: "col-sm-8 field-value" },
        result.error ? String(result.error) : String(result.value)
      )
    );
    section.appendChild(row);
  });
  displayDiv.append(section);
}
