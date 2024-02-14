// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require("hardhat");
const { expect } = require("chai");
const bignum = require('bignum');

async function main() {
  console.log("start test")
  const [owner, ercOwner, liquter, swaper, ethReceiver] = await hre.ethers.getSigners();
  //--------deploy factory
  const FactoryV2 = await hre.ethers.getContractFactory("Z4swapV2Factory");
  const factory = await FactoryV2.connect(owner).deploy(owner.address);
  await factory.deployed();
  expect(await factory.feeToSetter()).to.equal(owner.address);

  //--------deploy sb token
  const SB = await hre.ethers.getContractFactory("SB");//10000 8
  const sb = await SB.connect(ercOwner).deploy(ercOwner.address);
  await sb.deployed();
  expect(await sb.balanceOf(liquter.address)).to.equal(0);
  await sb.connect(ercOwner).transfer(liquter.address,1000*10**6);
  expect(await sb.balanceOf(liquter.address)).to.equal(1000*10**6);

  //--------deploy weth token
  const Weth = await hre.ethers.getContractFactory("WETH9");
  const weth = await Weth.connect(ercOwner).deploy();
  await weth.deployed();
  expect(await weth.symbol()).to.equal("WETH");
  expect(await weth.balanceOf(liquter.address)).to.equal(0);
  await weth.connect(liquter).deposit({ value: ethers.utils.parseEther("10") });
  expect(await weth.balanceOf(liquter.address)).to.equal((10*10**18).toString());

  //--------deploy sa token
  const SA = await hre.ethers.getContractFactory("SA");
  const sa = await SA.connect(ercOwner).deploy(ercOwner.address);
  await sa.deployed();
  expect(await sa.balanceOf(liquter.address)).to.equal(0);
  await sa.connect(ercOwner).transfer(liquter.address,9000*10**8);
  expect(await sa.balanceOf(liquter.address)).to.equal(9000*10**8);
  await sa.connect(ercOwner).transfer(swaper.address,1000*10**8);
  //--------deploy router
  const Router = await hre.ethers.getContractFactory("Z4swapV2Router");
  const router = await Router.connect(owner).deploy(factory.address, weth.address);
  await router.deployed();

  //--------create pool
  const Pair = await hre.ethers.getContractFactory("Z4swapV2Pair");
  //weth - sb pool
  const saltHex = ethers.utils.keccak256(ethers.utils.solidityPack(['address','address'], [sa.address,weth.address]));
  const create2Addr = ethers.utils.getCreate2Address(factory.address, saltHex, ethers.utils.keccak256(Pair.bytecode));
  await factory.connect(owner).createPair(sa.address, weth.address)
  expect(await factory.getPair(sa.address, weth.address)).to.equal(create2Addr);
  ///sa - sb pool
  const saltHex2 = ethers.utils.keccak256(ethers.utils.solidityPack(['address','address'], [sa.address,sb.address]));
  const create2Addr2 = ethers.utils.getCreate2Address(factory.address, saltHex2, ethers.utils.keccak256(Pair.bytecode));
  await factory.connect(owner).createPair(sb.address, sa.address)
  expect(await factory.getPair(sb.address, sa.address)).to.equal(create2Addr2);
  console.log("create pool success")

  //--------add Liquidity sa - sb
  const SaWethPool = Pair.attach(create2Addr);
  await SaWethPool.deployed();
  const SaSbPool = Pair.attach(create2Addr2);
  await SaSbPool.deployed();
  let ra = await SaSbPool.getReserves()
  expect(await ra._reserve0).to.equal(0);
  expect(await ra._reserve1).to.equal(0);
  const blockNumBefore = await ethers.provider.getBlockNumber();
  const blockBefore = await ethers.provider.getBlock(blockNumBefore);
  const timestampBefore = blockBefore.timestamp;
  await sa.connect(liquter).approve(router.address,1000*10**8);
  await sb.connect(liquter).approve(router.address,1000*10**6);
  await router.connect(liquter).addLiquidity(sb.address,sa.address,1*10**6,10*10**8,0,0,liquter.address,timestampBefore+100)
  ra = await SaSbPool.getReserves()
  expect(await ra._reserve0).to.equal(10*10**8);
  expect(await ra._reserve1).to.equal(1*10**6);
  expect(await SaSbPool.balanceOf(liquter.address)).to.equal(31622776-1000);
  console.log("test add Liquidity success")
  //--------remove Liquidity sa - sb
  await SaSbPool.connect(liquter).approve(router.address,31621776);
  await router.connect(liquter).removeLiquidity(sb.address,sa.address,31621776,1*10**6*0.98,10*10**8*0.98,liquter.address,timestampBefore+100)
  ra = await SaSbPool.getReserves()
  expect(await SaSbPool.balanceOf(liquter.address)).to.equal(0);
  expect(await SaSbPool.totalSupply()).to.equal(1000);
  console.log("test remove Liquidity success") 

  //--------add Liquidity sa - weth 
  ra = await SaWethPool.getReserves()
  expect(await ra._reserve0).to.equal(0);
  expect(await ra._reserve1).to.equal(0);
  await sa.connect(liquter).approve(router.address,1000*10**8);
  await weth.connect(liquter).approve(router.address,(1*10**18).toString());
  await router.connect(liquter).addLiquidityETH(sa.address,1000*10**8,0,0,liquter.address,timestampBefore+100,{ value: ethers.utils.parseEther("1") })
  ra = await SaWethPool.getReserves()
  expect(await ra._reserve0).to.equal(1000*10**8);
  expect(await ra._reserve1).to.equal((1*10**18).toString());
  expect(await SaWethPool.balanceOf(liquter.address)).to.equal(316227766016837-1000);
  console.log("test add ETHLiquidity success")

  //--------remove Liquidity sa - weth 
  await SaWethPool.connect(liquter).approve(router.address,316227766015837);
  await router.connect(liquter).removeLiquidityETH(sa.address,316227766015837,1000*10**8*0.98,(1*10**18*0.98).toString(),liquter.address,timestampBefore+100)
  expect(await SaWethPool.balanceOf(liquter.address)).to.equal(0);
  expect(await SaWethPool.totalSupply()).to.equal(1000);
  console.log("test remove ETHLiquidity success") 

  //--------swap  sa - sb  pool 
  await sa.connect(liquter).approve(router.address,1000*10**8);
  await sb.connect(liquter).approve(router.address,1000*10**6);
  await router.connect(liquter).addLiquidity(sb.address,sa.address,1*10**6,10*10**8,0,0,liquter.address,timestampBefore+100)
  // ra = await SaSbPool.getReserves()
  // console.log("_reserve0, _reserve1",ra._reserve0, ra._reserve1)
  // let r1 = ra._reserve0/(10**8)
  // let r2 = ra._reserve1/(10**6)
  // let k = r1*r2
  // let price = r1/r2
  // console.log(k,price)
  let saAmountsIn = 10*10**8
  //sa swap sb
  let amountsoutMin = await router.getAmountsOut( saAmountsIn, [sa.address,sb.address])
  await sa.connect(swaper).approve(router.address,10*10**8);
  await router.connect(swaper).swapExactTokensForTokens(10*10**8,amountsoutMin[1],[sa.address,sb.address],swaper.address,timestampBefore+100)
  expect(await sa.connect(swaper).balanceOf(swaper.address)).to.equal(990*10**8);
  expect(await sb.connect(swaper).balanceOf(swaper.address)).to.greaterThanOrEqual(amountsoutMin[1]);
  console.log("test SaSbPool swap sa 2 sb success")
  //sb swap sa
  let sbAmountsIn = await sb.connect(swaper).balanceOf(swaper.address)
  amountsoutMin = await router.getAmountsOut( sbAmountsIn, [sb.address,sa.address])
  await sb.connect(swaper).approve(router.address,sbAmountsIn);
  await router.connect(swaper).swapExactTokensForTokens(sbAmountsIn,amountsoutMin[1],[sb.address,sa.address],swaper.address,timestampBefore+100)
  let saBalance = BigInt(990*10**8) + BigInt(amountsoutMin[1])
  expect(await sa.connect(swaper).balanceOf(swaper.address)).to.greaterThanOrEqual(saBalance);
  expect(await sb.connect(swaper).balanceOf(swaper.address)).to.greaterThanOrEqual(0);
  console.log("test SaSbPool swap sb 2 sa success")

  //--------swap  sa - eth  pool
  await sa.connect(liquter).approve(router.address,1000*10**8);
  await router.connect(liquter).addLiquidityETH(sa.address,1000*10**8,0,0,liquter.address,timestampBefore+100,{ value: ethers.utils.parseEther("1") })
  //sa swap eth
  saAmountsIn = 10*10**8
  amountsoutMin = await router.getAmountsOut( saAmountsIn, [sa.address,weth.address])
  await sa.connect(swaper).approve(router.address,saAmountsIn);
  let infrontEthBalance = await ethReceiver.getBalance()
  await router.connect(swaper).swapExactTokensForETH(saAmountsIn,amountsoutMin[1],[sa.address,weth.address],ethReceiver.address,timestampBefore+100)
  expect(await sa.connect(swaper).balanceOf(swaper.address)).to.greaterThanOrEqual(BigInt(saBalance) - BigInt(1000*10**8));
  expect(await ethReceiver.getBalance()).to.greaterThanOrEqual(BigInt(infrontEthBalance)+BigInt(amountsoutMin[1]));
  console.log("test SaEthPool swap sa 2 eth success")
  //eth swap sa
  let ethAmountsIn = 1*10**18
  infrontEthBalance = await ethReceiver.getBalance()
  amountsoutMin = await router.getAmountsOut( ethAmountsIn.toString(), [weth.address,sa.address])
  await router.connect(ethReceiver).swapETHForExactTokens(amountsoutMin[1],[weth.address,sa.address],ethReceiver.address,timestampBefore+100,{ value: ethers.utils.parseEther("1") })
  expect(await sa.connect(swaper).balanceOf(ethReceiver.address)).to.greaterThanOrEqual(BigInt(amountsoutMin[1]));
  // balance - msg.value - gasfee(modify 0.001e tx Fee)
  expect(await ethReceiver.getBalance()).to.greaterThanOrEqual(BigInt(infrontEthBalance) - BigInt(1*10**18) - BigInt(0.001*10**18));
  console.log("test SaEthPool swap eth 2 sa success")
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
