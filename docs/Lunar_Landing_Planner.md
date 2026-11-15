Lunar Landing Planner
Complete Project Report, Technical Design & Competition Proposal








svs.gsfc.nasa.gov


Project category: Space technology · Scientific visualization · Mission planning · Interactive web application

This report is designed to serve three purposes: a school project you can explain confidently, a competition submission that communicates the project's value, and a practical technical blueprint you can use to build the actual application.

The central idea is to help mission planners, researchers, educators, and the public compare potential lunar landing locations and dates through an intuitive visual interface rather than complicated scientific tools.
1. Executive summary
The Moon's south pole is a promising destination for future exploration, but selecting a landing site is difficult. The Sun can remain very low above the horizon, crater rims can cast long shadows, and Earth's visibility can change with the location and lunar geometry. These factors affect solar power generation, communication opportunities, and the feasibility of surface operations.

The Lunar Landing Planner is a web-based decision-support application that lets users select a landing site and date, visualize the Sun and Earth relative to the local horizon, and compare environmental conditions across candidate sites.

The application will combine astronomical calculations, scientific datasets where available, interactive maps, and a three-dimensional lunar horizon visualization. Its goal is to make complex information understandable without sacrificing scientific accuracy.
The project's core question

Which candidate lunar landing site and date provide the most favorable combination of sunlight, Earth visibility, and operational conditions?

The application should support comparisons rather than automatically declaring one site universally best. The best location depends on mission priorities, hardware constraints, scientific objectives, and acceptable risk.
2. Problem statement
Future lunar south-pole missions face several interconnected challenges.
- Low-angle sunlight: The Sun may skim the horizon, and nearby terrain can block direct illumination.
- Variable power availability: Solar-powered equipment needs to know when sunlight is available and when shadows may interrupt generation.
- Earth visibility: A lander may have a clear or obstructed line of sight to Earth depending on terrain and geometry.
- Complex scientific interfaces: Mission data can be difficult for non-specialists to interpret and compare.
- Date-dependent conditions: Illumination and visibility evolve over time, so a promising location may not be equally suitable on every date.
Proposed solution
Build one interactive interface that brings these factors together. A user selects a candidate location and date, sees the Sun and Earth in relation to the local horizon, reviews calculated indicators, and compares the result with other sites.

The application is a planning aid, not a replacement for official mission analysis, high-fidelity terrain simulation, or safety certification.
3. Research background and scientific foundation
The project is grounded in real lunar exploration challenges rather than a fictional scenario.

NASA explains that the lunar south pole has an unusual lighting environment: the Sun remains close to the horizon, and nearby terrain creates long, moving shadows. Some elevated locations can receive extended sunlight, while deep craters may remain permanently shadowed. These conditions affect power, navigation, thermal management, and surface operations. 
NASA+1











3.1 Solar illumination

The amount of direct sunlight reaching a landing site changes with the Sun's position and the surrounding terrain. The application should calculate the Sun's elevation and azimuth, then estimate when terrain blocks sunlight.

Why it matters: Solar panels need direct illumination to generate power. Knowing only the Sun's position in the sky is insufficient if a crater rim blocks its rays.













3.2 Earth visibility

Earth must have an unobstructed line of sight for direct-to-Earth communication. The Earth's apparent position and the local horizon determine whether it is geometrically visible.

Why it matters: A site with favorable illumination might have limited communication windows. Both conditions must be considered together. 
Lunar Polar Illumination+1














3.3 Terrain and elevation

The lunar surface is rugged, with crater rims, slopes, ridges, and depressions. Elevation data helps determine the local horizon and whether a ray from the Sun or Earth is blocked.

Why it matters: A realistic planner must account for terrain, not just treat the Moon as a smooth sphere. NASA's Lunar Orbiter Laser Altimeter (LOLA) provides lunar topographic measurements used for mapping and landing-site analysis. 
NASA Science+1














3.4 Time-dependent conditions

A landing site must be evaluated over a time interval, not just at one instant. Hourly or finer samples can reveal illumination periods, communication gaps, and the longest continuous darkness interval.

Why it matters: A single snapshot can look favorable while concealing a long subsequent period without sunlight.



3.5 Existing scientific resources
The application should build on established data and methods rather than inventing its own astronomical reference values.
Resource	Purpose in the project
NASA Goddard's Planetary Geodesy and Geophysics Data Archive (PGDA)	Reference illumination and Earth-visibility products
Lunar Reconnaissance Orbiter (LRO) / LOLA	Lunar topography and elevation models
NASA/JPL SPICE system	Planetary geometry, ephemerides, coordinate transformations and observation calculations
NASA Scientific Visualization Studio	Reference visualizations of changing polar illumination

Sources: 
Lunar Polar Illumination+3


Useful starting points:
- NASA PGDA — Lunar Polar Illumination
- NASA — LOLA topography instrument
- NASA/JPL — SPICE Toolkit
- NASA — Illumination at the Moon's South Pole
Research conclusion: The project is feasible as an educational and preliminary mission-planning application. The main technical challenge is ensuring that its visualizations and calculations use consistent coordinate systems, reliable time-dependent geometry, and sufficiently detailed terrain data.
4. Project objectives
The project's goals should be specific enough to test.
1. Allow users to select and compare at least three candidate lunar landing sites.
2. Let users select a date and time or a defined mission-analysis period.
3. Display the Sun and Earth relative to the local horizon.
4. Estimate sunlight availability and direct Earth visibility over time.
5. Visualize terrain and shadowing in a two-dimensional map and/or a three-dimensional scene.
6. Present comparison metrics in a clear dashboard.
7. Explain the scientific meaning and uncertainty of every important metric.
8. Export results in a report or CSV format.
9. Provide a beginner-friendly interface suitable for students and the public.
10. Maintain a clear distinction between demonstration data, calculated estimates, and validated scientific data.
4.1 Intended users
- Mission planners and engineers: Compare environmental conditions at candidate sites.
- Researchers and students: Explore illumination and visibility patterns.
- Educators: Demonstrate lunar geometry and surface conditions.
- Public users: Understand why landing-site selection is difficult.
For the first version, prioritize students, educators, and competition judges. Build the more demanding scientific capabilities as the underlying calculations become validated.
5. Proposed application features










Feature A — Mission dashboard

The main screen summarizes the selected site, selected date, sunlight estimate, Earth-visibility estimate, longest darkness interval, and data quality.

Each metric should have a clear definition and a link or tooltip explaining its limitations.













Feature B — Interactive 3D horizon viewer

Show a lunar terrain scene, the local horizon, a Sun direction indicator, and an Earth direction indicator. Include camera rotation, zoom, labels, and a time slider.

The rendering must communicate when an object is below the local terrain horizon, not merely below an arbitrary screen line.













Feature C — Landing-site comparison

Display candidate sites on a map and compare their coordinates, terrain conditions, estimated illumination, Earth visibility, and longest darkness interval.

Users should be able to select the metrics most important to their mission rather than rely on a single universal ranking.













Feature D — Timeline and time controls

Let users move through time, play or pause an animation, and inspect illumination and Earth visibility on a shared timeline.

Show transitions, visibility gaps, and continuous sunlight intervals where the available data supports them.













Feature E — Exportable analysis

Generate a concise report containing the selected site, coordinates, time range, assumptions, data sources, comparison charts, and calculated metrics. Offer CSV export for the underlying time series.



5.1 Feature prioritization
Priority	Features
Must have	Site selection, date/time controls, Sun/Earth visualization, basic metrics, site comparison
Should have	Terrain-aware shadow estimation, time-series charts, CSV export, source attribution
Could have	Multiple terrain resolutions, saved scenarios, downloadable PDF reports, adjustable mission priorities
Future research	Detailed thermal models, solar-panel orientation, radio-link budgets, landing safety analysis

The first working prototype should do a small number of things correctly rather than display many impressive but scientifically unsupported numbers.
6. Application design and user interface
The interface should feel like a professional space-mission analysis tool: dark background, high-contrast typography, restrained blue highlights, clear scientific charts, and a prominent lunar visualization.
6.1 Main screen layout

LUNAR / PLANNER
SOUTH POLE MISSION ANALYSIS

Concept UI


SELECTED SITE
Site Alpha
Demo location


MISSION DATE
Configurable
Date and time selector


SUN ELEVATION
— °
Awaiting calculation


EARTH VISIBILITY
—
Awaiting calculation



Local Horizon Viewer










esa.int


Illustrative scene only — not a calculated result for a real landing site.
Mission timeline

Play / Pause / Step




Compare candidate sites

Site Alpha · Site Beta · Site Gamma

All labels, readings and sites shown here are design placeholders. The real application must calculate or load actual data.

This is a layout concept, not a live scientific simulation. The production application should replace the placeholders with actual calculations and clearly identified data.
6.2 Main pages
1. Dashboard: Mission overview and key metrics.
2. Explore: Interactive lunar map, site selection and local horizon viewer.
3. Compare: Side-by-side site metrics and charts.
4. Timeline: Sunlight and Earth-visibility conditions over the selected period.
5. Reports: Export results, assumptions and source information.
6. About the science: Definitions, calculation methods, uncertainties and educational explanations.
6.3 Interaction design
A user should be able to complete the primary workflow in a few steps:
1. Select a landing site or enter its lunar coordinates.
2. Select the mission date and analysis duration.
3. View the Sun and Earth in the local horizon display.
4. Inspect illumination and visibility over time.
5. Add other sites to a comparison.
6. Export a report with all assumptions and data provenance.
The interface must never imply that a decorative animation is a real calculation. A clearly labeled demonstration mode can be used while scientific data integration is being developed.
7. Scientific calculations and algorithms
This is the most important technical part of the project. The quality of the planner depends on how accurately it converts astronomical geometry and terrain data into understandable results.
7.1 Solar elevation and azimuth
For each site and time, determine the Sun's direction in a local coordinate system.
- Elevation: Angular height above the local horizontal plane.
- Azimuth: Horizontal direction of the Sun, measured according to a documented convention.
- Local horizon: The actual terrain skyline surrounding the site.
A Sun elevation of zero degrees means the Sun's center lies on the ideal local horizontal plane. It does not, by itself, establish whether the Sun is visible above the terrain.

For a simplified spherical-body calculation, solar elevation \(h\) can be obtained from the observer's latitude \(\phi\), the Sun's declination \(\delta\), and the local hour angle \(H\):
\[
\sin h=\sin\phi\sin\delta+
\cos\phi\cos\delta\cos H
\]

This equation is useful for teaching the underlying geometry. However, an accurate lunar south-pole implementation must account for the Moon's orientation, the observer's lunar coordinates, the Sun's time-dependent position, and the selected reference frame. A validated ephemeris or equivalent geometric model is preferable.
7.2 Terrain-aware sunlight availability
A reliable calculation requires more than the Sun's elevation.

For every time step:
1. Compute the direction from the landing site toward the Sun.
2. Inspect the terrain along that direction using a digital elevation model (DEM).
3. Determine whether a ridge or crater wall blocks the ray.
4. Record whether direct sunlight reaches the site.
5. Repeat throughout the selected time range.
The simplest binary model records a value \(I(t)\):
\[
I(t)=
\begin{cases}
1,&\text{direct sunlight reaches the site}\\
0,&\text{the Sun is blocked}
\end{cases}
\]

For \(N\) equally spaced samples, an estimated illumination fraction is:
\[
P_{\mathrm{sun}}=
\frac{\sum_{i=1}^{N} I(t_i)}{N}\times100\%
\]

This is an approximation over the chosen sampling period. The time step, terrain resolution, uncertainty, and treatment of grazing sunlight must be documented.
7.3 Earth visibility
Calculate the apparent direction and angular size of Earth from the landing site, then compare that direction with the local terrain horizon.

For each sample, store a visibility indicator \(E(t)\):
\[
E(t)=
\begin{cases}
1,&\text{Earth is geometrically visible}\\
0,&\text{Earth is fully blocked}
\end{cases}
\]

The Earth-visibility fraction is then:
\[
P_{\mathrm{Earth}}=
\frac{\sum_{i=1}^{N} E(t_i)}{N}\times100\%
\]

This metric is geometric visibility, not a guarantee of a usable radio link. Actual communications depend on antennas, spacecraft orientation, link budget, receiver performance, terrain clearance, and network availability. Some reference products count Earth as visible if any part of its apparent disc is unobstructed, which may be optimistic for communication planning. 
Lunar Polar Illumination+1

7.4 Continuous darkness and communication gaps
A useful planner should report more than average percentages.

For example, identify:
- The longest continuous interval without direct sunlight.
- The longest interval when Earth is geometrically obscured.
- The number and duration of sunlight windows.
- The number and duration of Earth-visibility windows.
- Periods when both sunlight and Earth visibility occur simultaneously.
These metrics can be calculated by processing the time series and grouping consecutive samples with the same state.

Important: The output resolution cannot be finer than the underlying time sampling and model accuracy justify.
7.5 Optional multi-criteria ranking
The system can provide a configurable comparison score, but it should not present this score as an established NASA ranking.

A simple educational example is:
\[
S=w_sP_{\mathrm{sun}}+
w_eP_{\mathrm{Earth}}+
w_tT_{\mathrm{terrain}}
\]

Where:
- \(P_{\mathrm{sun}}\) is the illumination percentage, scaled from 0 to 100.
- \(P_{\mathrm{Earth}}\) is the geometric Earth-visibility percentage, scaled from 0 to 100.
- \(T_{\mathrm{terrain}}\) is a documented terrain-suitability score from 0 to 100.
- \(w_s,w_e,w_t\) are user-selected weights that sum to 1.
For example, a mission emphasizing solar power could assign more weight to illumination, whereas a mission dependent on direct-to-Earth communication could prioritize Earth visibility.

Terrain suitability must be based on an explicitly defined method and reliable inputs. If those inputs are unavailable, omit the terrain score rather than invent it.

A single weighted score can hide important trade-offs. Therefore, always show the underlying metrics alongside the score, and do not use this educational score to certify a landing site.
8. Technical architecture
For the first version, use a browser-based frontend with a Python backend for scientific calculations. This separates the visual experience from the scientific engine and allows the calculations to be tested independently.
Frontend — React + TypeScript

Dashboard · Site selector · Charts · Date controls

API layer — FastAPI

Validate requests · Run analyses · Return results and metadata

Geometry engine

Time conversion, ephemerides, coordinate transformations


Terrain engine

Elevation data, horizon profiles, shadow calculations



Scientific data and storage

Terrain datasets · Ephemeris files · Cached results · Saved scenarios


8.1 Recommended technology stack
Component	Recommended technology	Reason
User interface	React + TypeScript	Reusable components and maintainable code
Styling	CSS or Tailwind CSS	Responsive scientific dashboard
3D visualization	Three.js	Interactive lunar terrain and sky visualization
Charts	Plotly or Recharts	Time-series and comparison graphs
Backend	Python + FastAPI	Scientific computation and API endpoints
Geometry	NASA/JPL SPICE or validated equivalent	Astronomical geometry and coordinate calculations
Scientific data	NASA PGDA and appropriate LRO products	Illumination references and lunar terrain
Storage	Local files initially; PostgreSQL later if needed	Scenarios, metadata and persistent records
Testing	Pytest, Vitest and Playwright	Scientific, component and end-to-end tests
Deployment	Static frontend hosting plus a Python-capable backend	Independent deployment and scaling

You do not need to implement every component immediately. Begin with a working frontend and a small, reproducible calculation pipeline, then add high-resolution terrain and more sophisticated models.
8.2 Suggested project structure
lunar-landing-planner/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── HorizonViewer.tsx
│   │   │   ├── SiteSelector.tsx
│   │   │   ├── Timeline.tsx
│   │   │   └── ComparisonTable.tsx
│   │   ├── pages/
│   │   ├── services/
│   │   ├── types/
│   │   └── App.tsx
│   └── package.json
├── backend/
│   ├── api/
│   ├── science/
│   │   ├── geometry.py
│   │   ├── illumination.py
│   │   ├── visibility.py
│   │   └── metrics.py
│   ├── data/
│   ├── tests/
│   └── main.py
├── docs/
│   ├── methodology.md
│   └── data_sources.md
└── README.md


This is a proposed structure; the actual repository can be simplified for the prototype.
8.3 API design
The frontend should request calculations from the backend rather than independently reimplementing the scientific logic in several places.
Endpoint	Purpose
GET /api/sites	Return available candidate sites and their metadata
GET /api/sites/{id}	Return the coordinates and details of a site
POST /api/analysis	Calculate metrics for a site and time interval
POST /api/compare	Compare multiple sites under consistent assumptions
GET /api/analysis/{id}	Retrieve a saved analysis, if persistence is implemented
GET /api/health	Check whether the backend is running

A sample request to /api/analysis could be:
{
  "site_id": "demo-alpha",
  "start_time": "2027-01-01T00:00:00Z",
  "duration_hours": 168,
  "step_minutes": 60,
  "mode": "demonstration"
}


The site ID and date are illustrative. The response should include the actual calculation method, time system, dataset identifiers, resolution, sampling interval, uncertainty notes, and whether the output is simulated or scientifically computed.
8.4 Data provenance
Every result should have a traceable origin.

Store at least:
- Dataset name, version and source.
- Data retrieval date.
- Coordinate reference frame and units.
- Time standard and conversion method.
- Terrain resolution and interpolation method.
- Algorithm version and sampling interval.
- Known uncertainties and limitations.
This is essential for a scientific application: users need to know not just what a number is, but how it was obtained.
9. AI coding prompt for building the application
The following prompt is designed for an AI coding agent. It instructs the agent to build the project in stages, distinguish real science from mock data, and produce testable software rather than just an attractive interface.
Build a Complete Lunar Landing Planner — Scientific Web Application
Role
Act as a senior full-stack engineer, scientific software developer, 3D visualization specialist, and UI/UX designer. Build a complete, maintainable web application called Lunar Landing Planner.

The application must help mission planners, educators, students, and the public compare candidate lunar south-pole landing sites and dates by visualizing solar geometry, terrain-dependent illumination, Earth visibility, and time-dependent operating conditions.

Do not merely produce a landing-page mockup. Implement a functioning application with a documented scientific methodology, tested calculations, interactive visualizations, and a clear distinction between real scientific results and demonstration data.
1. Technology stack
Use:
- React and TypeScript for the frontend.
- Modern CSS or Tailwind CSS for responsive styling.
- Three.js for the interactive lunar terrain and horizon visualization.
- Plotly or Recharts for scientific charts.
- Python and FastAPI for the backend.
- Pytest for backend testing.
- Vitest and Playwright for frontend and end-to-end testing where appropriate.
Use a modular architecture. Do not put the entire application in one component or one source file.
2. Design requirements
Create a professional mission-analysis interface inspired by scientific visualization and aerospace mission-control software.

Design direction:
- Dark charcoal and deep navy backgrounds.
- Restrained cyan or blue highlights.
- High-contrast, readable typography.
- Clear spacing and responsive layouts.
- Subtle transitions that do not interfere with scientific interpretation.
- Accessible controls, labels, keyboard navigation, and status messages.
Include these pages:
1. Mission dashboard.
2. Landing-site explorer.
3. Interactive 3D horizon viewer.
4. Site comparison workspace.
5. Illumination and Earth-visibility timeline.
6. Exportable reports.
7. Scientific methodology and data-source documentation.
Avoid excessive decorative effects. Scientific readability is more important than visual spectacle.
3. Dashboard
Display:
- Selected candidate landing site.
- Latitude, longitude, and coordinate reference frame.
- Selected date and analysis period.
- Solar elevation and azimuth at the selected time.
- Estimated direct-sunlight fraction over the selected interval.
- Estimated Earth-visibility fraction over the selected interval.
- Longest continuous darkness interval.
- Longest geometric Earth-visibility gap.
- Terrain and data-quality information.
- A clear indication of whether each result is measured, calculated, estimated, or simulated.
Never hardcode fake scientific metrics into the production dashboard.
4. Interactive lunar visualization
Use Three.js to build a navigable 3D scene with:
- Lunar terrain or a clearly labeled placeholder terrain model.
- A local horizon reference.
- A Sun direction indicator.
- An Earth direction indicator.
- Camera rotation, zoom, and reset controls.
- A date/time control connected to the scientific calculation pipeline.
- Play, pause, and step-through-time controls.
- Labels showing relevant angular measurements.
- A visible distinction between the terrain horizon and an ideal flat horizon.
If authentic terrain data is unavailable, use a procedural demonstration terrain and clearly label it as synthetic. Do not present synthetic terrain as an accurate model of a real lunar landing site.

Make the visualization reflect the calculated geometry. Do not move the Sun or Earth randomly or use arbitrary animations to imitate scientific calculations.
5. Candidate landing sites
Implement a site registry containing:
- Stable site ID.
- Site name.
- Latitude and longitude.
- Coordinate reference frame.
- Elevation, only when supported by a cited dataset.
- Data source and metadata.
- Available terrain data and resolution.
- Calculation status.
Allow users to add, remove, and compare candidate sites.

Do not invent coordinates, elevations, NASA rankings, or mission suitability claims. Any demonstration locations must be explicitly marked as examples.
6. Scientific calculation engine
Implement a separate Python science module.

Required capabilities:
- Convert timestamps into the time systems required by the chosen ephemeris.
- Calculate the Sun's direction relative to the selected lunar surface location.
- Calculate Earth direction and apparent angular size where the data permits.
- Transform coordinates into a documented local reference frame.
- Calculate solar elevation and azimuth.
- Estimate terrain-dependent sunlight using a digital elevation model and horizon or ray-intersection analysis.
- Estimate geometric Earth visibility against the local terrain horizon.
- Calculate time-series illumination and Earth-visibility fractions.
- Identify continuous sunlight periods, darkness intervals, and Earth-visibility gaps.
- Calculate simultaneous sunlight and geometric Earth visibility.
- Record sampling intervals, data provenance, uncertainty, and limitations.
Use NASA/JPL SPICE or another validated astronomical geometry method where practical. Document all assumptions and coordinate transformations.

Do not rely on a simplified spherical astronomical formula as the final high-fidelity lunar polar model.

If scientific dependencies or terrain datasets are not available, implement a clearly separated demonstration mode. Never silently substitute mock data for scientific results.
7. Scientific definitions
Define the following metrics precisely:
- Solar elevation and azimuth.
- Direct sunlight at the site.
- Illumination fraction over a selected interval.
- Geometric Earth visibility.
- Earth-visibility fraction.
- Longest continuous darkness interval.
- Longest Earth-visibility gap.
- Simultaneous sunlight and Earth visibility.
- Terrain resolution and uncertainty.
Distinguish geometric Earth visibility from actual communication availability. Do not claim to calculate a communications link budget unless antenna characteristics, spacecraft orientation, transmission parameters, and relevant infrastructure are modeled.
8. Site comparison
Provide a comparison table and charts for:
- Solar illumination fraction.
- Earth-visibility fraction.
- Longest darkness interval.
- Longest geometric Earth-visibility gap.
- Relevant terrain characteristics.
- Data completeness and uncertainty.
Support consistent analysis periods and time steps across sites.

Optionally implement a user-configurable weighted score. Explain the formula, normalization, weights, and limitations. Always display the underlying metrics and do not represent an educational score as an official mission ranking.
9. Timeline and charts
Build interactive time-series charts that:
- Display sunlight and Earth visibility on a common timeline.
- Support hover tooltips and time selection.
- Show transitions between visible and blocked states.
- Synchronize with the 3D viewer.
- Explain missing data and sampling resolution.
Avoid interpolating over long missing-data intervals without marking the uncertainty.
10. Backend API
Implement:
- GET /api/health
- GET /api/sites
- GET /api/sites/{id}
- POST /api/analysis
- POST /api/compare
Validate incoming coordinates, timestamps, durations, time steps, and site IDs.

Return structured JSON with metrics, time-series data, provenance, calculation mode, and warnings.

Use clear error responses and prevent invalid requests from crashing the application.
11. Export features
Implement:
- CSV export for time-series data.
- A printable analysis report.
- PDF export if practical.
- A comparison summary with site coordinates, analysis period, methodology, sources, and limitations.
Every exported report must retain the distinction between demonstration data and validated scientific calculations.
12. Data integration
Investigate relevant public resources, including:
- NASA PGDA lunar illumination and Earth-visibility products.
- Lunar Reconnaissance Orbiter LOLA terrain data.
- NASA/JPL SPICE documentation and appropriate ephemeris kernels.
- Other authoritative NASA or Planetary Data System datasets when necessary.
Document download procedures, licensing, coordinate systems, data versions, and processing requirements.

Do not claim that an API, dataset, or scientific computation works until it has been implemented and tested. Do not fabricate citations or pretend that inaccessible datasets have been downloaded.
13. Testing and validation
Write tests for:
- Coordinate transformations.
- Time conversions.
- Solar direction calculations.
- Terrain horizon intersection.
- Earth visibility.
- Illumination fractions.
- Continuous darkness and visibility-gap calculations.
- Invalid inputs and missing datasets.
- API response structure.
- Synchronization between timeline and 3D scene.
Compare results against appropriate authoritative reference products or independently validated calculations. Document tolerances and known limitations.

Include at least one reproducible reference case and explain how it was validated.
14. Performance and accessibility
- Avoid blocking the user interface during lengthy computations.
- Cache reusable results with dataset and algorithm version identifiers.
- Allow users to select a reasonable time step.
- Handle missing terrain tiles gracefully.
- Dispose of Three.js resources correctly.
- Support desktop and tablet layouts, with mobile-friendly controls.
- Provide accessible labels, keyboard navigation, and reduced-motion support.
15. Deliverables
Produce:
1. Complete frontend source code.
2. Complete backend source code.
3. Requirements and dependency manifests.
4. Environment-variable example file with no secrets.
5. Setup and launch instructions.
6. README with architecture and feature documentation.
7. Scientific methodology document.
8. Data-source and attribution document.
9. Automated tests.
10. Sample demonstration dataset clearly marked as synthetic if required.
11. Known limitations and future-development roadmap.
16. Development workflow
Work in stages:

Stage A: Inspect the existing repository and document the current structure.

Stage B: Create the interface and navigation with explicit demonstration data.

Stage C: Implement the backend API and data models.

Stage D: Implement and test astronomical geometry.

Stage E: Integrate real terrain data and horizon calculations.

Stage F: Connect the scientific engine to the dashboard, timeline, and 3D visualization.

Stage G: Implement comparisons, CSV/PDF exports, and provenance reporting.

Stage H: Run automated tests, fix errors, and provide reproducible launch instructions.

After each stage, report what is implemented, what has been tested, what remains incomplete, and what scientific assumptions are being used.

Do not claim completion when important features are only placeholders.
Final acceptance criteria
The finished application must allow a user to select a candidate site and analysis period, inspect the Sun and Earth relative to the local horizon, review time-dependent illumination and geometric Earth visibility, compare multiple sites, and export an analysis with transparent data sources and limitations.

The application must remain scientifically honest, modular, testable, responsive, and understandable to both technical and non-technical users.



How to use the prompt
1. Open your preferred AI coding environment and create a project repository.
2. Give the coding agent the prompt above.
3. Ask it to inspect its environment and implement Stage A first, rather than attempting every feature in one generation.
4. Run the application and tests after each stage.
5. Do not treat a beautiful 3D scene as proof that the astronomical calculations are correct.
For a competition prototype, the strongest strategy is to demonstrate one complete, verified workflow first and then extend it.
10. Development roadmap
A practical development plan should prioritize a working, testable prototype before advanced scientific features.
Phase 1
Days 1–3

Project foundation

Create the repository, frontend, backend, dashboard, navigation and site-selection interface. Use explicitly labeled demonstration data.

Deliverable: navigable application shell.



Phase 2
Days 4–7

Astronomical calculations

Implement coordinate handling, time conversion and solar geometry. Establish a reproducible reference case and test the results.

Deliverable: tested geometry calculations.



Phase 3
Days 8–12

Terrain and visualization

Integrate a suitable terrain dataset, build the local horizon viewer, and calculate terrain-dependent sunlight and geometric Earth visibility.

Deliverable: connected visualization and scientific engine.



Phase 4
Days 13–16

Comparison and reports

Add shared timelines, site comparisons, metric explanations and CSV export.

Deliverable: complete user workflow.



Phase 5
Days 17–21

Validation and presentation

Test the calculations against appropriate reference products, fix interface issues, document uncertainties, and prepare the demonstration.

Deliverable: competition-ready prototype with documented limitations.



These are estimated development durations, not guarantees. Real terrain integration and validation may take longer than interface development, especially if you are learning the scientific tools as you build.
11. Testing and success criteria
The application needs two kinds of testing: software testing and scientific validation.
Test	Expected result
Invalid coordinates	The API rejects them with a clear error
Change the selected date	The displayed geometry and timeline update
Terrain blocks the Sun	The site is not incorrectly marked as directly illuminated
Terrain blocks Earth	Geometric visibility reflects the obstruction
Compare sites	All sites use consistent analysis periods and definitions
Missing terrain data	The application displays a warning instead of inventing a result
Export a report	Coordinates, dates, metrics, sources and assumptions are included
Change the sampling interval	Metrics are recalculated, and resolution is disclosed
Reload a saved analysis	Results retain their calculation and dataset versions

How will you know the project is successful?
- A new user can compare two sites without technical assistance.
- Every important metric has a clear definition.
- The time slider, charts and 3D viewer remain synchronized.
- At least one scientific calculation has been checked against an appropriate reference.
- The application distinguishes actual data from mock data.
- Results are reproducible for the same inputs, dataset and software version.
Do not claim a numerical accuracy percentage until you have performed a defined validation study and reported the measured error.
12. Risks and limitations
A strong report acknowledges what the system cannot yet do.
Terrain resolution

Coarse elevation data can miss small ridges and local shadows. State the resolution and avoid claiming that a regional terrain model proves a precise landing spot is safe.


Coordinate and time errors

Inconsistent reference frames, time standards, or lunar orientation assumptions can produce incorrect Sun and Earth positions. Validate conversions and document conventions.


Simplified communications model

Geometric Earth visibility does not establish that a reliable communication link exists. A real link analysis needs additional engineering parameters.


Performance

High-resolution terrain and fine time steps can be computationally expensive. Cache results, limit the initial analysis area and disclose sampling intervals.


Decision-making

Illumination and Earth visibility are only part of landing-site selection. Slope, rocks, navigation, thermal conditions, scientific value and mission-specific safety requirements also matter.



13. Competition submission summary
Project Title
Lunar Landing Planner: An Interactive Tool for Comparing Lunar South-Pole Landing Sites
Abstract
Future lunar south-pole missions face challenging lighting conditions, rugged terrain and time-dependent communication constraints. Evaluating candidate landing locations requires understanding both the position of the Sun and the visibility of Earth relative to the local terrain horizon.

Lunar Landing Planner is a proposed interactive web application that combines astronomical geometry, lunar topography, time-series analysis and three-dimensional scientific visualization to help users compare candidate landing sites and mission dates. Its primary features include an interactive horizon viewer, terrain-aware sunlight estimation, geometric Earth-visibility analysis, site-comparison dashboards and exportable reports.

The project aims to make lunar mission-planning information easier to explore and understand while maintaining transparency about data sources, calculation methods and uncertainty. NASA lunar terrain and illumination resources, together with validated planetary geometry methods, provide a foundation for the scientific engine.

The initial implementation will focus on a reproducible, educational prototype. More advanced terrain analysis and operational models can be introduced as the scientific calculations are validated. The application is intended as a decision-support and educational tool rather than a substitute for professional flight-planning or landing-safety systems.
Expected impact
The project can improve access to lunar environmental analysis for students, educators and early-stage researchers. By placing time-dependent illumination, Earth visibility and site comparison in one interface, it can help users understand the trade-offs involved in planning future lunar exploration.
Innovation
The proposed contribution is the integration of scientific geometry, terrain-aware visualization, temporal comparison and accessible explanations into one workflow. Its value lies not merely in displaying the Moon in 3D, but in connecting that visualization to transparent, testable calculations.



This is a proposed project description. Once you have implemented and tested the application, revise the abstract to distinguish completed features from planned features.
14. How to explain the project during judging
Here are the concepts you should be able to explain in your own words.
Q1. What problem are you solving?

The south pole has difficult lighting conditions and terrain that can block sunlight and Earth visibility. Our application makes it easier to compare locations and dates using a unified visual interface.

Q2. Why is the south pole important?

It is a major target for future lunar exploration. Some areas may offer extended sunlight, while permanently shadowed regions are scientifically interesting. The terrain and lighting create difficult engineering trade-offs.

Q3. Why not simply use a normal map?

A map shows where a location is, but it does not automatically explain how sunlight and Earth visibility change over time or how nearby terrain obstructs the local horizon. Our application connects those factors.

Q4. Where does the data come from?

The proposed implementation uses authoritative lunar topography and illumination resources, with a validated geometry method for calculating time-dependent Sun and Earth positions. The application records its sources and clearly labels any demonstration data.

Q5. What is the most difficult part?

Producing scientifically correct terrain-dependent results. Rendering the Moon is relatively straightforward; calculating accurate illumination and visibility requires suitable data, coordinate transformations, time handling and validation.

Q6. What makes this project useful?

It connects calculations that are otherwise difficult to interpret with an interactive interface that supports exploration, comparison and explanation. It is designed to help users understand the evidence, not hide it behind a score.

Q7. Does your system decide where a spacecraft should land?

No. It supports preliminary comparisons of selected environmental conditions. Real landing decisions require much more detailed engineering, safety analysis and mission-specific constraints.


15. Final recommendations
Build the project in this order:
1. A clean dashboard and site selector.
2. A working Sun-position calculation.
3. A timeline that updates from real calculations.
4. A local horizon viewer with clearly labeled terrain.
5. Terrain-aware sunlight and Earth visibility.
6. Comparison, export and validation features.
The single most important principle: prioritize scientific correctness over visual complexity. A simple, verified calculation presented clearly is a stronger competition contribution than a beautiful simulation whose numbers are not trustworthy.
Research references
- NASA, The Lunar South Pole Region — lighting, terrain and permanently shadowed areas. 
  NASA
- NASA PGDA, Lunar Polar Illumination — illumination and Earth-visibility mapping. 
  Lunar Polar Illumination
- NASA, Lunar Orbiter Laser Altimeter (LOLA) — topographic measurement and mapping. 
  NASA Science
- NASA/JPL, SPICE Toolkit — planetary observation geometry and ephemeris-based calculations. 
  naif.jpl.nasa.gov+1
- NASA Scientific Visualization Studio, Illumination at the Moon's South Pole, 2023 to 2030. 
  NASA Scientific Visualization Studio
These sources provide a foundation for your research section. Cite the specific data products and methodology you actually use in the implemented application.