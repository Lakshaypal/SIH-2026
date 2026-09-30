import docx
from docx.shared import Pt, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH

doc = docx.Document()

# --- Styles ---
style = doc.styles['Normal']
font = style.font
font.name = 'Arial'
font.size = Pt(11)

def add_heading(text, level, color=RGBColor(3, 105, 161)):
    h = doc.add_heading(text, level=level)
    h.style.font.color.rgb = color
    return h

def add_paragraph(text, bold_prefix=None):
    p = doc.add_paragraph()
    if bold_prefix:
        p.add_run(bold_prefix).bold = True
        p.add_run(" " + text)
    else:
        p.add_run(text)
    return p

# --- Title ---
title = doc.add_heading('Halocline: Seeing Beneath the Surface', 0)
title.alignment = WD_ALIGN_PARAGRAPH.CENTER
subtitle = doc.add_paragraph('SIH-2026 Complete Technical Specification & Pitch Guide\nINCOIS / Ministry of Earth Sciences')
subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
doc.add_page_break()

# --- Section 1: Problem Statement ---
add_heading('1. Problem Statement', 1)
doc.add_paragraph(
    "The ocean is largely opaque to electromagnetic radiation. While satellites provide an unprecedented, "
    "high-resolution view of the ocean's surface (measuring parameters like Sea Surface Temperature, Sea Surface "
    "Salinity, and Sea Level Anomalies), they cannot see beneath it. Understanding the 3D thermodynamic structure "
    "of the ocean—specifically the subsurface temperature and salinity profiles—is critical for everything from "
    "cyclone intensification forecasting to naval submarine operations and marine ecosystem management."
)
doc.add_paragraph(
    "Currently, the global standard for subsurface data is the ARGO float network. While highly accurate, ARGO "
    "floats are painfully sparse. A single float only profiles the water column every 10 days, drifting passively "
    "with currents. This leaves massive spatial and temporal gaps in our understanding of the ocean, especially in "
    "highly dynamic regions like the Bay of Bengal and the Arabian Sea where rapid changes occur within hours, not days."
)
doc.add_paragraph(
    "The Problem: How can we reconstruct the 3D continuous subsurface structure of the ocean at high resolution, "
    "in real-time, by fusing sparse in-situ ARGO float profiles with ubiquitous surface satellite telemetry?"
)

# --- Section 2: Solution Description ---
add_heading('2. Halocline: The Solution Description', 1)
doc.add_paragraph(
    "Halocline is a physics-guided, continuous neural depth field. Instead of relying on computationally heavy "
    "numerical ocean models (like ROMS or GLORYS) which take days to run on supercomputers, Halocline leverages "
    "Deep Learning to instantly map surface satellite anomalies to subsurface structures."
)
doc.add_paragraph(
    "By extracting 32x32 grid patches of satellite data (SST, SSS, SLA, Currents, and Winds), Halocline uses a "
    "Convolutional Surface Encoder combined with a Fourier-featured Continuous Depth Decoder. This allows the model "
    "to predict the temperature and salinity at any continuous depth level (e.g., exactly 42.5 meters), rather than "
    "being restricted to fixed grid layers."
)
doc.add_paragraph(
    "Crucially, Halocline is probabilistic. It doesn't just predict a single value; it predicts a Gaussian distribution "
    "(Mean and Standard Deviation) for every depth level, providing INCOIS operators with a quantified confidence "
    "interval (±1σ uncertainty bounds) for every prediction."
)

# --- Section 3: Technical Architecture (Minute Detail & Flow) ---
add_heading('3. Technical Architecture & Data Flow', 1)

add_heading('A. Data Ingestion & Preprocessing', 2)
doc.add_paragraph("The model ingests 7 distinct satellite data channels covering the North Indian Ocean (5°N–30°N, 45°E–105°E):")
doc.add_paragraph("1. SST (Sea Surface Temperature) - Indicates the thermal boundary condition.", style='List Bullet')
doc.add_paragraph("2. SSS (Sea Surface Salinity) - Critical for barrier layer tracking in the Bay of Bengal.", style='List Bullet')
doc.add_paragraph("3. SLA (Sea Level Anomaly) - The most vital proxy for thermocline depth. Positive SLA means a depressed thermocline (warm water expansion).", style='List Bullet')
doc.add_paragraph("4. U-Current (Zonal Velocity) - Advection tracking.", style='List Bullet')
doc.add_paragraph("5. V-Current (Meridional Velocity) - Advection tracking.", style='List Bullet')
doc.add_paragraph("6. U-Wind (Zonal Wind Stress) - Drives mechanical mixing and deepens the mixed layer.", style='List Bullet')
doc.add_paragraph("7. V-Wind (Meridional Wind Stress) - Drives mechanical mixing.", style='List Bullet')
doc.add_paragraph("Data is normalized using Z-score standardization (anomaly space) and cropped into 32x32 spatial patches around the target coordinate.")

add_heading('B. Spatiotemporal Conditioning (FiLM)', 2)
doc.add_paragraph(
    "Oceanography is highly seasonal and regional. A 28°C surface temp in January means something entirely different "
    "than a 28°C temp in July. To account for this, we use Feature-wise Linear Modulation (FiLM). The model takes the "
    "Day of Year (sine/cosine encoded) and the geographic coordinates (Lat/Lon) and injects this context directly into "
    "the ResNet layers, shifting and scaling the feature maps so the network 'knows' when and where it is looking."
)

add_heading('C. The Surface Encoder (ResNet)', 2)
doc.add_paragraph(
    "The 32x32x7 satellite patch is passed through a deep Convolutional Residual Network (ResNet). "
    "This encoder captures spatial gradients—for example, if a cold-core eddy is present, the convolutions detect the "
    "circular SLA and SST gradients. The encoder compresses this entire 32x32 spatial context into a single, dense, "
    "256-dimensional latent vector (Z)."
)

add_heading('D. The Continuous Depth Field (SIREN / Fourier Features)', 2)
doc.add_paragraph(
    "Unlike standard models that output a fixed 3D grid, Halocline is a continuous function. The latent vector (Z) is "
    "concatenated with a specific query depth (z, in meters). To capture high-frequency physical boundaries like the "
    "sharp thermocline, the depth (z) is mapped to a high-dimensional space using Fourier Features (sines and cosines "
    "at various frequencies). An MLP (Multi-Layer Perceptron) then decodes this [Z + Fourier(z)] vector into the final prediction."
)

add_heading('E. The Loss Function (Gaussian CRPS + Physical Smoothness)', 2)
doc.add_paragraph(
    "Halocline DOES NOT use standard Mean Squared Error (MSE). Ocean data is inherently noisy. Instead, it uses "
    "Continuous Ranked Probability Score (CRPS). The network outputs a Mean (µ) and a Standard Deviation (σ). "
    "The CRPS loss penalizes the model if the true ARGO float value falls outside the predicted Gaussian bell curve, "
    "forcing the model to accurately estimate its own uncertainty."
)
doc.add_paragraph(
    "Additionally, a Curvature Smoothness Penalty is applied using the second derivative of the predicted profile with "
    "respect to depth. This ensures the predicted temperature curve is physically realistic and smooth, rather than a "
    "jagged, overfitted line."
)

# --- Section 4: Real World Applications & Factors ---
add_heading('4. Real-World Applications & Disaster Management', 1)

add_heading('A. Cyclone Intensification (Disaster Management)', 2)
add_paragraph("In the Bay of Bengal, cyclones (like Amphan) often experience 'Rapid Intensification' just before landfall. "
              "SST alone cannot predict this. A thin layer of warm fresh water (Barrier Layer) can hide cold water below. "
              "Halocline predicts the exact depth of the 26°C isotherm (D26) and the Ocean Heat Content (OHC). "
              "By feeding Halocline's 3D profiles into INCOIS forecasting models, early warning systems can predict "
              "sudden cyclone jumps in category 24 hours earlier.", bold_prefix="Cyclone Tracking:")

add_heading('B. Naval Defense & Submarine Stealth', 2)
add_paragraph("Sonar propagation relies entirely on the density structure of the water, dictated by the thermocline. "
              "Submarines hide in 'shadow zones' below the thermocline where sonar waves bounce off the density gradient. "
              "By providing real-time, high-resolution continuous depth profiles anywhere in the Indian Ocean, the Indian Navy "
              "can map these acoustic shadow zones instantly without deploying active buoys, granting a massive tactical advantage.",
              bold_prefix="Acoustic Shadow Mapping:")

add_heading('C. Potential Fishing Zones (PFZ)', 2)
add_paragraph("Marine life congregates around thermal fronts and upwelling zones where nutrient-rich cold water is pushed to the surface. "
              "Halocline maps the exact depth and gradient of these upwellings (e.g., the Somali upwelling in the Arabian Sea). "
              "This allows INCOIS to issue highly targeted PFZ advisories to the Indian fishing community, maximizing yield and saving fuel.",
              bold_prefix="Fishery Economics:")

# --- Section 5: Use of Outputs ---
add_heading('5. Use of Outputs & System Integration', 1)
doc.add_paragraph(
    "Halocline is designed as a modular microservice. The output is not just a graph—it is a continuous mathematical "
    "representation of the ocean column. The outputs are utilized as follows:"
)
doc.add_paragraph("1. 3D Data Cubes: Generating high-resolution NetCDF files for any bounding box in the ocean, serving as the initialization state for Numerical Weather Prediction (NWP) models.", style='List Bullet')
doc.add_paragraph("2. Uncertainty Bounds: The predicted σ (Standard Deviation) allows downstream models to perform Data Assimilation (e.g., using a Kalman Filter). Models can trust Halocline's predictions when σ is low, and rely on climatology when σ is high.", style='List Bullet')
doc.add_paragraph("3. Real-time API: The lightweight inference engine (which can run on a laptop, as demonstrated in our Interactive Console) allows edge devices or ships at sea to download satellite telemetry via low-bandwidth connections and reconstruct the 3D ocean state locally without supercomputers.", style='List Bullet')

# Save Document
doc.save('Halocline_Complete_Technical_Specification.docx')
print("DOCX created successfully.")
