# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"Söka pass" (Isabelle) is a web application for searching and filtering fitness classes from Friskis & Svettis gyms in the Stockholm area. The app was developed as a pair programming experiment with ChatGPT4o in September 2024.

## Architecture

The application follows a simple client-side architecture with three main JavaScript modules:

- **index.js**: Main application logic with a 3x3 grid of filter buttons and dynamic table rendering
- **api.js**: Data fetching and transformation layer that interfaces with the Friskis & Svettis API
- **filter-settings.js**: Filter configuration interface for locations, activities, and instructors
- **gyms-data.js**: Static mapping of gym IDs to location names

## Key Components

### Filter System
The app uses a 3x3 grid of toggle buttons where:
- Buttons 1, 4, 7: Location filters
- Buttons 2, 5, 8: Activity filters  
- Buttons 3, 6, 9: Instructor filters

Button states and selected filter items are persisted in localStorage with keys like `checkedItems_button1`.

### Data Flow
1. **api.js** fetches data from `https://friskissvettis.brpsystems.com/brponline/api/ver3/businessunits/{id}/groupactivities`
2. Raw API data is transformed using `transformItem()` to format dates and extract relevant fields
3. **index.js** applies filters based on active button states and renders results in a table
4. Data is cached daily to minimize API calls

### Pages
- **index.html**: Main interface with filter buttons and results table
- **filter-settings.html**: Configuration page for selecting specific locations/activities/instructors
- **manual.html**: User documentation

## Development

This is a vanilla JavaScript application with no build process. Files can be served directly from a web server.

### Local Development
Serve the files using any web server, e.g.:
```bash
python -m http.server 8000
# or
npx serve .
```

### File Structure
- `/js/` - JavaScript modules (ES6 modules)
- `/css/` - Stylesheets 
- `/images/` - Documentation images
- Static HTML files in root

## API Integration

The app fetches data from Friskis & Svettis' public API. The `fetchData()` function in api.js handles:
- Daily cache invalidation
- Business unit ID mapping from gyms-data.js
- 13-day date range queries
- Data transformation for display