function resize() {
    var canvas = document.getElementById('plotting_canvas');
    if (!canvas) {
        console.error("El elemento canvas no se encontró.");
        return;
    }
    var context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize, false);
