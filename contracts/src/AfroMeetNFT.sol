// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {CreatorVibeToken} from "./CreatorVibeToken.sol";
import {DAOTreasury} from "./DAOTreasury.sol";
import {CreatorDAOFactory} from "./CreatorDAOFactory.sol";
import {IAccessRegistrySetup, ISplitResolverSetup} from "./interfaces/IAccessSetup.sol";

/// @title AfroMeetNFT
/// @notice Main ERC-721 contract for creative works (music, video, writing, artwork, photography).
///         The first mint by a creator auto-creates their ecosystem — governance token, DAO, and
///         treasury — and every mint distributes a fixed CreatorVibeToken reward.
/// @dev    Each work is a unique ERC-721 token; editions are separate tokenIds that share a work's
///         off-chain config. Secondary-sale royalties and the 2% cultural cut are handled by the
///         marketplace, not here.
contract AfroMeetNFT is ERC721URIStorage, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Ecosystem {
        address token;
        address dao;
        address treasury;
        bool exists;
    }

    /// @notice CreatorVibeTokens minted to the creator on each work mint.
    uint256 public constant CREATOR_MINT_REWARD = 100e18;
    /// @notice VIBE minted per 1 USDC when a fan buys governance power (1 VIBE = 1 USDC).
    ///         USDC is 6dp and VIBE is 18dp, so each USDC unit mints 1e12 VIBE units.
    uint256 public constant VIBE_PER_USDC = 1e12;

    IERC20 public immutable usdc;
    /// @notice External factory that deploys the per-creator Governor (kept out of this contract
    ///         to stay under the EIP-170 size limit).
    CreatorDAOFactory public immutable daoFactory;

    uint256 public nextTokenId;
    mapping(address creator => Ecosystem) public ecosystems;
    mapping(uint256 tokenId => address creator) public creatorOf;

    /// @notice One-time admin permitted to wire the access + split layers (the deployer).
    address public immutable admin;
    /// @notice Access + split layers, wired once post-deploy to enable single-signature minting.
    IAccessRegistrySetup public accessRegistry;
    ISplitResolverSetup public splitResolver;

    event EcosystemCreated(address indexed creator, address token, address dao, address treasury);
    event WorkMinted(uint256 indexed tokenId, address indexed creator, string uri);
    event AccessLayerSet(address registry, address resolver);
    event VibePurchased(address indexed creator, address indexed buyer, uint256 usdcPaid, uint256 vibeMinted);

    constructor(IERC20 usdc_, CreatorDAOFactory daoFactory_) ERC721("AfroMeet Work", "AFRO") {
        require(address(usdc_) != address(0), "usdc=0");
        require(address(daoFactory_) != address(0), "daoFactory=0");
        usdc = usdc_;
        daoFactory = daoFactory_;
        admin = msg.sender;
    }

    /// @notice One-time wiring of the AccessRegistry + SplitResolver (deployed after this contract),
    ///         which enables the single-signature `mintWorkWithSetup` flow.
    function setAccessLayer(IAccessRegistrySetup registry_, ISplitResolverSetup resolver_) external {
        require(msg.sender == admin, "not admin");
        require(address(accessRegistry) == address(0), "already set");
        require(address(registry_) != address(0) && address(resolver_) != address(0), "addr=0");
        accessRegistry = registry_;
        splitResolver = resolver_;
        emit AccessLayerSet(address(registry_), address(resolver_));
    }

    /// @notice Mint a new creative work. The caller is the creator; the work mints to them.
    function mintWork(string calldata uri) external nonReentrant returns (uint256 tokenId) {
        return _mintWork(uri);
    }

    /// @notice Mint a work, set its access config, and set its royalty splits in one transaction —
    ///         a single signature instead of three. The NFT configures the freshly-minted token on
    ///         the creator's (msg.sender's) behalf via the NFT-gated setup functions.
    function mintWorkWithSetup(
        string calldata uri,
        uint256 pricePerAccess,
        uint256 discoveryPrice,
        uint256 ratePerSecond,
        uint8 mode,
        uint256 minAccessSeconds,
        address[] calldata recipients,
        uint256[] calldata bps
    ) external nonReentrant returns (uint256 tokenId) {
        require(address(accessRegistry) != address(0), "access layer unset");
        tokenId = _mintWork(uri);
        accessRegistry.setConfigFrom(
            tokenId, msg.sender, pricePerAccess, discoveryPrice, ratePerSecond, mode, minAccessSeconds
        );
        splitResolver.setSplitsFrom(tokenId, recipients, bps);
    }

    /// @notice Buy voting power in a creator's DAO. The buyer pays `usdcAmount` USDC (which goes to
    ///         that creator's treasury) and receives VIBE at 1 VIBE = 1 USDC. Anyone can buy — this
    ///         is how fans get governance weight in a creator's ecosystem. The buyer still needs to
    ///         `delegate` their VIBE for it to count as votes.
    function buyVibe(address creator, uint256 usdcAmount) external nonReentrant returns (uint256 vibeMinted) {
        Ecosystem memory eco = ecosystems[creator];
        require(eco.exists, "no ecosystem");
        require(usdcAmount > 0, "amount=0");

        usdc.safeTransferFrom(msg.sender, eco.treasury, usdcAmount); // proceeds fund the treasury
        vibeMinted = usdcAmount * VIBE_PER_USDC;
        CreatorVibeToken(eco.token).distributeTokens(msg.sender, vibeMinted, "VIBE_PURCHASE");

        emit VibePurchased(creator, msg.sender, usdcAmount, vibeMinted);
    }

    function _mintWork(string calldata uri) internal returns (uint256 tokenId) {
        address creator = msg.sender;
        if (!ecosystems[creator].exists) {
            _createCreatorEcosystem(creator);
        }

        tokenId = ++nextTokenId;
        creatorOf[tokenId] = creator;
        _safeMint(creator, tokenId);
        _setTokenURI(tokenId, uri);

        CreatorVibeToken(ecosystems[creator].token).distributeTokens(
            creator, CREATOR_MINT_REWARD, "NFT_MINT_CREATOR"
        );

        emit WorkMinted(tokenId, creator, uri);
    }

    function _createCreatorEcosystem(address creator) internal {
        CreatorVibeToken token = new CreatorVibeToken("Creator Vibe Token", "VIBE", address(this));
        address dao = daoFactory.createDAO(token);
        DAOTreasury treasury = new DAOTreasury(usdc, dao);

        ecosystems[creator] = Ecosystem({
            token: address(token),
            dao: dao,
            treasury: address(treasury),
            exists: true
        });

        emit EcosystemCreated(creator, address(token), dao, address(treasury));
    }

    function ecosystemOf(address creator) external view returns (Ecosystem memory) {
        return ecosystems[creator];
    }

    function treasuryOf(address creator) external view returns (address) {
        return ecosystems[creator].treasury;
    }
}
