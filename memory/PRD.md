# The Vault Club - Product Requirements Document

## Original Problem Statement
A DeFi investment platform that connects to Supabase for authentication and contract management. Users can create and manage "contracts" that deposit funds into different "strands" (investment strategies) over time.

## Core Features Implemented

### Authentication & Wallet
- Supabase authentication (email/password)
- Non-custodial wallet creation via Turnkey Edge Function
- Terms of Service acceptance flow

### Contract Management  
- Create contracts with various templates (Beta, Foundation, Custom, etc.)
- Template-based contract creation with 3D card carousel
- Support for Light/Medium/Heavy investment rigor levels
- Configurable lockup periods (1 month to 25 years)

### Home Page
- Large balance display
- **"$X Earned" display with timeline tabs (1W, 1M, 1Y, All, Future+)**
- **Beautiful bar chart showing daily earnings**
- Contract progress bars with click-to-view details
- **Strands Modal** - Opens when clicking on a contract to show DNA strand details

### Future Simulation Page
- Interactive simulation parameters (APY sliders, BTC price, rigor level)
- **Beautiful bar chart visualization** (replaced line chart)
- Year-by-year growth projection (Y1-Y15+)
- Purple bars for Phase 1, orange bars for Phase 2 (wBTC)
- Key metrics display (Total Value, ROI, wBTC Holdings)
- **"More Details" dropdown** with Peak Strand Distribution

### Data/Dataset Page
- System metrics display
- Strand balances visualization
- Live API rate displays

## UI/UX Enhancements (Latest Session - Dec 2025)

### Completed
1. **Font Change**: Inter → Nunito (soft, rounded, consumer-friendly)
2. **"$X Earned" Feature**: Added earnings display with timeline tabs on homepage
3. **Bar Chart Visualization**: Replaced line charts with beautiful gradient bar charts
4. **Light Mode Fix**: Fixed text contrast issues across all pages
5. **Strands Modal**: Clicking on contracts opens a detailed modal with strand info
6. **Softer Input Styling**: Updated simulation parameter inputs with premium styling

### Visual Style
- "Bubbly" and consumer-friendly aesthetic
- Soft gradient bars (purple → orange transition)
- Glass-morphism cards with rounded corners (28px)
- Smooth animations and transitions
- Nunito font for friendly, approachable feel

## Tech Stack
- **Frontend**: React, TypeScript, Vite, TailwindCSS
- **Backend**: Supabase (Auth, Database, Edge Functions)
- **External APIs**: 
  - DeFi Llama (yields.llama.fi) - APY data
  - CoinGecko - BTC price (fallback)
- **Wallet**: Turnkey (non-custodial)

## Key Files
- `/app/frontend/src/components/VaultClubWebsite.tsx` - Main monolithic component (needs refactoring)
- `/app/frontend/src/index.css` - Global styles, animations, theming
- `/app/frontend/index.html` - Font imports
- `/app/frontend/src/components/tutorial/` - Tutorial system

## Known Issues
- Light mode timeline tabs could have slightly darker text (minor)
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
- Complete wallet integration for real deposits
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
