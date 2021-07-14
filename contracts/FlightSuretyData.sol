pragma solidity ^0.4.25;

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

contract FlightSuretyData {
    using SafeMath for uint256;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    address private contractOwner;                                      // Account used to deploy contract
    bool private operational = true;                                    // Blocks all state changes throughout the contract if false
    uint256 private totalAirlines = 0;
    uint256 private funds = 0;

    uint8 private constant STATUS_CODE_UNKNOWN = 0;
    uint8 private constant STATUS_CODE_LATE_AIRLINE = 20;
    uint256 public constant FLIGHT_INSURANCE_AMOUNT = 1 ether;
    uint256 public constant AIRLINE_SEED_FUNDING = 10 ether;

    struct Airline {
        address airline;
        bool registered;
        bool seedFund;
    }

    struct Flight {
        string flightCode;
        bool isRegistered;
        uint8 statusCode;
        uint256 updatedTimestamp;
        address [] passengers;
        address airline;
    }

    mapping(address => Airline) private airlines;
    mapping(bytes32 => Flight) private flights;
    mapping(address => bool) private authorizedContracts;
    mapping(address => address[]) private airlineVotes;
    bytes32[] private flight_ids = new bytes32[](0);
    mapping(bytes32 => address[]) private insurees;


    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/

    event AirlineWasRegistered(address airline);
    event AirlineWasFunded(address airline, uint256 amount, bool seedFund);
    event FlightRegistered(string flightCode, address airline, uint256 timestamp);

    /********************************************************************************************/
    /*                                         CONSTRUCTOR                                      */
    /********************************************************************************************/
    /**
    * @dev Constructor
    *      The deploying account becomes contractOwner
    */
    constructor () public {
        contractOwner = msg.sender;
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
    modifier requireIsOperational() 
    {
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

    modifier requireAuthorizeContract() {
        require(authorizedContracts[msg.sender] = true, "Contract is not an authorized contract");
        _;
    }

    // modifier requireAirlineFunded() {
    //     require(airlineFunded(msg.sender) == true, 'Airline has not paid seed fund');
    //     _;
    // }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    /**
    * @dev Get operating status of contract
    *
    * @return A bool that is the current operating status
    */      
    function isOperational() public view returns(bool) {
        return operational;
    }

    function setTestingMode(bool _mode) requireIsOperational external view returns(bool) {
        bool testMode = false;
        return testMode = _mode;
    }

    function getFunds () requireIsOperational external view returns (uint256) {
        return funds;
    }

    function voted(address _airline, address _voter) private view returns (bool) {
        address[] memory votes = airlineVotes[_airline];
        for(uint i = 0; i < votes.length; i++) {
            if(votes[i] == _voter) {
                return true;
            }
        }
        return false;
    }
    /**
    * @dev Sets contract operations on/off
    *
    * When operational mode is disabled, all write transactions except for this one will fail
    */    
    function setOperatingStatus (bool mode) requireAuthorizeContract external {
        operational = mode;
    }

    function authorizeContract(address _contractAddress) external requireContractOwner {
        authorizedContracts[_contractAddress] = true;
    }

    function unAuthorizeContract(address _contractAddress) external requireContractOwner {
        delete authorizedContracts[_contractAddress];
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

   /**
    * @dev Add an airline to the registration queue
    *      Can only be called from FlightSuretyApp contract
    *
    */   
    function registerAirline (address _airline, address _voter) requireIsOperational requireAuthorizeContract external returns(bool) {
        require(airlineRegistered(_airline) == false, "Airline is already registered");
        if(totalAirlines < 4) {
            airlines[_airline] = Airline({ airline: _airline, registered: true, seedFund: false});
            totalAirlines = totalAirlines.add(1);
            emit AirlineWasRegistered(_airline);
            return airlines[_airline].registered;
        } else {
            require(voted(_airline,_voter) == false, "Caller has already voted");
            airlineVotes[_airline].push(_voter);
            uint256 requiredVotes = totalAirlines.div(2);
            uint256 numberOfVotes = airlineVotes[_airline].length;
            if(totalAirlines % 2 != 0) {
                requiredVotes = requiredVotes.add(1);
            }
            if(numberOfVotes == requiredVotes) {
                airlines[_airline] = Airline({ airline: _airline, registered: true, seedFund: false});
                totalAirlines = totalAirlines.add(1);
                emit AirlineWasRegistered(_airline);
                return airlines[_airline].registered;
            }
        }
    }

    function airlineRegistered (address _airline)  public view returns(bool) {
        return airlines[_airline].registered;
    }

    function airlineFunded (address _airline) requireIsOperational public view returns (bool) {
        return airlines[_airline].seedFund;
    }

    function getTotalAirlines() external view returns (uint256) {
        return totalAirlines;
    }

    function getVoters(address _airline) external view returns (address []) {
        return airlineVotes[_airline];
    }

    function registerFlight (address _airline, string _flightCode, uint256 _timestamp) requireIsOperational requireAuthorizeContract external {
        require(airlineFunded(_airline) == true, "Airline has not paid seed fund");
        require(isFlightRegistered(_flightCode, _timestamp, _airline) != true, "Flight has been registered");
        bytes32 key = getFlightKey(_airline, _flightCode, _timestamp);
        flights[key] = Flight({flightCode: _flightCode, isRegistered: true, statusCode: STATUS_CODE_UNKNOWN, updatedTimestamp: _timestamp, passengers: new address[](0), airline: _airline});
        flight_ids.push(key);
        insurees[key] = new address[](0);

        emit FlightRegistered(_flightCode, _airline, _timestamp);
    }

    function isFlightRegistered(string _flightCode, uint256 _timestamp, address _airline) public view returns (bool) {
        bytes32 key = getFlightKey(_airline, _flightCode, _timestamp);
        return flights[key].isRegistered;
    }


   /**
    * @dev Buy insurance for a flight
    *
    */   
    function buy
                            (                             
                            )
                            external
                            payable
    {

    }

    /**
     *  @dev Credits payouts to insurees
    */
    function creditInsurees
                                (
                                )
                                external
                                pure
    {
    }
    

    /**
     *  @dev Transfers eligible payout funds to insuree
     *
    */
    function pay
                            (
                            )
                            external
                            pure
    {
    }

   /**
    * @dev Initial funding for the insurance. Unless there are too many delayed flights
    *      resulting in insurance payouts, the contract should be self-sustaining
    *
    */   
    function fund (address _airline, uint256 _amount) requireAuthorizeContract public payable {
        require(_amount >= AIRLINE_SEED_FUNDING, "Atlist 10 ether is required");
        funds = funds.add(_amount);
        airlines[_airline] = Airline({ airline: _airline, registered: true, seedFund: true});
        emit AirlineWasFunded(_airline, _amount, airlines[_airline].seedFund);
    }

    function getFlightKey (address airline, string memory flight, uint256 timestamp) pure internal returns(bytes32) {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    /**
    * @dev Fallback function for funding smart contract.
    *
    */
    function() external payable {
        fund(msg.sender,msg.value);
    }


}

