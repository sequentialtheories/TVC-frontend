# The Vault Club - Product Requirements Document

## Original Problem Statement
A DeFi investment platform that connects to Supabase for authentication and contract management. Users can create and manage "contracts" that deposit funds into different "strands" (investment strategies) over time.

## Core Features Implemented

### Authentication & Wallet
- Supabase authentication (email/password)
- Non-custodial wallet creation via ethers.js (client-side)
- Wallet synced with Sequence Theory account login
- Full wallet details display with address copy and PolygonScan link
- Terms of Service acceptance flow

### Contract Management  
- Create contracts with various templates (Beta, Foundation, Custom, etc.)
- Template-based contract creation with 3D card carousel
- Support for Light/Medium/Heavy investment rigor levels
- Configurable lockup periods (1 month to 25 years)
- **APY Validation**: Custom contracts blocked if APY < 1.5% (shows "Net Negative Return")

### Home Page
- Large balance display
- **"$X Earned" display with timeline tabs (1W, 1M, 1Y, All)** - Real data from contracts
- **Beautiful smooth curve chart** showing deposits vs earnings (SVG bezier curves)
- Contract progress bars with click-to-view details
- **Strands Modal** - Opens when clicking on a contract to show DNA strand details
- Empty state when no contracts selected

### Future Simulation Page → **Compound Calculator**
- **Simplified to a basic compound interest calculator**
- Only 3 settings: APY slider, Time Period, Weekly Contribution
- Removed: 3 strand APYs, wBTC price, Participants
- Chart shows only Total Value (no wBTC overlays)
- Simple metrics: Final Value, Total Deposited, Interest Earned
- **"More Details" dropdown** contains: wBTC conversion info, Gas Fees, Utility Fees

### Data/Dataset Page
- System metrics display
- Strand balances visualization
- Live API rate displays
- **Averaged Earnings Rate** calculation (weighted by strand allocation)

### Wallet Page
- **Full non-custodial wallet details** with full address display
- Copy address functionality
- View on PolygonScan link
- Network info (Polygon)
- Security notice about non-custodial nature

## UI/UX Enhancements (Latest Session - Dec 2025)

### Completed This Session
1. **Removed "Future+" from timeline** - Only 1W, 1M, 1Y, All tabs now
2. **Replaced bar chart with smooth curves** - Real earnings data with deposits (purple) vs earnings (green)
3. **Bigger bottom navigation** - p-3 padding, w-5 h-5 icons, text-xs font-semibold
4. **APY validation for Custom contracts** - Blocks deployment if < 1.5% APY, shows "Net Negative Return"
5. **Enhanced Wallet page** - Full address, copy button, explorer link, non-custodial notice
6. **Removed ALL RRL references** - No more "Routed Reinvestment Logic" anywhere

### Previous Session
- Font changed from Inter to Nunito (soft, rounded)
- Bar chart on Future page (purple→orange gradient)
- Light mode text fixes
- Strands modal on contract click

## Tech Stack
- **Frontend**: React, TypeScript, Vite, TailwindCSS
- **Backend**: Supabase (Auth, Database, Edge Functions)
- **External APIs**: 
  - DeFi Llama (yields.llama.fi) - APY data
  - CoinGecko - BTC price (fallback)
- **Wallet**: ethers.js (client-side generation)

## Key Files
- `/app/frontend/src/components/VaultClubWebsite.tsx` - Main monolithic component
- `/app/frontend/src/index.css` - Global styles, animations, theming
- `/app/frontend/index.html` - Font imports (Nunito)
- `/app/frontend/src/components/tutorial/` - Tutorial system
- `/app/frontend/src/components/ToSAgreementModal.tsx` - Terms of Service

## Known Issues
- `VaultClubWebsite.tsx` is oversized (3000+ lines) - needs component breakdown

## Future Tasks / Backlog

### P0 - Critical
- Break down `VaultClubWebsite.tsx` into smaller components:
  - `HomePage.tsx`
  - `ContractsPage.tsx`  
  - `FutureSimulationPage.tsx`
  - `CreateContractModal.tsx`
  - `StrandsModal.tsx`

### P1 - Important
- Complete wallet integration for real blockchain deposits
- Add actual contract deployment functionality
- Implement contract joining via share links

### P2 - Nice to Have
- Remove unused CoinGecko integration code
- Add more contract templates
- Implement notification system for deposits

## API Endpoints (External)
- `https://yields.llama.fi/pools` - DeFi protocol APY data
- `https://api.coingecko.com/api/v3/simple/price` - Bitcoin price

## Credentials
- Supabase project configured in environment variables
- Test accounts can be created on-the-fly

---
Last Updated: December 2025
