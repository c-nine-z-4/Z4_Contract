// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.4;

import "./SafeMath.sol";

contract SB {
    using SafeMath for uint256;

    string public constant name = "Shuai Bi";
    string public constant symbol = "SB";
    uint8 public constant decimals = 6;
    uint256 public constant totalSupply = 10_000e6;

    mapping(address => uint256) private balances;
    mapping(address => mapping(address => uint256)) private allowances;

    constructor(address _account) {
        balances[_account] = totalSupply;
        emit Transfer(address(0), _account, totalSupply);
    }

    function balanceOf(address _account) external view returns (uint256) {
        return balances[_account];
    }

    function transfer(address recipient, uint256 amount)
        external
        returns (bool)
    {
        balances[msg.sender] = balances[msg.sender].sub(amount);
        balances[recipient] = balances[recipient].add(amount);

        emit Transfer(msg.sender, recipient, amount);
        return true;
    }

    function allowance(address owner, address spender)
        external
        view
        returns (uint256)
    {
        return allowances[owner][spender];
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowances[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external returns (bool) {
        allowances[sender][msg.sender] = allowances[sender][msg.sender].sub(
            amount
        );
        balances[sender] = balances[sender].sub(amount);
        balances[recipient] = balances[recipient].add(amount);
        emit TransferFrom(sender, sender, recipient, amount);
        return true;
    }

    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );
    event Transfer(address indexed from, address indexed to, uint256 value);
    event TransferFrom(
        address indexed sender,
        address indexed from,
        address indexed to,
        uint256 value
    );
}