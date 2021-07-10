pragma solidity ^0.4.24;

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

contract FlightSuretyData {
    using SafeMath for uint256;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    address private contractOwner;                                      // Account used to deploy contract
    bool private operational = true;                                    // Blocks all state changes throughout the contract if false

    // Flight status codees
    uint8 private constant STATUS_CODE_UNKNOWN = 0;
    uint8 private constant STATUS_CODE_LATE_AIRLINE = 20;
    uint256 public constant FLIGHT_INSURANCE_AMOUNT = 1 ether;
    uint256 public constant AIRLINE_SEED_FUNDING = 10 ether;

    struct Airline {
        bool isRegistered;
        string name;
        address airline;
    }

    struct Flight {
        string flightCode;
        bool isRegistered;
        uint8 statusCode;
        uint256 updatedTimestamp;
        address airline;
    }

    uint256 private totalAirlines = 0;
    uint256 private insuranceCounter = 0;

    mapping(address => Airline) private airlines;
    mapping(bytes32 => Flight) private flights;
    bytes32[] private flight_ids = new bytes32[](0);
    mapping(bytes32 => bool) private insurances;
    mapping(bytes32 => address[]) private insurees;
    mapping(address => uint256) private funds;
    mapping(address => uint256) private authorizedCallers;
    mapping(address => uint256) private payouts;


    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/

    event AirlineWasRegistered(string name, address airline);
    event AirlineWasFunded(address airline, uint256 amount, string name);
    event FlightRegistered(string flightCode, address airline, uint256 timestamp);
    event FlightStatusUpdated(string flightCode, address airline, uint256 timestamp, uint8 statusCode);
    event InsurancePurchased(string flightCode, address insuree, address airline, uint256 amount);
    event InsureePaid(address insuree, uint256 insuredAmount);
    event InsureeCredited(string flight, address insuree, address airline, uint256 creditAmount);

    /********************************************************************************************/
    /*                                          CONSTRUCTOR                                     */
    /********************************************************************************************/

    /**
    * @dev Constructor
    *      The deploying account becomes contractOwner
    */
    constructor (string name, address airline) public {
        contractOwner = msg.sender;
        //First airline
        airlines[airline].name = name;
        airlines[airline].isRegistered = true;
        airlines[airline].airline = airline;

        totalAirlines = totalAirlines.add(1);
        emit AirlineWasRegistered(name, airline);
    }

    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    /**
    * @dev Modifier that requires the "operational" boolean variable to be "true"
    *      This is used on all state changing functions to pause the contract in 
    *      the event there is an issue that needs to be fixed
    */
    modifier requireIsOperational() {
        require(operational, "Contract is currently not operational");
        _;  // All modifiers require an "_" which indicates where the function body will be added
    }

    /**
    * @dev Modifier that requires the "ContractOwner" account to be the function caller
    */
    modifier requireContractOwner() {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

    modifier requireCallerAuthorized() {
        require(authorizedCallers[msg.sender] == 1, "Caller is not authorised");
        _;
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    /**
    * @dev Get operating status of contract
    *
    * @return A bool that is the current operating status
    */      
    function isOperational () public view returns(bool) {
        return operational;
    }


    /**
    * @dev Sets contract operations on/off
    *
    * When operational mode is disabled, all write transactions except for this one will fail
    */    
    function setOperatingStatus ( bool mode ) external requireContractOwner {
        operational = mode;
    }

    function flightStatus(string flightCode, uint256 timestamp, address airline) public view returns (uint8) {
        bytes32 key = getFlightKey(airline, flightCode, timestamp);
        return flights[key].statusCode;
    }

    function authorizeCaller(address contractAddress) public requireContractOwner {
        authorizedCallers[contractAddress] = 1;
    }

    function unAuthorizeCaller(address contractAddress) public requireContractOwner {
        delete authorizedCallers[contractAddress];
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

   /**
    * @dev Add an airline to the registration queue
    *      Can only be called from FlightSuretyApp contract
    *
    */   
    function registerAirline (string name, address airline) requireIsOperational external returns(bool) {
        require(airlineRegistered(airline) == false, "Airline is already registered.");
        airlines[airline] = Airline({ isRegistered: true, name: name, airline: airline});
        totalAirlines = totalAirlines.add(1);
        emit AirlineWasRegistered(name, airline);
        return true;
    }

    function airlineRegistered(address airline) public view returns (bool) {
        return airlines[airline].isRegistered;
    }

    function airlineFunded (address airline) public view returns (bool) {
        require(airlineRegistered(airline) == true, "Airline is not registered");
        return funds[airline] >= AIRLINE_SEED_FUNDING;
    }

    function isFlightRegistered(string flightCode, uint256 timestamp, address airline) public view returns (bool) {
        bytes32 key = getFlightKey(airline, flightCode, timestamp);
        return flights[key].isRegistered;
    }

    function isFlightInsured(string flightCode, uint256 timestamp, address airline, address insuree) public view returns (bool){
        bytes32 insuranceFlightKey = keccak256(abi.encodePacked(airline, flightCode, timestamp, insuree));
        return insurances[insuranceFlightKey];
    }

    function updateFlightStatus(string flightCode, address airline, uint8 statusCode, uint256 timestamp) requireIsOperational external {
        require(isFlightRegistered(flightCode, timestamp, airline) == true, "Flight is not registered");
        bytes32 key = getFlightKey(airline, flightCode, timestamp);
        flights[key].statusCode = statusCode;

        emit FlightStatusUpdated(flightCode, airline, timestamp, statusCode);

    }

    function getTotalAirlines() requireIsOperational external view returns (uint256) {
        return totalAirlines;
    }

    function registerFlight(address airline, string flightCode, uint256 timestamp) requireIsOperational external {
        require(airlineFunded(airline) == true, "Airline has not paid seed fund");
        require(isFlightRegistered(flightCode, timestamp, airline) != true, "Flight has been registered");

        bytes32 key = getFlightKey(airline, flightCode, timestamp);
        flights[key] = Flight({flightCode: flightCode, isRegistered: true, statusCode: STATUS_CODE_UNKNOWN, updatedTimestamp: timestamp, airline: airline});
        flight_ids.push(key);
        insurees[key] = new address[](0);

        emit FlightRegistered(flightCode, airline, timestamp);
    }

   /**
    * @dev Buy insurance for a flight
    *
    */   
    function buy (string flightCode, uint256 timestamp, address airline, address insuree, uint256 amount) requireIsOperational requireCallerAuthorized external payable {
        require(amount == FLIGHT_INSURANCE_AMOUNT, "Required amount is one ether");
        require(isFlightRegistered(flightCode,timestamp, airline) == true, "Flight is not registered");
        require(isFlightInsured(flightCode, timestamp, airline, insuree) != true, "You already have insurance for this flight");
        bytes32 key = getFlightKey(airline, flightCode, timestamp);
        bytes32 insuranceFlightKey = keccak256(abi.encodePacked(airline, flightCode, timestamp, insuree));
        insurances[insuranceFlightKey] = true;
        insurees[key].push(insuree);

        emit InsurancePurchased(flightCode, insuree, airline, amount);
    }

    function checkInsureeCredit (address insuree) requireIsOperational external view returns(uint256) {
        return payouts[insuree];
    }

    /**
     *  @dev Credits payouts to insurees
    */
    function creditInsurees (string flightCode, uint256 timestamp, address airline) requireIsOperational external {
        bytes32 key =  getFlightKey(airline, flightCode, timestamp);
        require(flights[key].statusCode == STATUS_CODE_LATE_AIRLINE, "Flight delay conditions are not met");
        address[] memory qualifiedInsuree = insurees[key];
        uint256 creditAmount = FLIGHT_INSURANCE_AMOUNT.mul(3).div(2);
        for(uint i = 0; i < qualifiedInsuree.length; i++) {
            payouts[qualifiedInsuree[i]] = payouts[qualifiedInsuree[i]].add(creditAmount);
            bytes32 insuranceFlightKey = keccak256(abi.encodePacked(airline, flightCode, timestamp, qualifiedInsuree[i]));
            delete insurances[insuranceFlightKey];

            emit InsureeCredited(flightCode, qualifiedInsuree[i], airline, creditAmount);
        }
        insurees[key] = new address[](0);

    }
    

    /**
     *  @dev Transfers eligible payout funds to insuree
     *
    */
    function pay (address insuree) requireIsOperational requireCallerAuthorized external returns (uint256){
        uint256 amountDue = payouts[insuree];
        payouts[insuree] = 0;

        emit InsureePaid(insuree, amountDue);
        return amountDue;
    }

   /**
    * @dev Initial funding for the insurance. Unless there are too many delayed flights
    *      resulting in insurance payouts, the contract should be self-sustaining
    *
    */   
    function fund (address airline, uint256 amount) requireIsOperational public payable {
        require(airlineRegistered(airline) == true, "Airline is not registered");
        require(amount >= AIRLINE_SEED_FUNDING, "Atlist 10 ether is required");
        funds[airline] = funds[airline].add(amount);

        emit AirlineWasFunded(airline, amount, airlines[airline].name);

    }

    function getFlightKey ( address airline, string memory flight, uint256 timestamp ) pure internal returns(bytes32) {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    /**
    * @dev Fallback function for funding smart contract.
    *
    */
    function () external payable {
        fund(msg.sender, msg.value);
    }


}

