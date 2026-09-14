# OceanEmbed-PG

**A Physics-Guided Deep Learning Framework for 3D Subsurface Ocean Temperature Reconstruction**  
Built for SIH26066 · Ministry of Earth Sciences (MoES) / INCOIS

## Overview
OceanEmbed-PG reconstructs the full 3D subsurface temperature structure of the North Indian Ocean (0–1000m) in real-time from 7 surface satellite parameters using a physics-constrained neural network. 

The web interface is designed with a high-contrast, technical aesthetic, and includes live marine AIS vessel tracking, 3D voxel modeling, 2D basin transects, ARGO matchup statistics, and Tropical Cyclone Heat Potential (TCHP) readouts.

## Quick Start
1. Ensure Node.js (v20+) is installed.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server (requires WebSocket support for AIS streaming):
   ```bash
   node --experimental-websocket server.mjs
   ```
4. Access the web interface at `http://localhost:4173`.

## Deliverables & Documentation
- **Live Platform**: Real-time rendering, AIS tracking, AI diagnostics (http://localhost:4173).
- **Engineering PDF**: `OceanEmbed_PG_SIH2026_Engineering_and_Data_Specification.pdf` (Printable reference).
- **Technical Dossier**: `SIH_2026_COMPLETE_TECHNICAL_DOSSIER.md` (Copy-paste friendly documentation with Python/PyTorch code).
- **Comprehensive Text Documentation**: `OCEANEMBED_COMPLETE_DOCUMENTATION.txt`

## Handoff
Please refer to `HANDOFF.md` for a complete architectural breakdown of the source code and components for incoming developers.
