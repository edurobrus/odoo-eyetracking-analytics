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
        gazeStats: [],
        gazeXEvolution: [],   // Data for X evolution
        gazeYEvolution: [],   // Data for Y evolution data
        gazeHeatmap: [],      // Data for heatmap
        gazePointsScatter: [], // NEW: Data for scatter plot of gaze points
        // Date filter states
        dateFilter: {
            startDate: '',    // User selected start date
            endDate: '',      // User selected end date
        }
    });

    this.orm = useService('orm');

    onWillStart(async () => {
        this.state.title = 'Greetings Dashboard';
        
        // Load all analyses
        this.state.analyses = await this.loadAnalyses();
        
        // Initialize date filters with sensible defaults (last month)
        const today = new Date();
        const lastMonth = new Date();
        lastMonth.setMonth(today.getMonth() - 1);
        
        this.state.dateFilter.startDate = this.formatDateForInput(lastMonth);
        this.state.dateFilter.endDate = this.formatDateForInput(today);
        
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
    
    // Load module counts for the selected analysis
    this.state.countModules = await this.countGroupModules(this.state.currentAnalysisId);
    
    // Prepare evolution and heatmap data based on the loaded gaze stats
    this.state.gazeXEvolution = this.prepareGazeEvolution('x');
    this.state.gazeYEvolution = this.prepareGazeEvolution('y');
    this.state.gazeHeatmap = this.prepareGazeHeatmap();
    
    // NEW: Prepare scatter plot data for gaze points
    this.state.gazePointsScatter = this.prepareGazePointsScatter();
    
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

prepareGazeEvolution(coordinate) {
    // This function transforms gaze stats into a format suitable for the line chart
    // Showing the evolution of X or Y values over time
    if (!this.state.gazeStats || !this.state.gazeStats.length) {
        console.warn(`No gaze stats available for ${coordinate.toUpperCase()} evolution chart`);
        return [];
    }

    // Sort gaze points by timestamp
    const sortedPoints = [...this.state.gazeStats].sort((a, b) => a.timestamp - b.timestamp);
    
    // Transform into the format needed for the chart
    // Using the first 1000 points or all if less than 1000
    const pointsToShow = sortedPoints.slice(0, Math.min(sortedPoints.length, 1000));
    
    // Map to the format expected by the chart renderer
    return pointsToShow.map((point, index) => ({
        label: `Point ${index + 1}`,
        value: point[coordinate], // Either point.x or point.y depending on parameter
        timestamp: point.timestamp
    }));
}

// NEW: Function to prepare data for the scatter plot
prepareGazePointsScatter() {
    if (!this.state.gazeStats || !this.state.gazeStats.length) {
        console.warn('No gaze stats available for scatter plot');
        return [];
    }
    
    // We'll limit to 100 points to prevent overwhelming the chart
    const maxPoints = 1000;
    const pointsToUse = this.state.gazeStats.slice(0, Math.min(this.state.gazeStats.length, maxPoints));
    
    // Check if we have valid data
    if (pointsToUse.every(p => typeof p.x === 'undefined' || typeof p.y === 'undefined')) {
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
    return pointsToUse.map(point => ({
        x: point.x, 
        y: point.y,
        timestamp: point.timestamp // Keep timestamp in case we want to use it for tooltips
    }));
}

prepareGazeHeatmap() {
    // This function processes gaze points into a format suitable for a heatmap
    if (!this.state.gazeStats || !this.state.gazeStats.length) {
        console.warn('No gaze stats available for heatmap chart');
        return [];
    }

    // Create bins for the heatmap (dividing screen into grid)
    const gridSize = 10; // 10x10 grid
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
    if (this.state.gazeStats.length === 0 || 
        this.state.gazeStats.every(p => typeof p.x === 'undefined' || typeof p.y === 'undefined')) {
        console.log("Generating sample data for heatmap");
        // Create sample data with higher concentration in the center
        for (let i = 0; i < 200; i++) {
            // Generate points with bias towards center
            const centerBias = Math.random() < 0.7;
            let x, y;
            
            if (centerBias) {
                // 70% of points closer to center (3-7 range in 10x10 grid)
                x = Math.floor(3 + Math.random() * 4);
                y = Math.floor(3 + Math.random() * 4);
            } else {
                // 30% of points anywhere
                x = Math.floor(Math.random() * 10);
                y = Math.floor(Math.random() * 10);
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
        this.state.gazeStats.forEach(point => {
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
        this.state.gazeXEvolution = [];
        this.state.gazeYEvolution = [];
        this.state.gazeHeatmap = [];
        this.state.gazePointsScatter = []; // Clear scatter data as well
    }
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