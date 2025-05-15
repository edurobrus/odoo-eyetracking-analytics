/** @odoo-module **/
import {
    loadJS
} from '@web/core/assets'
const {
    Component,
    useState,
    onWillStart,
    useRef,
    onMounted,
    onPatched
} = owl

export class OwlChartRenderer extends Component {
    static template = 'owl.OwlChartRenderer';
    
    setup() {
        this.chartRef = useRef('chart')
        this.chart = null // Initialize chart variable
        this.chartPromise = null // Promise to track chart loading
        this.dataSignature = null // Track data changes
        
        this.state = useState({
            title: this.props.title,
            type: this.props.type,
            data: this.props.data,
            isLoading: true, // Add loading state
            error: null // Add error state
        })

        onWillStart(async () => {
            // Load Chart.js exactly once
            if (!window.chartJsPromise) {
                window.chartJsPromise = loadJS('https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js')
                    .catch(err => {
                        console.error('Failed to load Chart.js:', err)
                        this.state.error = 'Failed to load charting library'
                    })
            }
            
            this.chartPromise = window.chartJsPromise
            
            try {
                await this.chartPromise
                this.state.isLoading = false
            } catch (err) {
                console.error('Chart initialization error:', err)
                this.state.error = 'Chart initialization failed'
                this.state.isLoading = false
            }
        })

        onMounted(() => {
            // Use requestAnimationFrame for better performance
            if (!this.state.isLoading && !this.state.error) {
                requestAnimationFrame(() => {
                    this.renderChart()
                })
            }
        })
        
        // Optimize the patched handler to avoid redundant updates
        onPatched(() => {
            // Calculate signature to detect meaningful changes
            const newSignature = this.calculateDataSignature(this.props.data)
            
            if (this.dataSignature !== newSignature) {
                this.dataSignature = newSignature
                this.state.data = this.props.data
                
                // Use requestAnimationFrame for smoother updates
                requestAnimationFrame(() => {
                    this.renderChart()
                })
            }
        })
    }
    
    // Calculate a signature to detect if data has meaningfully changed
    calculateDataSignature(data) {
        if (!data || data.length === 0) return 'empty'
        
        // For large datasets, use a sampling approach
        if (data.length > 100) {
            // Sample some items from beginning, middle, and end
            const sampledData = [
                data[0],
                data[Math.floor(data.length / 2)],
                data[data.length - 1]
            ]
            return JSON.stringify(sampledData) + `-length:${data.length}`
        }
        
        // For smaller datasets, use full signature
        return JSON.stringify(data)
    }

    renderChart() {
        // Only render if we have an element and Chart.js is loaded
        if (!this.chartRef?.el || !window.Chart) {
            console.warn('Chart rendering skipped - missing element or Chart.js')
            return
        }
        
        // Clear any existing chart
        if (this.chart) {
            this.chart.destroy()
            this.chart = null
        }

        // Handle different chart types
        try {
            switch (this.state.type) {
                case 'heatmap':
                    this.renderHeatmap()
                    break
                case 'scatter':
                    this.renderScatterPlot()
                    break
                default:
                    this.renderDefaultChart()
                    break
            }
        } catch (err) {
            console.error('Error rendering chart:', err)
            this.displayErrorMessage(err.message)
        }
    }
    
    renderDefaultChart() {
        const labels = []
        const metrics = []
        
        // Skip rendering if no data
        if (!this.state.data || this.state.data.length === 0) {
            this.displayNoDataMessage()
            return
        }

        // Process data based on what's available
        if (this.state.type === 'line' && 'value' in this.state.data[0]) {
            // For gaze evolution data (X or Y)
            // Limit points to improve performance
            const maxPoints = 100
            const stride = this.state.data.length > maxPoints ? 
                Math.floor(this.state.data.length / maxPoints) : 1
            
            for (let i = 0; i < this.state.data.length; i += stride) {
                const item = this.state.data[i]
                labels.push(item.label || `Point ${i + 1}`)
                metrics.push(item.value)
            }
        } else {
            // For module count data
            this.state.data.forEach((item) => {
                labels.push(item.analysis_name || 'Unnamed')
                metrics.push(item.count)
            })
        }

        // Choose colors based on chart type
        let borderColor = 'rgb(75, 192, 192)'; // Default color
        
        if (this.state.title.includes('X')) {
            borderColor = 'rgb(54, 162, 235)'; // Blue for X coordinates
        } else if (this.state.title.includes('Y')) {
            borderColor = 'rgb(75, 192, 100)'; // Green for Y coordinates
        }
        
        this.chart = new Chart(this.chartRef.el, {
            type: this.state.type,
            data: {
                labels: labels,
                datasets: [{
                    label: this.state.title.replace(/'/g, ''),
                    data: metrics,
                    borderColor: this.state.type === 'line' ? borderColor : undefined,
                    backgroundColor: this.state.type === 'bar' ? 'rgba(54, 162, 235, 0.5)' : undefined,
                    borderWidth: this.state.type === 'line' ? 2 : 1,
                    tension: 0.2,
                    pointRadius: this.state.type === 'line' ? (metrics.length > 100 ? 0 : 3) : undefined,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: false
                    }
                },
                // Disable animations for better performance
                animation: metrics.length > 50 ? { duration: 0 } : { duration: 500 },
                interaction: {
                    mode: 'nearest',
                    intersect: false,
                },
                plugins: {
                    tooltip: {
                        enabled: true,
                        mode: 'index',
                        intersect: false,
                    },
                    legend: {
                        display: true,
                        position: 'top',
                    },
                },
                events: ['mousemove', 'mouseout', 'click', 'touchstart', 'touchmove'],
                hover: {
                    animationDuration: 0,
                }
            }
        })
    }
    
    // Optimized scatter plot renderer
    renderScatterPlot() {
        if (!this.state.data || !this.state.data.length) {
            this.displayNoDataMessage()
            return
        }
        
        // Find min/max values to set proper scales
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
        
        // For better performance with large datasets, sample points
        const sampleRate = this.state.data.length > 1000 ? 
            Math.ceil(this.state.data.length / 1000) : 1
        
        const sampledData = []
        for (let i = 0; i < this.state.data.length; i += sampleRate) {
            const point = this.state.data[i]
            if (point.x < minX) minX = point.x
            if (point.x > maxX) maxX = point.x
            if (point.y < minY) minY = point.y
            if (point.y > maxY) maxY = point.y
            
            sampledData.push({
                x: point.x,
                y: point.y,
                index: i + 1,
                timestamp: point.timestamp
            })
        }
        
        // Add padding to ranges
        const xPadding = (maxX - minX) * 0.05
        const yPadding = (maxY - minY) * 0.05
        
        // Choose point size based on data volume
        const pointRadius = sampledData.length > 500 ? 3 : 
                           sampledData.length > 200 ? 4 : 5
        
        this.chart = new Chart(this.chartRef.el, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: this.state.title.replace(/'/g, ''),
                    data: sampledData,
                    backgroundColor: 'rgba(54, 162, 235, 0.7)',
                    pointRadius: pointRadius,
                    pointHoverRadius: pointRadius + 2,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        min: minX - xPadding,
                        max: maxX + xPadding,
                        title: {
                            display: true,
                            text: 'X Coordinate'
                        }
                    },
                    y: {
                        min: minY - yPadding,
                        max: maxY + yPadding,
                        title: {
                            display: true,
                            text: 'Y Coordinate'
                        },
                        reverse: true
                    }
                },
                animation: sampledData.length > 200 ? { duration: 0 } : { duration: 500 },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const point = context.raw
                                return `X: ${point.x.toFixed(2)}, Y: ${point.y.toFixed(2)}`
                            }
                        }
                    },
                    legend: {
                        display: true,
                        position: 'top',
                    }
                }
            }
        })
    }
    
    // Optimized heatmap renderer
    renderHeatmap() {
        if (!this.state.data || !this.state.data.length) {
            this.displayNoDataMessage()
            return
        }
        
        // Filter only cells with data to reduce rendering overhead
        const nonEmptyCells = this.state.data.filter(point => point.value > 0)
        
        if (nonEmptyCells.length === 0) {
            this.displayNoDataMessage()
            return
        }
        
        // Create array of values to get min/max
        const values = nonEmptyCells.map(d => d.value)
        const maxValue = Math.max(...values)
        
        // Extract grid size
        const gridSize = Math.sqrt(this.state.data.length)
        
        // Create a color scale from low to high intensity
        const getColor = (value) => {
            // Default color for zero values
            if (value === 0) return 'rgba(220, 220, 220, 0.5)'
            
            // Normalized value between 0 and 1
            const normalizedValue = value / maxValue
            
            // Create a gradient from blue (cold) to red (hot)
            const hue = 240 - (normalizedValue * 240)
            const saturation = 100
            const lightness = 50 - (normalizedValue * 15)
            
            return `hsla(${hue}, ${saturation}%, ${lightness}%, 0.9)`
        }
        
        // Use scatter plot for heatmap
        this.chart = new Chart(this.chartRef.el, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: this.state.title.replace(/'/g, ''),
                    data: nonEmptyCells.map(point => ({
                        x: point.x,
                        y: point.y,
                        v: point.value
                    })),
                    backgroundColor: context => {
                        const value = context.raw.v
                        return getColor(value)
                    },
                    pointStyle: 'rect',
                    pointRadius: (context) => {
                        const value = context.raw.v
                        const normalizedValue = value / maxValue
                        return 15 + (normalizedValue * 15)
                    },
                    hoverRadius: (context) => {
                        const value = context.raw.v
                        const normalizedValue = value / maxValue
                        return 20 + (normalizedValue * 15)
                    },
                    pointHoverBackgroundColor: context => {
                        const value = context.raw.v
                        return getColor(value)
                    },
                    pointBorderColor: 'rgba(0, 0, 0, 0.3)',
                    pointBorderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'linear',
                        position: 'bottom',
                        min: 0,
                        max: gridSize,
                        title: {
                            display: true,
                            text: 'Posición X'
                        },
                        grid: {
                            display: true,
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    },
                    y: {
                        type: 'linear',
                        min: 0,
                        max: gridSize,
                        title: {
                            display: true,
                            text: 'Posición Y'
                        },
                        grid: {
                            display: true,
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    }
                },
                // Disable animations for better performance in heatmaps
                animation: { duration: 0 },
                plugins: {
                    tooltip: {
                        callbacks: {
                            title: function() {
                                return 'Punto de Mirada';
                            },
                            label: function(context) {
                                const point = context.raw;
                                return [
                                    `Posición: (${point.x}, ${point.y})`,
                                    `Conteo: ${point.v}`
                                ];
                            }
                        }
                    },
                    legend: {
                        display: false // Hide legend as it's not useful for heatmap
                    },
                    title: {
                        display: true,
                        text: 'Distribución de Puntos de Mirada',
                        font: {
                            size: 16
                        }
                    }
                }
            }
        });
        
        // Add color legend
        this.addColorLegend(maxValue);
    }
    
    addColorLegend(maxValue) {
        // Create a legend for the heatmap colors
        // This is a simple implementation; can be enhanced
        
        // First check if the chart container has a legend already
        const chartContainer = this.chartRef.el.parentNode;
        let legendEl = chartContainer.querySelector('.heatmap-legend');
        
        if (legendEl) {
            // Remove existing legend
            legendEl.remove();
        }
        
        // Create legend container
        legendEl = document.createElement('div');
        legendEl.className = 'heatmap-legend';
        legendEl.style.display = 'flex';
        legendEl.style.marginTop = '10px';
        legendEl.style.justifyContent = 'center';
        legendEl.style.alignItems = 'center';
        
        // Create gradient bar
        const gradientBar = document.createElement('div');
        gradientBar.style.height = '20px';
        gradientBar.style.width = '200px';
        gradientBar.style.background = 'linear-gradient(to right, hsl(240, 100%, 50%), hsl(180, 100%, 50%), hsl(60, 100%, 50%), hsl(0, 100%, 50%))';
        gradientBar.style.marginRight = '10px';
        
        // Create labels
        const minLabel = document.createElement('span');
        minLabel.textContent = '0';
        minLabel.style.marginRight = '5px';
        
        const maxLabel = document.createElement('span');
        maxLabel.textContent = maxValue;
        maxLabel.style.marginLeft = '5px';
        
        // Add elements to legend
        legendEl.appendChild(minLabel);
        legendEl.appendChild(gradientBar);
        legendEl.appendChild(maxLabel);
        
        // Add legend to chart container
        chartContainer.appendChild(legendEl);
    }
    
    // Method to display a message when no data is available
    displayNoDataMessage() {
        const ctx = this.chartRef.el.getContext('2d');
        if (!ctx) return;
        
        // Clear the canvas
        ctx.clearRect(0, 0, this.chartRef.el.width, this.chartRef.el.height);
        
        // Set text properties
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#666';
        
        // Draw the message
        ctx.fillText('No data available', this.chartRef.el.width / 2, this.chartRef.el.height / 2);
    }
}