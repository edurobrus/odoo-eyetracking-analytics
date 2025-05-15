/** @odoo-module **/

import { registry } from '@web/core/registry';
import { useService } from '@web/core/utils/hooks';
import { OwlChartRenderer } from './chart/chart_renderer';

const { Component, useState, onWillStart } = owl;

export class OwlGreetDashboard extends Component {
setup() {
    this.state = useState({
        title: '',
        information: [],
        countModules: [],
        analyses: [],         // All analyses from database
        filteredAnalyses: [], // Analyses filtered by date range
        currentAnalysisId: null,
        gazeStats: [],        // Raw gaze points data
        gazeXEvolution: [],   // Data for X evolution
        gazeYEvolution: [],   // Data for Y evolution data
        gazeHeatmap: [],      // Data for heatmap
        gazePointsScatter: [], // Data for scatter plot of gaze points
        totalPoints: 0,       // Total number of gaze points in current analysis
        // Date filter states
        dateFilter: {
            startDate: '',    // User selected start date
            endDate: '',      // User selected end date
        },
        // Point filter states - MODIFIED: removed visiblePoints 
        pointFilter: {
            startPoint: 0,    // Starting point index
            endPoint: 1000,   // Ending point index
        },
        // Heatmap grid size
        heatmapGridSize: 10,  // Default to 10x10
    });

    this.orm = useService('orm');

    onWillStart(async () => {
        this.state.title = 'Dashboard';
        
        // Load all analyses
        this.state.analyses = await this.loadAnalyses();
        
        // Initialize date filters with sensible defaults (last month to tomorrow)
        const today = new Date();
        const lastMonth = new Date();
        lastMonth.setMonth(today.getMonth() - 1);

        const tomorrow = new Date();
        tomorrow.setDate(today.getDate() + 1);

        this.state.dateFilter.startDate = this.formatDateForInput(lastMonth);
        this.state.dateFilter.endDate = this.formatDateForInput(tomorrow);

        
        // Apply initial filtering
        this.filterAnalysesByDateRange();
        
        // Set the first filtered analysis as default if available
        if (this.state.filteredAnalyses.length > 0) {
            this.state.currentAnalysisId = this.state.filteredAnalyses[0].id;
        }
        
        // Load data for the selected analysis
        await this.loadAnalysisData();
        
        // Populate information with static data or relevant dynamic data
        this.state.information = [
            {
                id: 1,
                description: 'Eyetracking Analysis Platform',
                website: 'https://example.com',
                author: 'Your Name',
            },
        ];
    });
}

// Format date for input element (YYYY-MM-DD)
formatDateForInput(date) {
    return date.toISOString().split('T')[0];
}

// Parse date from input to Date object
parseInputDate(dateStr) {
    if (!dateStr) return null;
    return new Date(dateStr);
}

// Filter analyses based on date range
filterAnalysesByDateRange() {
    if (!this.state.analyses || this.state.analyses.length === 0) {
        this.state.filteredAnalyses = [];
        return;
    }
    
    const startDate = this.parseInputDate(this.state.dateFilter.startDate);
    const endDate = this.parseInputDate(this.state.dateFilter.endDate);
    
    // If no date filter is set, show all analyses
    if (!startDate && !endDate) {
        this.state.filteredAnalyses = [...this.state.analyses];
        return;
    }
    
    // Filter analyses where:
    // - analysis start date is before or equal to filter end date AND
    // - analysis end date is after or equal to filter start date
    this.state.filteredAnalyses = this.state.analyses.filter(analysis => {
        const analysisStartDate = this.parseInputDate(analysis.date_start);
        const analysisEndDate = this.parseInputDate(analysis.date_end);
        
        // Handle missing dates in analysis data (show them by default)
        if (!analysisStartDate || !analysisEndDate) return true;
        
        // For start date filter: if we have a filter start date, analysis end date must be >= filter start date
        const passesStartFilter = !startDate || analysisEndDate >= startDate;
        
        // For end date filter: if we have a filter end date, analysis start date must be <= filter end date
        const passesEndFilter = !endDate || analysisStartDate <= endDate;
        
        return passesStartFilter && passesEndFilter;
    });
    
    console.log(`Filtered ${this.state.filteredAnalyses.length} analyses from ${this.state.analyses.length} total`);
}

async loadAnalyses() {
    return await this.orm.searchRead(
        'eyetracking.analysis',
        [],
        ['name', 'date_start', 'date_end']
    );
}

async loadAnalysisData() {
    // Only load data if an analysis is selected
    if (!this.state.currentAnalysisId) {
        console.log('No analysis selected, skipping data load');
        return;
    }
    
    // Load gaze stats for the selected analysis
    this.state.gazeStats = await this.loadGazeStats(this.state.currentAnalysisId);
    
    // Store total number of points for filtering UI
    this.state.totalPoints = this.state.gazeStats.length;
    
    // Update point filter end value to match total points if needed
    if (this.state.pointFilter.endPoint > this.state.totalPoints) {
        this.state.pointFilter.endPoint = this.state.totalPoints;
    }
    
    // Load module counts for the selected analysis
    this.state.countModules = await this.countGroupModules(this.state.currentAnalysisId);
    
    // Apply point filtering and prepare chart data
    this.applyFilters();
    
    console.log('Loaded data for analysis ID:', this.state.currentAnalysisId);
    console.log('Gaze stats count:', this.state.gazeStats.length);
    console.log('Module counts:', this.state.countModules);
}

async loadGazeStats(analysisId) {
    // Load gaze stats for the specific analysis
    return await this.orm.searchRead(
        'eyetracking.gaze.point',
        [['analysis_id', '=', analysisId]],
        ['x', 'y', 'timestamp']
    );
}

async countGroupModules(analysisId) {
    try {
        const result = await this.orm.readGroup(
            'eyetracking.gaze.point',
            [['analysis_id', '=', analysisId]],
            ['analysis_id'],
            ['x'],
            {}
        );
        return result.length
            ? result.map(item => ({
                  analysis_id: item.analysis_id[0],
                  analysis_name: item.analysis_id[1] || 'Unnamed',
                  count: item.x,
              }))
            : [];
    } catch (error) {
        console.error("Error loading gaze points:", error);
        return [];
    }
}

// Apply all filters and update chart data
applyFilters() {
    // Prepare data for charts with all filters applied
    this.state.gazeXEvolution = this.prepareGazeEvolution('x');
    this.state.gazeYEvolution = this.prepareGazeEvolution('y');
    this.state.gazeHeatmap = this.prepareGazeHeatmap();
    this.state.gazePointsScatter = this.prepareGazePointsScatter();
    
    console.log('Filters applied:', {
        points: `${this.state.pointFilter.startPoint} to ${this.state.pointFilter.endPoint}`,
        heatmapGridSize: this.state.heatmapGridSize
    });
}

// Reset filters to default values
resetFilters() {
    this.state.pointFilter.startPoint = 0;
    this.state.pointFilter.endPoint = this.state.totalPoints;
    this.state.heatmapGridSize = 10;
    
    // Re-apply filters with defaults
    this.applyFilters();
}

// Get filtered gaze points based on point range
getFilteredGazePoints() {
    if (!this.state.gazeStats || this.state.gazeStats.length === 0) {
        return [];
    }
    
    // Sort gaze points by timestamp
    const sortedPoints = [...this.state.gazeStats].sort((a, b) => a.timestamp - b.timestamp);
    
    // Apply point range filter
    const start = Math.max(0, Math.min(this.state.pointFilter.startPoint, sortedPoints.length - 1));
    const end = Math.min(this.state.pointFilter.endPoint, sortedPoints.length);
    
    return sortedPoints.slice(start, end);
}

prepareGazeEvolution(coordinate) {
    // This function transforms gaze stats into a format suitable for the line chart
    // Showing the evolution of X or Y values over time
    const filteredPoints = this.getFilteredGazePoints();
    
    if (!filteredPoints || !filteredPoints.length) {
        console.warn(`No gaze stats available for ${coordinate.toUpperCase()} evolution chart`);
        return [];
    }

    // Map to the format expected by the chart renderer
    return filteredPoints.map((point, index) => ({
        label: `Point ${this.state.pointFilter.startPoint + index + 1}`,
        value: point[coordinate], // Either point.x or point.y depending on parameter
        timestamp: point.timestamp
    }));
}

// Function to prepare data for the scatter plot
prepareGazePointsScatter() {
    const filteredPoints = this.getFilteredGazePoints();
    
    if (!filteredPoints || !filteredPoints.length) {
        console.warn('No gaze stats available for scatter plot');
        return [];
    }
    
    // Check if we have valid data
    if (filteredPoints.every(p => typeof p.x === 'undefined' || typeof p.y === 'undefined')) {
        console.log("Generating sample data for scatter plot");
        
        // Create sample data with some clustering
        const sampleData = [];
        for (let i = 0; i < 50; i++) {
            const cluster = Math.floor(Math.random() * 3); // 3 clusters
            let x, y;
            
            switch (cluster) {
                case 0: // Top left cluster
                    x = Math.random() * 200;
                    y = Math.random() * 200;
                    break;
                case 1: // Middle cluster
                    x = 400 + Math.random() * 200;
                    y = 300 + Math.random() * 200;
                    break;
                case 2: // Bottom right cluster
                    x = 800 + Math.random() * 200;
                    y = 600 + Math.random() * 200;
                    break;
            }
            
            sampleData.push({ x, y });
        }
        
        return sampleData;
    }
    
    // Transform the data for scatter plot format
    // For scatter plot, we need {x, y} format directly
    return filteredPoints.map(point => ({
        x: point.x, 
        y: point.y,
        timestamp: point.timestamp // Keep timestamp in case we want to use it for tooltips
    }));
}

prepareGazeHeatmap() {
    // This function processes gaze points into a format suitable for a heatmap
    const filteredPoints = this.getFilteredGazePoints();
    
    if (!filteredPoints || !filteredPoints.length) {
        console.warn('No gaze stats available for heatmap chart');
        return [];
    }

    // Use dynamic grid size from state
    const gridSize = this.state.heatmapGridSize;
    const heatmapData = [];
    
    // Initialize the grid with zeros
    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            heatmapData.push({
                x: x,
                y: y,
                value: 0 // Will count points in this cell
            });
        }
    }
    
    // Assume x and y values are in range 0-1000 (adjust as needed for your data)
    const maxX = window.innerWidth;
    const maxY = window.innerHeight;
    
    // Generate some sample data if no real data exists
    // This ensures we have some visualization for testing
    if (filteredPoints.length === 0 || 
        filteredPoints.every(p => typeof p.x === 'undefined' || typeof p.y === 'undefined')) {
        console.log("Generating sample data for heatmap");
        // Create sample data with higher concentration in the center
        for (let i = 0; i < 200; i++) {
            // Generate points with bias towards center
            const centerBias = Math.random() < 0.7;
            let x, y;
            
            if (centerBias) {
                // 70% of points closer to center
                const centerOffset = Math.floor(gridSize / 3);
                x = Math.floor(centerOffset + Math.random() * (gridSize - 2 * centerOffset));
                y = Math.floor(centerOffset + Math.random() * (gridSize - 2 * centerOffset));
            } else {
                // 30% of points anywhere
                x = Math.floor(Math.random() * gridSize);
                y = Math.floor(Math.random() * gridSize);
            }
            
            // Find the corresponding cell in our data array
            const cellIndex = y * gridSize + x;
            if (cellIndex >= 0 && cellIndex < heatmapData.length) {
                heatmapData[cellIndex].value++;
            }
        }
    } else {
        // Process real data
        console.log("Processing real gaze data for heatmap");
        
        filteredPoints.forEach(point => {
            if (typeof point.x === 'number' && typeof point.y === 'number') {
                // Calculate which grid cell this point belongs to
                const gridX = Math.min(Math.floor(point.x / (maxX / gridSize)), gridSize - 1);
                const gridY = gridSize - 1 - Math.min(Math.floor(point.y / (maxY / gridSize)), gridSize - 1);
                
                // Find the corresponding cell in our data array
                const cellIndex = gridY * gridSize + gridX;
                if (cellIndex >= 0 && cellIndex < heatmapData.length) {
                    heatmapData[cellIndex].value++;
                }
            }
        });
    }
    
    // Log some stats to help debugging
    const nonZeroCells = heatmapData.filter(cell => cell.value > 0).length;
    const maxValue = Math.max(...heatmapData.map(cell => cell.value));
    console.log(`Heatmap stats: ${nonZeroCells}/${heatmapData.length} cells have data. Max value: ${maxValue}`);
    
    return heatmapData;
}

// Handler for the analysis selection change
async onAnalysisChange(ev) {
    const selectedAnalysisId = parseInt(ev.target.value);
    console.log('Analysis changed to:', selectedAnalysisId);
    
    if (selectedAnalysisId !== this.state.currentAnalysisId) {
        this.state.currentAnalysisId = selectedAnalysisId;
        await this.loadAnalysisData();
    }
}

// Handler for date filter changes
async onDateFilterChange(ev) {
    const { name, value } = ev.target;
    
    // Update the filter state
    this.state.dateFilter[name] = value;
    console.log(`Date filter ${name} changed to:`, value);
    
    // Apply filtering
    this.filterAnalysesByDateRange();
    
    // If current analysis is no longer in filtered list, select first available
    const currentAnalysisStillValid = this.state.filteredAnalyses.some(
        analysis => analysis.id === this.state.currentAnalysisId
    );
    
    if (!currentAnalysisStillValid && this.state.filteredAnalyses.length > 0) {
        // Select first analysis in filtered list
        this.state.currentAnalysisId = this.state.filteredAnalyses[0].id;
        console.log('Current analysis out of filter range, selecting new analysis:', this.state.currentAnalysisId);
        await this.loadAnalysisData();
    } else if (!currentAnalysisStillValid) {
        // No analyses in filter range
        this.state.currentAnalysisId = null;
        // Clear charts
        this.state.gazeStats = [];
        this.state.totalPoints = 0;
        this.resetFilters();
    }
}

// Handler for point filter changes
onPointFilterChange(ev) {
    const { name, value } = ev.target;
    const numValue = parseInt(value);
    
    // Update the filter state
    if (name === 'startPoint') {
        this.state.pointFilter.startPoint = Math.max(0, numValue);
        
        // Make sure endPoint is greater than startPoint
        if (this.state.pointFilter.endPoint <= this.state.pointFilter.startPoint) {
            this.state.pointFilter.endPoint = this.state.pointFilter.startPoint + 1;
        }
    } else if (name === 'endPoint') {
        // Make sure endPoint is at least startPoint + 1
        this.state.pointFilter.endPoint = Math.max(
            this.state.pointFilter.startPoint + 1, 
            Math.min(numValue, this.state.totalPoints)
        );
    }
    
    console.log(`Point filter ${name} changed to:`, numValue);
}

// Handler for heatmap grid size change
onHeatmapGridSizeChange(ev) {
    const numValue = parseInt(ev.target.value);
    this.state.heatmapGridSize = numValue;
    console.log('Heatmap grid size changed to:', numValue);
}

// Get the current analysis name for display
getCurrentAnalysisName() {
    if (!this.state.currentAnalysisId) return 'No analysis selected';
    
    const currentAnalysis = this.state.filteredAnalyses.find(
        analysis => analysis.id === this.state.currentAnalysisId
    );
    
    return currentAnalysis ? currentAnalysis.name : 'Unknown analysis';
}
}

OwlGreetDashboard.template = 'owl.OwlGreetDashboard';
OwlGreetDashboard.components = { OwlChartRenderer };

registry.category('actions').add('owl.greet_dashboard', OwlGreetDashboard);